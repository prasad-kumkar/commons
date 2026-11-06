/**
 * Networks a user can deposit to, and the address type(s) each accepts.
 *
 * - EVM networks share one address (same secp256k1 key).
 * - Solana has its own wallet.
 * - Bitcoin has two Privy-supported address types: Native SegWit and Taproot.
 *   Privy does not create legacy (1…) or nested SegWit (3…) addresses.
 *
 * `EXPO_PUBLIC_CHAIN_ENV` picks testnet (default) or mainnet. Same keys either way:
 * EVM/Solana addresses are identical, Bitcoin is re-encoded with the testnet prefix.
 */
export type ChainEnv = 'testnet' | 'mainnet';

export const CHAIN_ENV: ChainEnv =
  process.env.EXPO_PUBLIC_CHAIN_ENV === 'mainnet' ? 'mainnet' : 'testnet';
export const IS_TESTNET = CHAIN_ENV === 'testnet';

export type WalletKey = 'evm' | 'solana' | 'bitcoin-segwit' | 'bitcoin-taproot';

export type AddressType = {
  key: WalletKey;
  /** Short label for toggles and rows, e.g. "Native SegWit". */
  label: string;
  /** One-line guidance on when to use this type. */
  note?: string;
};

export type Token = {
  symbol: string;
  decimals: number;
  /** CoinGecko id used for USD pricing (mainnet price, even on testnet). */
  priceId: string;
  /** ERC-20 contract or SPL mint; omitted for the native token. */
  contract?: string;
};

export type Network = {
  id: string;
  name: string;
  /** Brand color; fallback while the logo loads. */
  color: string;
  /** Chain logo slug on DefiLlama's icon CDN (icons.llamao.fi). */
  icon: string;
  addressTypes: AddressType[];
  native: Token;
  tokens: Token[];
  /** EVM chain id. */
  chainId?: number;
  /** JSON-RPC endpoint for EVM/Solana reads. */
  rpcUrl?: string;
  /** Esplora-style API base (mempool.space) for Bitcoin. */
  esploraUrl?: string;
  /** Address page on a block explorer; `{address}` is substituted. */
  explorer: string;
};

const EVM: AddressType[] = [{ key: 'evm', label: 'EVM' }];
const usdc = (contract: string): Token => ({ symbol: 'USDC', decimals: 6, priceId: 'usd-coin', contract });

function eth(): Token {
  return { symbol: 'ETH', decimals: 18, priceId: 'ethereum' };
}

const BITCOIN_TYPES = (prefix: 'bc1' | 'tb1'): AddressType[] => [
  {
    key: 'bitcoin-segwit',
    label: 'Native SegWit',
    note: `Starts with ${prefix}q. Works with almost every wallet and exchange.`,
  },
  {
    key: 'bitcoin-taproot',
    label: 'Taproot',
    note: `Starts with ${prefix}p. Newer format; some older wallets and exchanges can’t send to it.`,
  },
];

const MAINNET: Network[] = [
  {
    id: 'ethereum',
    icon: 'ethereum',
    name: 'Ethereum',
    color: '#627EEA',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')],
    chainId: 1,
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io/address/{address}',
  },
  {
    id: 'base',
    icon: 'base',
    name: 'Base',
    color: '#0052FF',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')],
    chainId: 8453,
    rpcUrl: 'https://base-rpc.publicnode.com',
    explorer: 'https://basescan.org/address/{address}',
  },
  {
    id: 'arbitrum',
    icon: 'arbitrum',
    name: 'Arbitrum',
    color: '#28A0F0',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')],
    chainId: 42161,
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    explorer: 'https://arbiscan.io/address/{address}',
  },
  {
    id: 'optimism',
    icon: 'optimism',
    name: 'Optimism',
    color: '#FF0420',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85')],
    chainId: 10,
    rpcUrl: 'https://optimism-rpc.publicnode.com',
    explorer: 'https://optimistic.etherscan.io/address/{address}',
  },
  {
    id: 'polygon',
    icon: 'polygon',
    name: 'Polygon',
    color: '#8247E5',
    addressTypes: EVM,
    native: { symbol: 'POL', decimals: 18, priceId: 'polygon-ecosystem-token' },
    tokens: [usdc('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359')],
    chainId: 137,
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    explorer: 'https://polygonscan.com/address/{address}',
  },
  {
    id: 'solana',
    icon: 'solana',
    name: 'Solana',
    color: '#14F195',
    addressTypes: [{ key: 'solana', label: 'Solana' }],
    native: { symbol: 'SOL', decimals: 9, priceId: 'solana' },
    tokens: [usdc('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')],
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://explorer.solana.com/address/{address}',
  },
  {
    id: 'bitcoin',
    icon: 'bitcoin',
    name: 'Bitcoin',
    color: '#F7931A',
    addressTypes: BITCOIN_TYPES('bc1'),
    native: { symbol: 'BTC', decimals: 8, priceId: 'bitcoin' },
    tokens: [],
    esploraUrl: 'https://mempool.space/api',
    explorer: 'https://mempool.space/address/{address}',
  },
];

