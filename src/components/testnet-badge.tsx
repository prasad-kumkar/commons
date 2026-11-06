import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { IS_TESTNET } from '@/lib/networks';

/** Visible on every money screen while the app points at testnets. */
export function TestnetBadge() {
  if (!IS_TESTNET) return null;
  return (
    <View style={styles.badge} accessibilityLabel="Testnet mode">
      <ThemedText type="smallBold" style={styles.text}>
        TESTNET
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FFB224',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  text: { color: '#1F1300', fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
});
