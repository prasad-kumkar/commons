/**
 * Keyless balance + price reads. Everything here is plain fetch so it runs in Hermes
 * without extra SDKs. Endpoints are public and rate limited; swap `rpcUrl`s in
 * `networks.ts` for a paid provider before launch.
 */
import { PRICE_IDS, type Network, type Token } from '@/lib/networks';

/** Raw on-chain amount in base units, kept as bigint so nothing is lost before display. */
export type RawBalance = { token: Token; raw: bigint };

const TIMEOUT_MS = 12_000;

// AbortController + setTimeout rather than AbortSignal.timeout, which Hermes may lack.
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getJson<T>(url: string): Promise<T> {
  return fetchJson<T>(url);
}

type RpcResult<T> = { id: number; result?: T; error?: { message: string } };

/** Sends a JSON-RPC batch and returns results in request order, throwing on any error. */
async function rpcBatch(url: string, calls: { method: string; params: unknown[] }[]) {
  const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i, ...c }));
  const results = await postJson<RpcResult<unknown>[]>(url, body);
  const byId = new Map(results.map((r) => [r.id, r]));
  return calls.map((_, i) => {
    const r = byId.get(i);
    if (!r || r.error) throw new Error(r?.error?.message ?? 'Missing RPC result');
    return r.result;
  });
}

const BALANCE_OF = '0x70a08231';

async function evmBalances(network: Network, address: string): Promise<RawBalance[]> {
  const padded = address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const results = await rpcBatch(network.rpcUrl!, [
    { method: 'eth_getBalance', params: [address, 'latest'] },
    ...network.tokens.map((t) => ({
      method: 'eth_call',
      params: [{ to: t.contract, data: `${BALANCE_OF}${padded}` }, 'latest'],
    })),
  ]);
  const toBig = (hex: unknown) => BigInt(typeof hex === 'string' && hex !== '0x' ? hex : '0x0');
  return [
    { token: network.native, raw: toBig(results[0]) },
    ...network.tokens.map((token, i) => ({ token, raw: toBig(results[i + 1]) })),
  ];
}

type SolTokenAccounts = {
  value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[];
};

async function solanaBalances(network: Network, address: string): Promise<RawBalance[]> {
  const results = await rpcBatch(network.rpcUrl!, [
    { method: 'getBalance', params: [address] },
    ...network.tokens.map((t) => ({
      method: 'getTokenAccountsByOwner',
      params: [address, { mint: t.contract }, { encoding: 'jsonParsed' }],
    })),
  ]);
  const lamports = (results[0] as { value: number }).value;
  return [
    { token: network.native, raw: BigInt(lamports) },
    ...network.tokens.map((token, i) => {
      // A wallet can hold several accounts for the same mint; sum them.
      const accounts = (results[i + 1] as SolTokenAccounts).value;
      const raw = accounts.reduce(
        (sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount),
        0n,
      );
      return { token, raw };
    }),
  ];
}

type MempoolStats = { funded_txo_sum: number; spent_txo_sum: number };
type MempoolAddress = { chain_stats: MempoolStats; mempool_stats: MempoolStats };

async function bitcoinBalances(network: Network, address: string): Promise<RawBalance[]> {
  const data = await getJson<MempoolAddress>(`${network.esploraUrl}/address/${address}`);
  // Include unconfirmed so a fresh deposit shows up immediately.
  const sats =
    data.chain_stats.funded_txo_sum -
    data.chain_stats.spent_txo_sum +
    data.mempool_stats.funded_txo_sum -
    data.mempool_stats.spent_txo_sum;
  return [{ token: network.native, raw: BigInt(sats) }];
}

export function fetchBalances(network: Network, address: string): Promise<RawBalance[]> {
  if (network.id === 'bitcoin') return bitcoinBalances(network, address);
  if (network.id === 'solana') return solanaBalances(network, address);
  return evmBalances(network, address);
}

export type Market = { price: number; image?: string };
export type Markets = Record<string, Market>;

/** One call for USD price + token logo URL (CoinGecko CDN), keyed by CoinGecko id. */
export async function fetchMarkets(): Promise<Markets> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${PRICE_IDS.join(',')}`;
  const rows = await getJson<{ id: string; current_price: number | null; image?: string }[]>(url);
  return Object.fromEntries(
    rows.flatMap((r) =>
      typeof r.current_price === 'number' ? [[r.id, { price: r.current_price, image: r.image }]] : [],
    ),
  );
}

/** Integer base units → decimal number for display/maths (fine at wallet-sized amounts). */
export function toUnits(raw: bigint, decimals: number): number {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0');
  return Number(`${whole}.${frac}`);
}

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUsd(value: number) {
  return usdFormat.format(value);
}

export function formatAmount(value: number, symbol: string) {
  const digits = value === 0 ? 0 : value < 1 ? 6 : value < 1000 ? 4 : 2;
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
  return `${n} ${symbol}`;
}
