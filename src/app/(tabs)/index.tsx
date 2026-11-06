import { usePrivy } from '@privy-io/expo';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmptyState, Screen, TabHeader } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeUser } from '@/lib/user';

export default function HomeTab() {
  const { user } = usePrivy();
  const theme = useTheme();
  if (!user) return null;
  const { initials } = describeUser(user);

  return (
    <Screen
      header={
        <TabHeader
          title="Home"
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              hitSlop={Spacing.two}
              onPress={() => router.push('/profile')}
              style={({ pressed }) => pressed && styles.pressed}>
              <Avatar initials={initials} />
            </Pressable>
          }
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
              hitSlop={Spacing.two}
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <SymbolView name="bell" size={24} tintColor={theme.text} />
            </Pressable>
          }
        />
      }>
      <EmptyState
        symbol="text.bubble"
        title="Your feed is empty"
        body="Posts from people you follow on Nostr will show up here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
