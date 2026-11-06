import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import type { Event, EventTemplate } from 'nostr-tools/core';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { bytesToHex, hexToBytes, type Hex } from 'viem';

import { avatarFallback, Kind, parseProfile, publish, query, RELAYS, type Profile } from '@/lib/nostr';
import { describeUser } from '@/lib/user';

/**
 * The user's Nostr identity, derived from their Privy wallet.
 *
 * Nostr needs a raw secp256k1 key in the app: events are BIP-340 Schnorr signatures
 * and DMs need ECDH (NIP-44), neither of which a remote signer offers. So the key is
 * derived from a deterministic (RFC 6979) `personal_sign` by the user's Privy EVM
 * wallet over a fixed message, run through HKDF. Same Privy login → same Nostr key on
 * any device, with no seed phrase to back up. The key is cached in the Keychain.
 */
export const DERIVE_MESSAGE =
  'Commons: unlock my Nostr identity\n\nSigning this creates your Nostr key for Commons. It does not move funds or cost gas.';

type Status = { state: 'deriving' } | { state: 'ready' } | { state: 'error'; message: string };

type Nostr = {
  status: Status;
  pubkey: string | null;
  /** Secret key bytes; only for local crypto (NIP-44). Never leaves the device. */
  secretKey: Uint8Array | null;
  /** Signs and publishes; resolves once a relay accepts it. */
  send: (template: EventTemplate, relays?: string[]) => Promise<Event>;
  retry: () => void;
};

const NostrContext = createContext<Nostr | null>(null);

export function NostrProvider({ children }: { children: ReactNode }) {
  const { user } = usePrivy();
  return <NostrState key={user?.id ?? 'signed-out'}>{children}</NostrState>;
}

export function useNostr(): Nostr {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error('useNostr must be used inside <NostrProvider>');
  return ctx;
}

/** For screens that only render once the identity exists. */
export function useNostrReady() {
  const n = useNostr();
  if (!n.pubkey || !n.secretKey) return null;
  return n as Nostr & { pubkey: string; secretKey: Uint8Array };
}

function storeKey(userId: string) {
  // SecureStore keys allow [A-Za-z0-9._-].
  return `nostr-sk.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function NostrState({ children }: { children: ReactNode }) {
  const { user } = usePrivy();
  const eth = useEmbeddedEthereumWallet();
  const queryClient = useQueryClient();
  const wallet = eth.wallets[0];
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [status, setStatus] = useState<Status>({ state: 'deriving' });
  const [attempt, setAttempt] = useState(0);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!user || !wallet || secretKey) return;
    let cancelled = false;
    (async () => {
      try {
        const key = storeKey(user.id);
        const cached = await SecureStore.getItemAsync(key);
        let sk: Uint8Array;
        if (cached) {
          sk = hexToBytes(`0x${cached}`);
        } else {
          const provider = await wallet.getProvider();
          const sig = (await provider.request({
            method: 'personal_sign',
            params: [DERIVE_MESSAGE, wallet.address],
          })) as Hex;
          sk = hkdf(sha256, hexToBytes(sig), 'commons-nostr', 'nostr-secret-key-v1', 32);
          await SecureStore.setItemAsync(key, bytesToHex(sk).slice(2), {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
          });
        }
        if (cancelled) return;
        setSecretKey(sk);
        setStatus({ state: 'ready' });
      } catch (err) {
        if (cancelled) return;
        // Right after login Privy's wallet proxy may still be starting; retry a few times quietly.
        if (attempt < 4) {
          setTimeout(() => !cancelled && setAttempt((a) => a + 1), 1500);
          return;
        }
        console.warn('[nostr] key derivation failed', err);
        setStatus({ state: 'error', message: "Couldn't unlock your Nostr identity." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, wallet, secretKey, attempt]);

  const pubkey = secretKey ? getPublicKey(secretKey) : null;

  async function send(template: EventTemplate, relays: string[] = RELAYS) {
    if (!secretKey) throw new Error('Nostr identity not ready');
    return publish(finalizeEvent(template, secretKey), relays);
  }

  // First run: publish a starter profile and DM inbox relays if this key has none.
  useEffect(() => {
    if (!pubkey || !secretKey || !user || bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      const mine = await query({ kinds: [Kind.Metadata, Kind.DMRelays], authors: [pubkey] });
      const now = Math.floor(Date.now() / 1000);
      if (!mine.some((e) => e.kind === Kind.Metadata)) {
        const { name } = describeUser(user);
        const profile: Profile = {
          name,
          display_name: name,
          picture: avatarFallback(pubkey),
          about: 'Hanging out on Commons.',
          evm_address: wallet?.address,
        };
        const ev = finalizeEvent(
          { kind: Kind.Metadata, created_at: now, tags: [], content: JSON.stringify(profile) },
          secretKey,
        );
        await publish(ev);
        queryClient.setQueryData(['profile', pubkey], parseProfile(ev));
      }
      if (!mine.some((e) => e.kind === Kind.DMRelays)) {
        await publish(
          finalizeEvent(
            { kind: Kind.DMRelays, created_at: now, tags: RELAYS.slice(0, 2).map((r) => ['relay', r]), content: '' },
            secretKey,
          ),
        );
      }
    })().catch((err) => {
      bootstrapped.current = false;
      console.warn('[nostr] bootstrap failed', err);
    });
  }, [pubkey, secretKey, user, wallet?.address, queryClient]);

  return (
    <NostrContext.Provider
      value={{
        status,
        pubkey,
        secretKey,
        send,
        retry: () => {
          setStatus({ state: 'deriving' });
          setAttempt(0);
        },
      }}>
      {children}
    </NostrContext.Provider>
  );
}
