import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Standard page shell for tabs and pushed pages: safe area, scroll, consistent gutters.
 * Tabs render their own top bar via `header`; pushed pages get the native stack header,
 * so they pass `edges={['bottom']}`.
 */
export function Screen({
  header,
  children,
  edges = ['top'],
  scroll = true,
  refreshControl,
}: {
  header?: ReactNode;
  children: ReactNode;
  edges?: ('top' | 'bottom')[];
  scroll?: boolean;
  /** Pull-to-refresh; only used when `scroll` is true. */
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const body = <View style={styles.content}>{children}</View>;
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={edges}>
        {header ? <View style={styles.header}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
            // Lets iOS inset content above the native tab bar so the last row isn't hidden.
            contentInsetAdjustmentBehavior="automatic">
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.fill, styles.scroll]}>{body}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/** Top bar for tab screens: optional left/right accessories around a large title. */
export function TabHeader({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.tabHeaderSide}>
        {left}
        <ThemedText type="subtitle" accessibilityRole="header">
          {title}
        </ThemedText>
      </View>
      {right}
    </View>
  );
}

export function EmptyState({
  symbol,
  title,
  body,
}: {
  symbol: SymbolViewProps['name'];
  title: string;
  body: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <SymbolView name={symbol} size={40} tintColor={theme.textSecondary} />
      <ThemedText type="smallBold" style={styles.emptyTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
        {body}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  scroll: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  tabHeaderSide: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six, paddingHorizontal: Spacing.four },
  emptyTitle: { fontSize: 17, marginTop: Spacing.two },
  emptyBody: { textAlign: 'center' },
});
