import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Event } from 'nostr-tools/core';
import * as nip04 from 'nostr-tools/nip04';
import * as nip05 from 'nostr-tools/nip05';
import * as nip17 from 'nostr-tools/nip17';
import * as nip59 from 'nostr-tools/nip59';

import { useNostr } from '@/hooks/use-nostr';
import {
  isReply,
  Kind,
  loadProfile,
  parseProfile,
  parsePubkey,
  publish,
  query,
  RELAYS,
  replyTags,
  SEARCH_RELAYS,
  verified,
  type Profile,
  type Tip,
} from '@/lib/nostr';

const now = () => Math.floor(Date.now() / 1000);

// ---------- profiles ----------

export function useProfile(pubkey: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: () => loadProfile(pubkey!),
    enabled: !!pubkey,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  const { send, pubkey } = useNostr();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Profile) => {
      // Keep unknown fields other clients may have set.
      const current = (qc.getQueryData(['profile', pubkey]) as Profile | null) ?? {};
      return send({ kind: Kind.Metadata, created_at: now(), tags: [], content: JSON.stringify({ ...current, ...profile }) });
    },
    onSuccess: (ev) => qc.setQueryData(['profile', pubkey], parseProfile(ev)),
  });
}

// ---------- follows ----------

export function useContacts(pubkey: string | null | undefined) {
  return useQuery({
    queryKey: ['contacts', pubkey],
    queryFn: async () => verified(await query({ kinds: [Kind.Contacts], authors: [pubkey!], limit: 2 }))[0] ?? null,
    enabled: !!pubkey,
    staleTime: 60_000,
    select: (ev) => ({ event: ev, follows: ev ? ev.tags.filter((t) => t[0] === 'p').map((t) => t[1]!) : [] }),
  });
}

export function useFollow() {
  const { send, pubkey } = useNostr();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, follow }: { target: string | string[]; follow: boolean }) => {
      // Always start from the freshest list so we never drop follows made in another client.
      const latest =
        verified(await query({ kinds: [Kind.Contacts], authors: [pubkey!], limit: 2 }, RELAYS, 1500))[0] ??
        (qc.getQueryData(['contacts', pubkey]) as Event | null) ??
        null;
      const targets = new Set(Array.isArray(target) ? target : [target]);
      const tags = (latest?.tags ?? []).filter((t) => !(t[0] === 'p' && targets.has(t[1]!)));
      if (follow) for (const t of targets) tags.push(['p', t]);
      return send({ kind: Kind.Contacts, created_at: now(), tags, content: latest?.content ?? '' });
    },
    // Flip the button immediately; the signed list replaces this once a relay accepts it.
    onMutate: ({ target, follow }) => {
      const prev = qc.getQueryData<Event | null>(['contacts', pubkey]);
      const targets = new Set(Array.isArray(target) ? target : [target]);
      const tags = (prev?.tags ?? []).filter((t) => !(t[0] === 'p' && targets.has(t[1]!)));
      if (follow) for (const t of targets) tags.push(['p', t]);
      qc.setQueryData(['contacts', pubkey], { ...(prev ?? { kind: Kind.Contacts, content: '', id: '', pubkey: pubkey!, sig: '', created_at: now() }), tags });
      return { prev };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(['contacts', pubkey], ctx?.prev ?? null),
    onSuccess: (ev) => {
      qc.setQueryData(['contacts', pubkey], ev);
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

// ---------- notes ----------

export function useFeed(authors: string[] | undefined) {
  return useQuery({
    queryKey: ['feed', authors],
    queryFn: async () => {
      const events = await query({ kinds: [Kind.Note], authors, limit: 300 }, RELAYS, 3000);
      return verified(events.filter((e) => !isReply(e)).slice(0, 60));
    },
    enabled: !!authors && authors.length > 0,
    staleTime: 30_000,
  });
}

export function useUserNotes(pubkey: string | undefined) {
  return useQuery({
    queryKey: ['notes', pubkey],
    queryFn: async () => verified((await query({ kinds: [Kind.Note], authors: [pubkey!], limit: 40 })).filter((e) => !isReply(e))),
    enabled: !!pubkey,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ['note', id],
    queryFn: async () => verified(await query({ ids: [id!] }))[0] ?? null,
    enabled: !!id,
    staleTime: Infinity,
  });
}

export function useReplies(id: string | undefined) {
  return useQuery({
    queryKey: ['replies', id],
    queryFn: async () => verified(await query({ kinds: [Kind.Note], '#e': [id!], limit: 100 })).reverse(),
    enabled: !!id,
  });
}

export type Engagement = Record<string, { likes: number; replies: number; tips: number; liked: boolean }>;

/** Like/reply/tip counts for a set of notes in a single relay query. */
export function useEngagement(ids: string[]) {
  const { pubkey } = useNostr();
  return useQuery({
    queryKey: ['engagement', ids],
    queryFn: async () => {
      const out: Engagement = Object.fromEntries(ids.map((id) => [id, { likes: 0, replies: 0, tips: 0, liked: false }]));
      if (ids.length === 0) return out;
      const events = await query({ kinds: [Kind.Note, Kind.Reaction], '#e': ids, limit: 1000 });
      for (const e of events) {
        const target = e.tags.filter((t) => t[0] === 'e').at(-1)?.[1];
        const row = target && out[target];
        if (!row) continue;
        if (e.kind === Kind.Note) row.replies++;
        else if (e.tags.some((t) => t[0] === 'tip')) row.tips++;
        else if (e.content !== '-') {
          row.likes++;
          if (e.pubkey === pubkey) row.liked = true;
        }
      }
      return out;
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

export function usePost() {
  const { send, pubkey } = useNostr();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, parent }: { content: string; parent?: Event }) =>
      send({ kind: Kind.Note, created_at: now(), tags: parent ? replyTags(parent) : [], content }),
    onSuccess: (ev, { parent }) => {
      if (parent) {
        qc.setQueryData<Event[]>(['replies', parent.id], (old) => [...(old ?? []), ev]);
      } else {
        qc.setQueriesData<Event[]>({ queryKey: ['feed'] }, (old) => (old ? [ev, ...old] : old));
        qc.setQueryData<Event[]>(['notes', pubkey], (old) => [ev, ...(old ?? [])]);
      }
      qc.invalidateQueries({ queryKey: ['engagement'] });
    },
  });
}

export function useReact() {
  const { send } = useNostr();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ note, content = '+', tip }: { note: Event; content?: string; tip?: Tip }) =>
      send({
        kind: Kind.Reaction,
        created_at: now(),
        tags: [
          ['e', note.id],
          ['p', note.pubkey],
          ['k', String(note.kind)],
          ...(tip ? [['tip', tip.amount, tip.symbol, tip.caip2, tip.tx]] : []),
        ],
        content,
      }),
    onMutate: ({ note, tip }) => {
      if (tip) return;
      qc.setQueriesData<Engagement>({ queryKey: ['engagement'] }, (old) => {
        const row = old?.[note.id];
        if (!old || !row || row.liked) return old;
        return { ...old, [note.id]: { ...row, likes: row.likes + 1, liked: true } };
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['engagement'] }),
  });
}

