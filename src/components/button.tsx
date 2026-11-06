import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner and blocks presses; pass the in-progress label as `title`. */
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'link';
};

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;

  if (variant === 'link') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        onPress={onPress}
        disabled={inactive}
        hitSlop={Spacing.two}
        style={({ pressed }) => [(pressed || inactive) && styles.dim]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title}
        </ThemedText>
      </Pressable>
    );
  }

  const primary = variant === 'primary';
  const fg = primary ? theme.background : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: primary ? theme.text : theme.backgroundElement },
        pressed && styles.pressed,
        disabled && !loading && styles.dim,
      ]}>
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : null}
        <ThemedText style={{ color: fg, fontWeight: 600 }}>{title}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pressed: { opacity: 0.8 },
  dim: { opacity: 0.4 },
});
