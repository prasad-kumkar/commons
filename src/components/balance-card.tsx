import { StyleSheet, View } from 'react-native';

import { TokenIcon } from '@/components/token-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBalances } from '@/hooks/use-balances';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatUsd } from '@/lib/balances';
import { IS_TESTNET } from '@/lib/networks';

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

/** Total in USD plus a per-asset breakdown; pull-to-refresh lives on the parent screen. */
export function BalanceCard({ balances }: { balances: ReturnType<typeof useBalances> }) {
  const theme = useTheme();
  const { holdings, totalUsd, loading, failed, pricesFailed, updatedAt } = balances;
  const hasFunds = holdings.length > 0;

  let status: string;
  if (loading) status = 'Loading balances…';
  else if (failed.length > 0) status = `Couldn't load ${failed.join(', ')}. Pull down to retry.`;
  else if (pricesFailed) status = "Prices are unavailable, so the total may be incomplete.";
  else status = updatedAt ? `Updated ${timeAgo(updatedAt)} · pull down to refresh` : '';

  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Total balance
        </ThemedText>
        <ThemedText
          type="subtitle"
          style={loading && styles.loading}
          accessibilityLabel={loading ? 'Loading total balance' : `Total balance ${formatUsd(totalUsd)}`}>
          {loading ? '$—' : formatUsd(totalUsd)}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={failed.length > 0 || pricesFailed ? 'danger' : 'textSecondary'}>
          {status}
        </ThemedText>
        {IS_TESTNET ? (
          <ThemedText type="small" themeColor="textSecondary">
            Testnet funds have no real value; USD is shown at mainnet prices for reference.
          </ThemedText>
        ) : null}
      </ThemedView>

      {!loading ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Assets
          </ThemedText>
          {hasFunds ? (
            holdings.map((h, i) => (
              <View
                key={h.id}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                ]}>
                <View style={styles.rowLeft}>
                  <TokenIcon network={h.network} symbol={h.symbol} image={h.image} />
                  <View>
                    <ThemedText style={styles.symbol}>{h.symbol}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {h.network.name}
                      {h.network.addressTypes.length > 1 ? ` · ${h.addressType.label}` : ''}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText style={styles.symbol}>{h.usd === null ? '—' : formatUsd(h.usd)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatAmount(h.amount, h.symbol)}
                  </ThemedText>
                </View>
              </View>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No funds yet. Deposit to any address below to get started.
            </ThemedText>
          )}
        </ThemedView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  loading: { opacity: 0.4 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexShrink: 1 },
  rowRight: { alignItems: 'flex-end' },
  symbol: { fontWeight: 600 },
});
