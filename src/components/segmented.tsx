import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentOption<T extends string> = { value: T; label: string; disabled?: boolean };

/** Small segmented control (iOS-style pill toggle) for 2–3 options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: !!o.disabled }}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.background }, o.disabled && styles.dim]}>
            <View>
              <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
                {o.label}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: Spacing.half, borderRadius: Spacing.three, gap: Spacing.half },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three - Spacing.half,
  },
  dim: { opacity: 0.4 },
});
