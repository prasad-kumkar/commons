import type { Event } from 'nostr-tools/core';
import type { Filter } from 'nostr-tools/filter';
import * as nip19 from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';

/** Read/write relays. Checked for kind 1, 3, 7, 1059 support. */
export const RELAYS = ['wss://nos.lol', 'wss://relay.snort.social', 'wss://offchain.pub', 'wss://relay.damus.io'];
/** Relays that answer NIP-50 `search` filters. */
export const SEARCH_RELAYS = ['wss://relay.ditto.pub', 'wss://nostr.wine', 'wss://search.nos.today'];

export const pool = new SimplePool({ enablePing: true, enableReconnect: true });

export const Kind = {
  Metadata: 0,
  Note: 1,
  Contacts: 3,
  LegacyDM: 4,
  Reaction: 7,
  PrivateDM: 14,
  GiftWrap: 1059,
  DMRelays: 10050,
} as const;

/** Well-known accounts offered on an empty feed. */
export const SUGGESTED = [
  'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m', // jack
  'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6', // fiatjaf
  'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx', // odell
  'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s', // jb55
  'npub18ams6ewn5aj2n3wt2qawzglx9mr4nzksxhvrdc4gzrecw7n5tvjqctp424', // derek ross
  'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc', // gigi
].map((n) => nip19.decode(n).data as string);

/** One-shot query across relays, de-duplicated and newest first. */
export async function query(filter: Filter, relays: string[] = RELAYS, maxWait = 2500): Promise<Event[]> {
  const events = await pool.querySync(relays, filter, { maxWait });
  const seen = new Map<string, Event>();
  for (const e of events) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => b.created_at - a.created_at);
}

/**
 * Publishes to every relay and resolves as soon as one accepts it, so a slow relay
 * never holds up the UI; the rest keep sending in the background.
 */
export async function publish(event: Event, relays: string[] = RELAYS): Promise<Event> {
  const attempts = pool.publish(relays, event);
  await new Promise<void>((resolve, reject) => {
    const reasons: string[] = [];
    for (const a of attempts) {
      a.then(
        () => resolve(),
        (err) => {
          reasons.push(String(err));
          if (reasons.length === attempts.length) reject(new Error(`No relay accepted the event: ${reasons.join('; ')}`));
        },
      );
    }
  });
  return event;
}

// ---------- profiles ----------

export type Profile = {
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  website?: string;
  /** Commons extension: EVM address that accepts USDC tips. */
  evm_address?: string;
};

export function parseProfile(event: Event | undefined): Profile | null {
  if (!event) return null;
  try {
    const json = JSON.parse(event.content);
    return json && typeof json === 'object' ? (json as Profile) : null;
  } catch {
    return null;
  }
}

export function npub(pubkey: string) {
  return nip19.npubEncode(pubkey);
}

export function shortNpub(pubkey: string) {
  const n = npub(pubkey);
  return `${n.slice(0, 10)}…${n.slice(-4)}`;
}

export function displayName(profile: Profile | null | undefined, pubkey: string) {
  return profile?.display_name?.trim() || profile?.name?.trim() || shortNpub(pubkey);
}

export function avatarFallback(pubkey: string) {
  return `https://api.dicebear.com/9.x/glass/png?size=128&seed=${pubkey}`;
}

/**
 * Batches profile lookups made in the same tick into one relay query,
 * so a feed of 50 notes costs one kind-0 request instead of 50.
 */
type Waiter = (p: Profile | null) => void;
const waiting = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function loadProfile(pubkey: string): Promise<Profile | null> {
  return new Promise((resolve) => {
    const list = waiting.get(pubkey) ?? [];
    list.push(resolve);
    waiting.set(pubkey, list);
    timer ??= setTimeout(flushProfiles, 30);
  });
}

async function flushProfiles() {
  timer = null;
  const batch = new Map(waiting);
  waiting.clear();
  const authors = [...batch.keys()];
  let events: Event[] = [];
  try {
    events = await query({ kinds: [Kind.Metadata], authors }, RELAYS, 3000);
  } catch (err) {
    console.warn('[nostr] profile batch failed', err);
  }
  for (const pk of authors) {
    // query() sorts newest first, so the first match is the current profile.
    const profile = parseProfile(events.find((e) => e.pubkey === pk));
    for (const resolve of batch.get(pk) ?? []) resolve(profile);
  }
}

// ---------- notes ----------

/** True for notes that reply to another note (NIP-10), so feeds can show top-level posts only. */
export function isReply(event: Event) {
  return event.tags.some((t) => t[0] === 'e' && t[3] !== 'mention');
}

/** The note this one replies to (NIP-10 marked tags, falling back to the last `e`). */
export function replyParent(event: Event) {
  const es = event.tags.filter((t) => t[0] === 'e');
  return (es.find((t) => t[3] === 'reply') ?? es.find((t) => t[3] === 'root') ?? es.at(-1))?.[1];
}

export function replyTags(parent: Event) {
  const root = parent.tags.find((t) => t[0] === 'e' && t[3] === 'root')?.[1];
  const tags: string[][] = root
    ? [
        ['e', root, '', 'root'],
        ['e', parent.id, '', 'reply'],
      ]
    : [['e', parent.id, '', 'root']];
  const people = new Set([parent.pubkey, ...parent.tags.filter((t) => t[0] === 'p').map((t) => t[1]!)]);
  for (const p of people) tags.push(['p', p]);
  return tags;
}

export function timeAgo(seconds: number) {
  const diff = Math.max(0, Date.now() / 1000 - seconds);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Accepts npub, nprofile or 64-char hex; returns a hex pubkey or null. */
export function parsePubkey(input: string): string | null {
  const s = input.trim().replace(/^nostr:/, '');
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
  try {
    const d = nip19.decode(s);
    if (d.type === 'npub') return d.data;
    if (d.type === 'nprofile') return d.data.pubkey;
  } catch {
    // not bech32
  }
  return null;
}

/** Tip metadata a Commons client attaches to a 💸 reaction. */
export type Tip = { amount: string; symbol: string; caip2: string; tx: string };

export function readTip(event: Event): Tip | null {
  const t = event.tags.find((x) => x[0] === 'tip');
  if (!t || t.length < 5) return null;
  return { amount: t[1]!, symbol: t[2]!, caip2: t[3]!, tx: t[4]! };
}