// ---------- notifications ----------

export function useNotifications() {
  const { pubkey } = useNostr();
  return useQuery({
    queryKey: ['notifications', pubkey],
    queryFn: async () =>
      verified((await query({ kinds: [Kind.Note, Kind.Reaction], '#p': [pubkey!], limit: 60 })).filter((e) => e.pubkey !== pubkey)),
    enabled: !!pubkey,
    refetchInterval: 30_000,
  });
}

// ---------- search ----------

export function useSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['search', q],
    enabled: q.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<{ people: string[]; notes: Event[] }> => {
      const direct = parsePubkey(q);
      if (direct) return { people: [direct], notes: [] };
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) || /^[^\s@]+\.[a-z]{2,}$/i.test(q)) {
        const pointer = await nip05.queryProfile(q).catch(() => null);
        if (pointer) return { people: [pointer.pubkey], notes: [] };
      }
      const [profiles, notes] = await Promise.all([
        query({ kinds: [Kind.Metadata], search: q, limit: 20 }, SEARCH_RELAYS, 5000),
        query({ kinds: [Kind.Note], search: q, limit: 30 }, SEARCH_RELAYS, 5000),
      ]);
      const people = [...new Set(profiles.map((e) => e.pubkey))];
      return { people, notes: verified(notes.filter((e) => !isReply(e))) };
    },
  });
}

// ---------- direct messages ----------

export type Message = { id: string; from: string; to: string; content: string; created_at: number };
export type Conversation = { peer: string; messages: Message[]; last: Message };

// Unwrapping costs two ECDH ops per message; remember results across refetches.
const unwrapped = new Map<string, Message | null>();

