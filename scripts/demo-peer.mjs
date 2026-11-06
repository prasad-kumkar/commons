#!/usr/bin/env node
/**
 * A second Nostr account for demos and manual testing: the "other side" of DMs,
 * replies and tips.
 *
 *   DEMO_PEER_FILE=/path/peer.json node scripts/demo-peer.mjs setup
 *   DEMO_PEER_FILE=... node scripts/demo-peer.mjs dm <npub> "hey!"
 *   DEMO_PEER_FILE=... node scripts/demo-peer.mjs reply-latest <npub> "nice post"
 *   DEMO_PEER_FILE=... node scripts/demo-peer.mjs like-latest <npub>
 *   DEMO_PEER_FILE=... node scripts/demo-peer.mjs inbox
 *
 * The key file is created on first run; keep it out of git.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as nip17 from 'nostr-tools/nip17';
import * as nip19 from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social', 'wss://offchain.pub'];
const file = process.env.DEMO_PEER_FILE;
if (!file) throw new Error('Set DEMO_PEER_FILE to a JSON path outside the repo');

if (!existsSync(file)) {
  const evmKey = generatePrivateKey();
  writeFileSync(
    file,
    JSON.stringify({ sk: bytesToHex(generateSecretKey()), evmKey, evm: privateKeyToAddress(evmKey) }, null, 2),
    { mode: 0o600 },
  );
}
const peer = JSON.parse(readFileSync(file, 'utf8'));
const sk = hexToBytes(peer.sk);
const me = getPublicKey(sk);
const pool = new SimplePool();
const now = () => Math.floor(Date.now() / 1000);
const pk = (npub) => nip19.decode(npub).data;

async function send(template, relays = RELAYS) {
  const ev = finalizeEvent({ created_at: now(), tags: [], content: '', ...template }, sk);
  const res = await Promise.allSettled(pool.publish(relays, ev));
  console.log(`kind ${ev.kind} ${ev.id.slice(0, 8)} accepted by ${res.filter((r) => r.status === 'fulfilled').length}/${relays.length}`);
  return ev;
}

async function latest(author) {
  const evs = await pool.querySync(RELAYS, { kinds: [1], authors: [author], limit: 5 }, { maxWait: 4000 });
  return evs.filter((e) => !e.tags.some((t) => t[0] === 'e')).sort((a, b) => b.created_at - a.created_at)[0];
}

const [cmd, arg, text] = process.argv.slice(2);
switch (cmd) {
  case 'setup': {
    await send({
      kind: 0,
      content: JSON.stringify({
        name: 'maya',
        display_name: 'Maya Rao',
        about: 'Building on Nostr from Mumbai. Coffee, cameras, stablecoins.',
        picture: `https://api.dicebear.com/9.x/notionists/png?size=256&backgroundColor=ffd5dc&seed=maya-${me.slice(0, 8)}`,
        evm_address: peer.evm,
      }),
    });
    await send({ kind: 10050, tags: RELAYS.slice(0, 2).map((r) => ['relay', r]) });
    await send({ kind: 1, content: 'gm from ETHGlobal Mumbai ☕ Who else is hacking on Nostr this weekend?' });
    break;
  }
  case 'dm': {
    const to = pk(arg);
    // Gift wraps are already signed (by throwaway keys), so publish them as-is.
    const wraps = nip17.wrapManyEvents(sk, [{ publicKey: to }], text);
    for (const w of wraps) {
      const res = await Promise.allSettled(pool.publish(RELAYS, w));
      console.log(`gift wrap ${w.id.slice(0, 8)} accepted by ${res.filter((r) => r.status === 'fulfilled').length}/${RELAYS.length}`);
    }
    break;
  }
  case 'reply-latest': {
    const note = await latest(pk(arg));
    if (!note) throw new Error('no post found');
    await send({ kind: 1, content: text, tags: [['e', note.id, '', 'root'], ['p', note.pubkey]] });
    break;
  }
  case 'like-latest': {
    const note = await latest(pk(arg));
    if (!note) throw new Error('no post found');
    await send({ kind: 7, content: '+', tags: [['e', note.id], ['p', note.pubkey], ['k', '1']] });
    break;
  }
  case 'inbox': {
    const wraps = await pool.querySync(RELAYS, { kinds: [1059], '#p': [me] }, { maxWait: 4000 });
    for (const w of wraps) {
      try {
        const r = nip17.unwrapEvent(w, sk);
        console.log(new Date(r.created_at * 1000).toISOString(), nip19.npubEncode(r.pubkey).slice(0, 14), r.content);
      } catch {}
    }
    break;
  }
  default:
    console.log(`peer ${nip19.npubEncode(me)}  evm ${peer.evm}`);
}
pool.close(RELAYS);
process.exit(0);
