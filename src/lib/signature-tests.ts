/**
 * Signature lab: one test per signing method Privy exposes to this (TEE, Expo) app.
 * Every test signs with Privy, then verifies locally; "signed" alone is not a pass.
 */
import { ed25519 } from '@noble/curves/ed25519';
import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { ripemd160 } from '@noble/hashes/legacy';
import { sha256 } from '@noble/hashes/sha2';
import { base58, base64, bech32, bech32m, hex } from '@scure/base';
import {
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  keccak256,
  parseTransaction,
  recoverAddress,
  recoverMessageAddress,
  recoverTransactionAddress,
  recoverTypedDataAddress,
  toHex,
  type Hex,
} from 'viem';
import { recoverAuthorizationAddress } from 'viem/utils';

import { findNetwork } from '@/lib/networks';
import { DERIVE_MESSAGE, deriveSecretKey } from '@/lib/nostr-key';
import * as nip19 from 'nostr-tools/nip19';
import { getPublicKey } from 'nostr-tools/pure';

export type TestResult = { ok: boolean; detail: string; signature?: string };

export type EvmProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
export type SolanaProvider = {
  request: (args: { method: string; params: Record<string, unknown> }) => Promise<unknown>;
};

export type Signers = {
  /** Current Nostr pubkey (hex), to check the derivation reproduces it. */
  nostrPubkey?: string | null;
  evm?: { address: Hex; provider: () => Promise<EvmProvider> };
  /** Gas-sponsored sends via Privy's Wallet API (see use-sponsored-send). */
  sponsored?: {
    evm: (chainId: number, tx: { to: Hex; value?: Hex; data?: Hex }) => Promise<Hex>;
    solana: (caip2: string, serializedTx: Uint8Array) => Promise<string>;
  };
  sign7702?: (input: { contractAddress: Hex; chainId: number }) => Promise<unknown>;
  solana?: { address: string; provider: () => Promise<SolanaProvider> };
  /** Privy Bitcoin addresses (bc1…, mainnet-encoded) + raw-hash signer for TEE apps. */
  bitcoin?: {
    segwit?: string;
    taproot?: string;
    signRawHash: (input: { address: string; chainType: 'bitcoin-segwit' | 'bitcoin-taproot'; hash: Hex }) => Promise<{
      signature: Hex;
    }>;
  };
};

export type SignatureTest = {
  id: string;
  group: 'Nostr' | 'EVM' | 'Solana' | 'Bitcoin' | 'Sponsored';
  name: string;
  description: string;
  run: (s: Signers) => Promise<TestResult>;
};

const MESSAGE = 'Hello from Commons Nostr 👋';
const BASE_SEPOLIA = findNetwork('base')?.chainId ?? 84532;

function short(sig: string) {
  return sig.length > 22 ? `${sig.slice(0, 12)}…${sig.slice(-8)}` : sig;
}

function need<T>(value: T | undefined, what: string): T {
  if (!value) throw new Error(`${what} wallet not ready`);
  return value;
}

function strip0x(h: string) {
  return h.startsWith('0x') ? h.slice(2) : h;
}

/** Witness program bytes from a bech32/bech32m address. */
function witnessProgram(address: string) {
  const isV0 = address.toLowerCase().slice(address.indexOf('1') + 1).startsWith('q');
  const codec = isV0 ? bech32 : bech32m;
  const { words } = codec.decode(address.toLowerCase() as `${string}1${string}`, 90);
  return codec.fromWords(words.slice(1));
}

// ——— Solana: minimal legacy tx (0-lamport self transfer) built by hand, no web3.js ———
function compactU16(n: number) {
  const out: number[] = [];
  let v = n;
  for (;;) {
    let b = v & 0x7f;
    v >>= 7;
    if (v === 0) {
      out.push(b);
      return out;
    }
    b |= 0x80;
    out.push(b);
  }
}

async function solanaSelfTransferMessage(owner: string) {
  const rpc = findNetwork('solana')!.rpcUrl!;
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [] }),
  });
  const { result } = (await res.json()) as { result: { value: { blockhash: string } } };
  const ownerKey = base58.decode(owner);
  const systemProgram = new Uint8Array(32);
  const data = new Uint8Array(12);
  new DataView(data.buffer).setUint32(0, 2, true); // SystemInstruction::Transfer, 0 lamports
  const message = new Uint8Array([
    1, 0, 1, // header: 1 signer, 0 readonly signed, 1 readonly unsigned (system program)
    ...compactU16(2),
    ...ownerKey,
    ...systemProgram,
    ...base58.decode(result.value.blockhash),
    ...compactU16(1), // one instruction
    1, // program id index
    ...compactU16(2),
    0,
    0, // from = to = owner
    ...compactU16(data.length),
    ...data,
  ]);
  return { message, ownerKey };
}