function toMessage(ev: Event, me: string, sk: Uint8Array): Message | null {
  if (unwrapped.has(ev.id)) return unwrapped.get(ev.id)!;
  let msg: Message | null = null;
  try {
    if (ev.kind === Kind.GiftWrap) {
      const rumor = nip17.unwrapEvent(ev, sk);
      if (rumor.kind === Kind.PrivateDM) {
        const to = rumor.tags.find((t) => t[0] === 'p')?.[1] ?? me;
        msg = { id: rumor.id, from: rumor.pubkey, to, content: rumor.content, created_at: rumor.created_at };
      }
    } else if (ev.kind === Kind.LegacyDM) {
      const to = ev.tags.find((t) => t[0] === 'p')?.[1];
      const peer = ev.pubkey === me ? to : ev.pubkey;
      if (to && peer) {
        msg = { id: ev.id, from: ev.pubkey, to, content: nip04.decrypt(sk, peer, ev.content), created_at: ev.created_at };
      }
    }
  } catch {
    msg = null;
  }
  unwrapped.set(ev.id, msg);
  return msg;
}

/** NIP-17 private messages (plus legacy NIP-04 for older clients), grouped by peer. */
export function useConversations({ live = false }: { live?: boolean } = {}) {
  const { pubkey, secretKey } = useNostr();
  return useQuery({
    queryKey: ['dms', pubkey],
    enabled: !!pubkey && !!secretKey,
    // An open chat polls faster so replies feel live.
    refetchInterval: live ? 4_000 : 15_000,
    queryFn: async (): Promise<Conversation[]> => {
      const me = pubkey!;
      const [wraps, legacyIn, legacyOut] = await Promise.all([
        query({ kinds: [Kind.GiftWrap], '#p': [me], limit: 300 }),
        query({ kinds: [Kind.LegacyDM], '#p': [me], limit: 100 }).then(verified),
        query({ kinds: [Kind.LegacyDM], authors: [me], limit: 100 }).then(verified),
      ]);
      const byPeer = new Map<string, Map<string, Message>>();
      for (const ev of [...wraps, ...legacyIn, ...legacyOut]) {
        const m = toMessage(ev, me, secretKey!);
        if (!m) continue;
        const peer = m.from === me ? m.to : m.from;
        if (peer === me) continue;
        if (!byPeer.has(peer)) byPeer.set(peer, new Map());
        byPeer.get(peer)!.set(m.id, m); // rumor ids de-dupe our own copy vs theirs
      }
      return [...byPeer.entries()]
        .map(([peer, map]) => {
          const messages = [...map.values()].sort((a, b) => a.created_at - b.created_at);
          return { peer, messages, last: messages.at(-1)! };
        })
        .sort((a, b) => b.last.created_at - a.last.created_at);
    },
  });
}

async function inboxRelays(pubkey: string) {
  const ev = (await query({ kinds: [Kind.DMRelays], authors: [pubkey], limit: 1 }, RELAYS, 2500))[0];
  const listed = ev?.tags.filter((t) => t[0] === 'relay').map((t) => t[1]!) ?? [];
  return [...new Set([...listed, ...RELAYS])];
}

export function useSendDM() {
  const { pubkey, secretKey } = useNostr();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ to, content }: { to: string; content: string }) => {
      // One rumor (kind 14, p = recipient) sealed and gift-wrapped twice: once for them,
      // once for us. nip17.wrapManyEvents tags each copy with only its own recipient,
      // which would file our copy under a conversation with ourselves.
      const [selfCopy, peerCopy] = nip59.wrapManyEvents(
        { kind: Kind.PrivateDM, content, tags: [['p', to]], created_at: now() },
        secretKey!,
        [to],
      );
      const [mineRelays, theirRelays] = await Promise.all([inboxRelays(pubkey!), inboxRelays(to)]);
      await Promise.all([publish(selfCopy!, mineRelays), publish(peerCopy!, theirRelays)]);
      const msg: Message = { id: `local-${Date.now()}`, from: pubkey!, to, content, created_at: now() };
      return msg;
    },
    onSuccess: (msg) => {
      qc.setQueryData<Conversation[]>(['dms', pubkey], (old = []) => {
        const existing = old.find((c) => c.peer === msg.to);
        const messages = [...(existing?.messages ?? []), msg];
        const updated = { peer: msg.to, messages, last: msg };
        return [updated, ...old.filter((c) => c.peer !== msg.to)];
      });
      // Let the relay copy replace the optimistic one shortly after.
      setTimeout(() => qc.invalidateQueries({ queryKey: ['dms', pubkey] }), 3000);
    },
  });
}
