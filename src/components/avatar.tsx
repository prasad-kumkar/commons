import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Initials avatar; swap for the Nostr profile picture once profiles exist. */
export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText style={{ fontSize: size * 0.4, lineHeight: size * 0.5, fontWeight: 700 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