async function jsonRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result as T;
}

async function poll<T>(fn: () => Promise<T | null>, timeoutMs = 45_000, everyMs = 2_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error('Timed out waiting for confirmation');
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

export const SIGNATURE_TESTS: SignatureTest[] = [
  {
    id: 'nostr-derive',
    group: 'Nostr',
    name: 'Nostr key derivation',
    description: 'Signs the derivation message twice: both signatures must match and re-derive your npub.',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      const p = await evm.provider();
      const sign = () => p.request({ method: 'personal_sign', params: [DERIVE_MESSAGE, evm.address] }) as Promise<Hex>;
      const a = await sign();
      const b = await sign();
      const pubkey = getPublicKey(deriveSecretKey(a));
      const same = a === b;
      const matches = pubkey === s.nostrPubkey;
      return {
        ok: same && matches,
        detail: `${same ? 'deterministic' : 'NOT deterministic'}; ${matches ? 'matches' : 'does not match'} ${nip19.npubEncode(pubkey).slice(0, 16)}…`,
        signature: short(a),
      };
    },
  },
  {
    id: 'evm-personal-sign',
    group: 'EVM',
    name: 'personal_sign',
    description: 'EIP-191 message signature (Sign-In-With-Ethereum, auth).',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      const p = await evm.provider();
      const sig = (await p.request({ method: 'personal_sign', params: [MESSAGE, evm.address] })) as Hex;
      const signer = await recoverMessageAddress({ message: MESSAGE, signature: sig });
      return { ok: isAddressEqual(signer, evm.address), detail: `recovered ${signer}`, signature: short(sig) };
    },
  },
  {
    id: 'evm-typed-data',
    group: 'EVM',
    name: 'eth_signTypedData_v4',
    description: 'EIP-712 structured data (permits, orders, off-chain votes).',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      const typedData = {
        domain: { name: 'Commons', version: '1', chainId: BASE_SEPOLIA },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          Post: [
            { name: 'author', type: 'address' },
            { name: 'content', type: 'string' },
          ],
        },
        primaryType: 'Post' as const,
        message: { author: evm.address, content: MESSAGE },
      };
      const p = await evm.provider();
      const sig = (await p.request({
        method: 'eth_signTypedData_v4',
        params: [evm.address, JSON.stringify(typedData)],
      })) as Hex;
      const { EIP712Domain: _domain, ...types } = typedData.types;
      const signer = await recoverTypedDataAddress({ ...typedData, types, signature: sig });
      return { ok: isAddressEqual(signer, evm.address), detail: `recovered ${signer}`, signature: short(sig) };
    },
  },
  {
    id: 'evm-sign-tx',
    group: 'EVM',
    name: 'eth_signTransaction',
    description: 'EIP-1559 tx on Base Sepolia, signed but not broadcast.',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      const p = await evm.provider();
      const tx = {
        from: evm.address,
        to: evm.address,
        value: '0x0',
        chainId: toHex(BASE_SEPOLIA),
        nonce: '0x0',
        gas: toHex(21000),
        maxFeePerGas: toHex(2_000_000_000),
        maxPriorityFeePerGas: toHex(1_000_000),
        type: '0x2',
      };
      const raw = (await p.request({ method: 'eth_signTransaction', params: [tx] })) as Hex;
      const parsed = parseTransaction(raw);
      const signer = await recoverTransactionAddress({ serializedTransaction: raw as never });
      return {
        ok: isAddressEqual(signer, evm.address) && parsed.chainId === BASE_SEPOLIA,
        detail: `type ${parsed.type}, chain ${parsed.chainId}, signer ${signer}`,
        signature: short(raw),
      };
    },
  },
  {
    id: 'evm-raw-hash',
    group: 'EVM',
    name: 'secp256k1_sign',
    description: 'Raw 32-byte hash, no prefix (custom protocols, AA user ops).',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      const p = await evm.provider();
      const hash = keccak256(toHex(MESSAGE));
      const sig = (await p.request({ method: 'secp256k1_sign', params: [hash] })) as Hex;
      const signer = await recoverAddress({ hash, signature: sig });
      return { ok: isAddressEqual(signer, evm.address), detail: `recovered ${signer}`, signature: short(sig) };
    },
  },
  {
    id: 'evm-7702',
    group: 'EVM',
    name: 'EIP-7702 authorization',
    description: 'Delegate the EOA to a smart-account contract (Base Sepolia).',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      if (!s.sign7702) throw new Error('7702 signer unavailable');
      // Any contract works for a signature test; this is the EF's canonical deterministic deployer.
      const contractAddress = '0x4e59b44847b379578588920cA78FbF26c0B4956C' as Hex;
      const auth = (await s.sign7702({ contractAddress, chainId: BASE_SEPOLIA })) as Parameters<
        typeof recoverAuthorizationAddress
      >[0]['authorization'];
      const signer = await recoverAuthorizationAddress({ authorization: auth });
      return {
        ok: isAddressEqual(signer, evm.address),
        detail: `delegate ${contractAddress.slice(0, 10)}…, signer ${signer}`,
        signature: short(String((auth as { r?: string }).r ?? '')),
      };
    },
  },
  {
    id: 'sol-sign-message',
    group: 'Solana',
    name: 'signMessage',
    description: 'Ed25519 off-chain message (Sign-In-With-Solana).',
    async run(s) {
      const sol = need(s.solana, 'Solana');
      const p = await sol.provider();
      const message = new TextEncoder().encode(MESSAGE);
      // Privy's Solana signMessage takes the message bytes base64-encoded (plain text gets
      // base64-decoded into the wrong bytes), and returns a base64 signature.
      const { signature } = (await p.request({
        method: 'signMessage',
        params: { message: base64.encode(message) },
      })) as { signature: string };
      const sig = base64.decode(signature);
      const ok = ed25519.verify(sig, message, base58.decode(sol.address));
      return { ok, detail: ok ? 'ed25519 verified against wallet pubkey' : 'ed25519 verify failed', signature: short(hex.encode(sig)) };
    },
  },
  {
    id: 'sol-sign-tx',
    group: 'Solana',
    name: 'signTransaction',
    description: 'Devnet transfer built in-app, signed but not broadcast.',
    async run(s) {
      const sol = need(s.solana, 'Solana');
      const { message, ownerKey } = await solanaSelfTransferMessage(sol.address);
      const unsigned = new Uint8Array([...compactU16(1), ...new Uint8Array(64), ...message]);
      const p = await sol.provider();
      const { signedTransaction } = (await p.request({
        method: 'signTransaction',
        params: { transaction: unsigned },
      })) as { signedTransaction: Uint8Array };
      const signed = new Uint8Array(signedTransaction);
      const sig = signed.slice(1, 65);
      const ok = ed25519.verify(sig, signed.slice(65), ownerKey);
      return { ok, detail: ok ? 'tx signature verified over message bytes' : 'tx signature invalid', signature: short(base58.encode(sig)) };
    },
  },
  {
    id: 'btc-segwit-raw',
    group: 'Bitcoin',
    name: 'Native SegWit raw hash',
    description: 'ECDSA over a sighash, as used when signing PSBT inputs (bc1q/tb1q).',
    async run(s) {
      const btc = need(s.bitcoin, 'Bitcoin');
      const address = need(btc.segwit, 'Bitcoin SegWit');
      const hash = sha256(new TextEncoder().encode(MESSAGE));
      const { signature } = await btc.signRawHash({
        address,
        chainType: 'bitcoin-segwit',
        hash: `0x${hex.encode(hash)}`,
      });
      const sigBytes = hex.decode(strip0x(signature)).slice(0, 64);
      const program = witnessProgram(address);
      // No recovery id is returned: try both and match HASH160(pubkey) to the witness program.
      const match = [0, 1].some((bit) => {
        try {
          const pub = secp256k1.Signature.fromCompact(sigBytes).addRecoveryBit(bit).recoverPublicKey(hash);
          const h160 = ripemd160(sha256(pub.toRawBytes(true)));
          return hex.encode(h160) === hex.encode(program);
        } catch {
          return false;
        }
      });
      return {
        ok: match,
        detail: match ? 'pubkey hash matches witness program' : 'recovered key does not match address',
        signature: short(signature),
      };
    },
  },
  {
    id: 'btc-taproot-raw',
    group: 'Bitcoin',
    name: 'Taproot raw hash',
    description: 'BIP-340 Schnorr over a sighash for key-path spends (bc1p/tb1p).',
    async run(s) {
      const btc = need(s.bitcoin, 'Bitcoin');
      const address = need(btc.taproot, 'Bitcoin Taproot');
      const hash = sha256(new TextEncoder().encode(MESSAGE));
      const { signature } = await btc.signRawHash({
        address,
        chainType: 'bitcoin-taproot',
        hash: `0x${hex.encode(hash)}`,
      });
      const sigBytes = hex.decode(strip0x(signature));
      const outputKey = witnessProgram(address);
      let ok = false;
      try {
        ok = sigBytes.length === 64 && schnorr.verify(sigBytes, hash, outputKey);
      } catch {
        ok = false;
      }
      return {
        ok,
        detail: ok
          ? 'Schnorr verified against tweaked output key'
          : `${sigBytes.length}-byte sig; not valid for the output key (may sign with internal key)`,
        signature: short(signature),
      };
    },
  },
  {
    id: 'sponsored-evm-usdc',
    group: 'Sponsored',
    name: 'USDC transfer on Base Sepolia',
    description: 'Real ERC-20 transfer (0.01 USDC to self); gas paid by sponsorship.',
    async run(s) {
      const evm = need(s.evm, 'EVM');
      const sponsored = need(s.sponsored, 'Sponsorship');
      const base = findNetwork('base')!;
      const usdcToken = base.tokens[0]!;
      const ethBefore = BigInt(await jsonRpc<string>(base.rpcUrl!, 'eth_getBalance', [evm.address, 'latest']));
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [evm.address, 10_000n], // 0.01 USDC (6 decimals)
      });
      const hash = await sponsored.evm(base.chainId!, { to: usdcToken.contract as Hex, data });
      const receipt = await poll(() =>
        jsonRpc<{ status: string } | null>(base.rpcUrl!, 'eth_getTransactionReceipt', [hash]),
      );
      const ethAfter = BigInt(await jsonRpc<string>(base.rpcUrl!, 'eth_getBalance', [evm.address, 'latest']));
      const succeeded = receipt.status === '0x1';
      const userPaidGas = ethAfter < ethBefore;
      return {
        ok: succeeded && !userPaidGas,
        detail: `${succeeded ? 'confirmed' : 'reverted'}; wallet ETH ${ethBefore} → ${ethAfter} wei${userPaidGas ? ' (user paid gas!)' : ' (gas sponsored)'}`,
        signature: short(hash),
      };
    },
  },
  {
    id: 'sponsored-sol-transfer',
    group: 'Sponsored',
    name: 'Transfer on Solana Devnet',
    description: 'Signed + sent by Privy with the fee sponsored; wallet holds 0 SOL.',
    async run(s) {
      const sol = need(s.solana, 'Solana');
      const sponsored = need(s.sponsored, 'Sponsorship');
      const rpcUrl = findNetwork('solana')!.rpcUrl!;
      const lamportsBefore = (await jsonRpc<{ value: number }>(rpcUrl, 'getBalance', [sol.address])).value;
      const { message } = await solanaSelfTransferMessage(sol.address);
      const unsigned = new Uint8Array([...compactU16(1), ...new Uint8Array(64), ...message]);
      const signature = await sponsored.solana(SOLANA_DEVNET_CAIP2, unsigned);
      const status = await poll(async () => {
        const r = await jsonRpc<{ value: ({ confirmationStatus?: string; err: unknown } | null)[] }>(
          rpcUrl,
          'getSignatureStatuses',
          [[signature], { searchTransactionHistory: true }],
        );
        const st = r.value[0];
        return st && st.confirmationStatus && st.confirmationStatus !== 'processed' ? st : null;
      });
      const lamportsAfter = (await jsonRpc<{ value: number }>(rpcUrl, 'getBalance', [sol.address])).value;
      const userPaid = lamportsAfter < lamportsBefore;
      return {
        ok: !status.err && !userPaid,
        detail: `${status.err ? 'failed' : status.confirmationStatus}; wallet ${lamportsBefore} → ${lamportsAfter} lamports${userPaid ? ' (user paid fee!)' : ' (fee sponsored)'}`,
        signature: short(signature),
      };
    },
  },
];