// Circle's official testnet USDC on each chain; verified via symbol()/decimals().
const TESTNET: Network[] = [
  {
    id: 'ethereum',
    icon: 'ethereum',
    name: 'Sepolia',
    color: '#627EEA',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238')],
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io/address/{address}',
  },
  {
    id: 'base',
    icon: 'base',
    name: 'Base Sepolia',
    color: '#0052FF',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0x036CbD53842c5426634e7929541eC2318f3dCF7e')],
    chainId: 84532,
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.basescan.org/address/{address}',
  },
  {
    id: 'arbitrum',
    icon: 'arbitrum',
    name: 'Arbitrum Sepolia',
    color: '#28A0F0',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d')],
    chainId: 421614,
    rpcUrl: 'https://arbitrum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.arbiscan.io/address/{address}',
  },
  {
    id: 'optimism',
    icon: 'optimism',
    name: 'OP Sepolia',
    color: '#FF0420',
    addressTypes: EVM,
    native: eth(),
    tokens: [usdc('0x5fd84259d66Cd46123540766Be93DFE6D43130D7')],
    chainId: 11155420,
    rpcUrl: 'https://optimism-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia-optimism.etherscan.io/address/{address}',
  },
  {
    id: 'polygon',
    icon: 'polygon',
    name: 'Polygon Amoy',
    color: '#8247E5',
    addressTypes: EVM,
    native: { symbol: 'POL', decimals: 18, priceId: 'polygon-ecosystem-token' },
    tokens: [usdc('0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582')],
    chainId: 80002,
    rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
    explorer: 'https://amoy.polygonscan.com/address/{address}',
  },
  {
    id: 'solana',
    icon: 'solana',
    name: 'Solana Devnet',
    color: '#14F195',
    addressTypes: [{ key: 'solana', label: 'Solana' }],
    native: { symbol: 'SOL', decimals: 9, priceId: 'solana' },
    tokens: [usdc('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')],
    rpcUrl: 'https://api.devnet.solana.com',
    explorer: 'https://explorer.solana.com/address/{address}?cluster=devnet',
  },
  {
    id: 'bitcoin',
    icon: 'bitcoin',
    name: 'Bitcoin Testnet4',
    color: '#F7931A',
    addressTypes: BITCOIN_TYPES('tb1'),
    native: { symbol: 'tBTC', decimals: 8, priceId: 'bitcoin' },
    tokens: [],
    esploraUrl: 'https://mempool.space/testnet4/api',
    explorer: 'https://mempool.space/testnet4/address/{address}',
  },
];

export const NETWORKS: Network[] = IS_TESTNET ? TESTNET : MAINNET;

export const PRICE_IDS = [
  ...new Set(NETWORKS.flatMap((n) => [n.native.priceId, ...n.tokens.map((t) => t.priceId)])),
];

export function findNetwork(id: string | undefined) {
  return NETWORKS.find((n) => n.id === id);
}

export function networkIconUrl(network: Network) {
  return `https://icons.llamao.fi/icons/chains/rsz_${network.icon}.jpg`;
}

export function explorerUrl(network: Network, address: string) {
  return network.explorer.replace('{address}', address);
}

export function shortAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
