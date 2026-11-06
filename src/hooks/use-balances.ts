import { useQueries, useQuery } from '@tanstack/react-query';

import { useWallets } from '@/hooks/use-wallets';
import { fetchBalances, fetchMarkets, toUnits } from '@/lib/balances';
import { NETWORKS, type AddressType, type Network } from '@/lib/networks';

export type Holding = {
  id: string;
  network: Network;
  addressType: AddressType;
  symbol: string;
  amount: number;
  /** null when the price feed has no quote for this token. */
  usd: number | null;
  /** Token logo URL from the price feed, if any. */
  image?: string;
};

const STALE_MS = 60_000;

/**
 * Balances for every (network × address type) the user has, priced in USD.
 * Each source is its own query so one slow/failed RPC doesn't block the rest.
 */
export function useBalances() {
  const wallets = useWallets();

  const sources = NETWORKS.flatMap((network) =>
    network.addressTypes.flatMap((addressType) => {
      const slot = wallets[addressType.key];
      return slot.status === 'ready' ? [{ network, addressType, address: slot.address }] : [];
    }),
  );

  const prices = useQuery({ queryKey: ['markets'], queryFn: fetchMarkets, staleTime: STALE_MS });

  const balances = useQueries({
    queries: sources.map((s) => ({
      queryKey: ['balance', s.network.id, s.address],
      queryFn: () => fetchBalances(s.network, s.address),
      staleTime: STALE_MS,
    })),
  });

  const holdings: Holding[] = [];
  const failed: string[] = [];

  balances.forEach((q, i) => {
    const s = sources[i]!;
    if (q.isError) failed.push(s.network.name);
    for (const { token, raw } of q.data ?? []) {
      if (raw === 0n) continue;
      const amount = toUnits(raw, token.decimals);
      const market = prices.data?.[token.priceId];
      const price = market?.price;
      holdings.push({
        id: `${s.network.id}:${s.addressType.key}:${token.symbol}`,
        network: s.network,
        addressType: s.addressType,
        symbol: token.symbol,
        amount,
        usd: price === undefined ? null : amount * price,
        image: market?.image,
      });
    }
  });

  holdings.sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));

  const totalUsd = holdings.reduce((sum, h) => sum + (h.usd ?? 0), 0);
  const loading = sources.length === 0 || prices.isPending || balances.some((q) => q.isPending);
  const updatedAt = Math.max(prices.dataUpdatedAt, ...balances.map((q) => q.dataUpdatedAt));

  return {
    /** CoinGecko id → logo URL, for places that show tokens without balances. */
    images: Object.fromEntries(
      Object.entries(prices.data ?? {}).flatMap(([id, m]) => (m.image ? [[id, m.image]] : [])),
    ) as Record<string, string>,
    holdings,
    totalUsd,
    loading,
    /** Network names whose balance couldn't be read; the total excludes them. */
    failed: [...new Set(failed)],
    pricesFailed: prices.isError,
    updatedAt: updatedAt > 0 ? updatedAt : null,
    refreshing: prices.isRefetching || balances.some((q) => q.isRefetching),
    refresh: () => Promise.all([prices.refetch(), ...balances.map((q) => q.refetch())]),
  };
}
