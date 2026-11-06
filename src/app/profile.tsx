import { usePrivy } from '@privy-io/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ErrorText } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shortAddress } from '@/lib/networks';
import { describeUser } from '@/lib/user';

type Account = { type: string } & Record<string, unknown>;

const LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'Phone',
  wallet: 'Wallet',
  smart_wallet: 'Smart wallet',
  passkey: 'Passkey',
  google_oauth: 'Google',
  apple_oauth: 'Apple',
  twitter_oauth: 'X',
  github_oauth: 'GitHub',
  discord_oauth: 'Discord',
  farcaster: 'Farcaster',
  telegram: 'Telegram',
};

const CHAINS: Record<string, string> = {
  ethereum: 'Ethereum',
  solana: 'Solana',
  'bitcoin-segwit': 'Bitcoin SegWit',
  'bitcoin-taproot': 'Bitcoin Taproot',
};

function str(v: unknown) {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function describeAccount(account: Account) {
  const label =
    LABELS[account.type] ??
    account.type.replace(/_oauth$/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  if (account.type === 'wallet' || account.type === 'smart_wallet') {
    const address = str(account.address);
    const chain = CHAINS[str(account.chain_type) ?? ''] ?? str(account.chain_type);
    return { label, detail: address && [chain, shortAddress(address)].filter(Boolean).join(' · ') };
  }
  return {
    label,
    detail: str(account.email) ?? str(account.address) ?? str(account.phoneNumber) ?? str(account.username),
  };
}

export default function ProfilePage() {
  const { user, logout } = usePrivy();
  const theme = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const { name, handle, initials } = describeUser(user);
  const accounts = (user.linked_accounts as unknown as Account[]).map(describeAccount);

  async function onLogout() {
    setLoggingOut(true);
    setError(null);
    try {
      // The auth gate in the root layout swaps to sign-in once the user is cleared.
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log out. Try again.');
      setLoggingOut(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.identity}>
        <Avatar initials={initials} size={72} />
        <View style={styles.identityText}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {name}
          </ThemedText>
          {handle ? (
            <ThemedText themeColor="textSecondary" numberOfLines={1}>
              {handle}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Linked accounts
        </ThemedText>
        {accounts.map((a, i) => (
          <View
            key={`${a.label}-${a.detail ?? i}`}
            style={[
              styles.row,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.backgroundSelected,
                paddingTop: Spacing.two,
              },
            ]}>
            <ThemedText style={styles.rowLabel}>{a.label}</ThemedText>
            {a.detail ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.rowDetail}>
                {a.detail}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Privy user ID
        </ThemedText>
        <ThemedText type="code" selectable>
          {user.id}
        </ThemedText>
      </ThemedView>

      <Button variant="secondary" title="Signature lab" onPress={() => router.push('/signatures')} />
      <Button
        variant="secondary"
        title={loggingOut ? 'Logging out…' : 'Log out'}
        loading={loggingOut}
        onPress={onLogout}
      />
      <ErrorText message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  identityText: { flex: 1, gap: Spacing.half },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  rowLabel: { fontWeight: 600 },
  rowDetail: { flexShrink: 1, textAlign: 'right' },
});
