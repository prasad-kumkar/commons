import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { hexToBytes, type Hex } from 'viem';

/**
 * Message the Privy EVM wallet signs to derive the user's Nostr key.
 * Changing it changes every user's npub, so treat it as a constant forever.
 */
export const DERIVE_MESSAGE =
  'Commons: unlock my Nostr identity\n\nSigning this creates your Nostr key for Commons. It does not move funds or cost gas.';

/** Nostr secret key from a `personal_sign` over DERIVE_MESSAGE (HKDF-SHA256). */
export function deriveSecretKey(signature: Hex): Uint8Array {
  return hkdf(sha256, hexToBytes(signature), 'commons-nostr', 'nostr-secret-key-v1', 32);
}
