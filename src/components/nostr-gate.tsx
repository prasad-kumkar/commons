import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';

/** Renders children once the Nostr identity is unlocked; otherwise progress or a retry. */
export function NostrGate({ children }: { children: ReactNode }) {
  const { status, retry } = useNostr();
  if (status.state === 'ready') return <>{children}</>;
  if (status.state === 'error') {
    return (
      <View style={styles.box}>
        <ThemedText themeColor="danger">{status.message}</ThemedText>
        <Button variant="secondary" title="Try again" onPress={retry} />
      </View>
    );
  }
  return <Loading label="Unlocking your Nostr identity…" />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.box} accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator />
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
});
