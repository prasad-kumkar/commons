import { bech32, bech32m } from '@scure/base';

/**
 * Re-encode a native SegWit/Taproot address for another network.
 *
 * Privy returns mainnet (`bc1…`) addresses. The witness program (and so the key that
 * signs for it) is identical on testnet; only the human-readable prefix and checksum
 * change. SegWit v0 uses bech32, v1+ (Taproot) uses bech32m (BIP-350).
 */
export function reencodeSegwitAddress(address: string, hrp: 'bc' | 'tb'): string {
  const lower = address.toLowerCase();
  const isV0 = lower.slice(lower.indexOf('1') + 1).startsWith('q');
  const codec = isV0 ? bech32 : bech32m;
  const { words } = codec.decode(lower as `${string}1${string}`, 90);
  return codec.encode(hrp, words, 90);
}
