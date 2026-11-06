import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { NetworkIcon } from '@/components/token-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWallets, type WalletSlot } from '@/hooks/use-wallets';
import { NETWORKS, shortAddress, type WalletKey } from '@/lib/networks';

function SlotDetail({ slot, extraTypes }: { slot: WalletSlot; extraTypes: number }) {
  if (slot.status === 'creating') return <ActivityIndicator size="small" />;
  if (slot.status === 'error') {
    return (
      <ThemedText type="small" themeColor="danger">
        Unavailable
      </ThemedText>
    );
  }
  return (
    <View style={styles.detailText}>
      <ThemedText type="code" themeColor="textSecondary">
        {shortAddress(slot.address)}
      </ThemedText>
      {extraTypes > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          +{extraTypes} address type{extraTypes > 1 ? 's' : ''}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** List of deposit networks; each row opens the deposit sheet with QR + copy. */
export function DepositCard() {
  const wallets = useWallets();
  const theme = useTheme();

  const errors = (Object.keys(wallets) as WalletKey[])
    .map((key) => wallets[key])
    .flatMap((slot) => (slot.status === 'error' ? [slot.message] : []));

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.heading}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Deposit
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Pick the network you&apos;re sending from.
        </ThemedText>
      </View>
      {NETWORKS.map((network, i) => {
        // The row opens the first ready address type; the sheet lets you switch types.
        const types = network.addressTypes;
        const primary = types.find((t) => wallets[t.key].status === 'ready') ?? types[0]!;
        const slot = wallets[primary.key];
        const ready = slot.status === 'ready';
        const extraTypes = types.filter(
          (t) => t.key !== primary.key && wallets[t.key].status === 'ready',
        ).length;
        return (
          <Pressable
            key={network.id}
            accessibilityRole="button"
            accessibilityLabel={`Deposit on ${network.name}`}
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={() =>
              router.push({
                pathname: '/deposit/[network]',
                params: { network: network.id, type: primary.key },
              })
            }
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
              pressed && { opacity: 0.6 },
            ]}>
            <View style={styles.name}>
              <NetworkIcon network={network} />
              <ThemedText style={styles.nameText}>{network.name}</ThemedText>
            </View>
            <View style={styles.detail}>
              <SlotDetail slot={slot} extraTypes={extraTypes} />
              {ready ? (
                <ThemedText themeColor="textSecondary" style={styles.chevron}>
                  ›
                </ThemedText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {errors.map((message) => (
        <ThemedText key={message} type="small" themeColor="textSecondary">
          {message}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  heading: { gap: Spacing.half, marginBottom: Spacing.one },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  name: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  nameText: { fontWeight: 600 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  detailText: { alignItems: 'flex-end' },
  hint: { fontSize: 12, lineHeight: 16 },
  chevron: { fontSize: 22, lineHeight: 24 },
});
