import { PrivyProvider, usePrivy } from '@privy-io/expo';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { WalletsProvider } from '@/hooks/use-wallets';
import { QueryProvider } from '@/lib/query-client';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

// EXPO_PUBLIC_* vars are inlined at build time, so they must be referenced literally.
const appId = requireEnv('EXPO_PUBLIC_PRIVY_APP_ID', process.env.EXPO_PUBLIC_PRIVY_APP_ID);
const clientId = requireEnv('EXPO_PUBLIC_PRIVY_CLIENT_ID', process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <PrivyProvider appId={appId} clientId={clientId}>
      <QueryProvider>
        <WalletsProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootNavigator />
          </ThemeProvider>
        </WalletsProvider>
      </QueryProvider>
    </PrivyProvider>
  );
}

/** Auth gate: signed-out users only reach sign-in; signed-in users get the app. */
function RootNavigator() {
  const { isReady, user } = usePrivy();

  if (!isReady) {
    return (
      <ThemedView style={styles.loading} accessibilityLabel="Loading">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  const signedIn = !!user;
  return (
    <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
        <Stack.Screen name="signatures" options={{ headerShown: true, title: 'Signature lab' }} />
        <Stack.Screen name="deposit/[network]" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
