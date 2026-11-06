import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { networkIconUrl, type Network } from '@/lib/networks';

/**
 * Logos are loaded from CDNs (CoinGecko for tokens, DefiLlama for chains) and cached on
 * disk by expo-image, so nothing ships in the bundle. The colored circle + initial shows
 * while loading or if a URL fails.
 */
function RemoteLogo({
  uri,
  size,
  color,
  label,
}: {
  uri?: string;
  size: number;
  color: string;
  label: string;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[round, styles.fallback, { backgroundColor: color }]}>
      <ThemedText style={[styles.initial, { fontSize: size * 0.45, lineHeight: size * 0.6 }]}>
        {label.charAt(0).toUpperCase()}
      </ThemedText>
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, round]}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

export function NetworkIcon({ network, size = 24 }: { network: Network; size?: number }) {
  return <RemoteLogo uri={networkIconUrl(network)} size={size} color={network.color} label={network.name} />;
}

/** Token logo with a small chain badge in the corner, wallet-app style. */
export function TokenIcon({
  network,
  symbol,
  image,
  size = 36,
}: {
  network: Network;
  symbol: string;
  image?: string;
  size?: number;
}) {
  const theme = useTheme();
  const badge = Math.round(size * 0.45);
  return (
    <View style={{ width: size, height: size }}>
      <RemoteLogo uri={image} size={size} color={network.color} label={symbol} />
      <View
        style={[
          styles.badge,
          {
            borderColor: theme.backgroundElement,
            borderRadius: badge / 2 + 2,
            right: -3,
            bottom: -3,
          },
        ]}>
        <NetworkIcon network={network} size={badge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: '#FFFFFF', fontWeight: 700 },
  badge: { position: 'absolute', borderWidth: 2 },
});
