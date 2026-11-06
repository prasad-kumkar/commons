import { usePrivy } from '@privy-io/expo';
import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { NetworkIcon } from '@/components/token-icon';
import { ScreenHeader } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { TestnetBadge } from '@/components/testnet-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useWallets } from '@/hooks/use-wallets';
import { findNetwork, IS_TESTNET, NETWORKS, type WalletKey } from '@/lib/networks';

const QR_SIZE = 220;

export default function DepositScreen() {
  const params = useLocalSearchParams<{ network: string; type?: string }>();
  const { user } = usePrivy();
  const wallets = useWallets();
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState<WalletKey | undefined>(params.type as WalletKey | undefined);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const network = findNetwork(params.network);
  if (!user || !network) return <Redirect href="/" />;

  const types = network.addressTypes;
  const readyTypes = types.filter((t) => wallets[t.key].status === 'ready');
  const addressType = readyTypes.find((t) => t.key === picked) ?? readyTypes[0];
  if (!addressType) return <Redirect href="/" />;
  const slot = wallets[addressType.key];
  if (slot.status !== 'ready') return <Redirect href="/" />;
  const { address } = slot;

  const siblings =
    addressType.key === 'evm'
      ? NETWORKS.filter((n) => n.addressTypes[0]?.key === 'evm' && n.id !== network.id).map((n) => n.name)
      : [];
  const typeLabel = types.length > 1 ? ` ${addressType.label}` : '';

  async function copy() {
    await Clipboard.setStringAsync(address);
    setCopied(true);
  }

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.badge}>
            <NetworkIcon network={network} size={20} />
            <ThemedText type="smallBold">{network.name} network</ThemedText>
            <TestnetBadge />
          </View>

          <ScreenHeader
            title={`Deposit on ${network.name}`}
            subtitle={
              network.tokens.length === 0
                ? `Send ${network.native.symbol} to this address.`
                : `Send ${network.native.symbol} or tokens like ${network.tokens.map((t) => t.symbol).join(', ')} on ${network.name} to this address.`
            }
          />

          {types.length > 1 ? (
            <View style={styles.typePicker}>
              <Segmented
                accessibilityLabel="Address type"
                value={addressType.key}
                onChange={(key) => {
                  setPicked(key);
                  setCopied(false);
                }}
                options={types.map((t) => ({
                  value: t.key,
                  label: t.label,
                  disabled: wallets[t.key].status !== 'ready',
                }))}
              />
              {addressType.note ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {addressType.note}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* QR stays dark-on-white in both themes so every scanner can read it. */}
          <View
            style={styles.qrFrame}
            accessibilityLabel={`QR code for your ${network.name}${typeLabel} address`}>
            <QRCode value={address} size={QR_SIZE} backgroundColor="#FFFFFF" color="#000000" />
          </View>

          <ThemedView type="backgroundElement" style={styles.addressBox}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Your {network.name}
              {typeLabel} address
            </ThemedText>
            <ThemedText selectable style={styles.address}>
              {address}
            </ThemedText>
          </ThemedView>

          <Button title={copied ? 'Copied' : 'Copy address'} onPress={copy} />

          <ThemedView type="backgroundElement" style={styles.warning}>
            <ThemedText type="small">
              Only send assets on the <ThemedText type="smallBold">{network.name}</ThemedText> network. Funds
              sent from another network to this address may be lost.
              {IS_TESTNET ? ' This is a testnet address: never send real funds to it.' : ''}
            </ThemedText>
            {siblings.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                The same address also receives on {siblings.join(', ')}.
              </ThemedText>
            ) : null}
          </ThemedView>

          <Button variant="secondary" title="Done" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  typePicker: { gap: Spacing.two },
  qrFrame: {
    alignSelf: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: '#FFFFFF',
  },
  addressBox: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  address: { fontFamily: 'ui-monospace', fontSize: 15, lineHeight: 22 },
  warning: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});
