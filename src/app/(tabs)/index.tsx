import { usePrivy } from '@privy-io/expo';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar, PubkeyAvatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { NoteCard } from '@/components/note-card';
import { Loading, NostrGate } from '@/components/nostr-gate';
import { PersonRow } from '@/components/person-row';
import { EmptyState, Screen, TabHeader } from '@/components/screen';
import { ErrorText } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useContacts, useEngagement, useFeed, useFollow } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { SUGGESTED } from '@/lib/nostr';
import { describeUser } from '@/lib/user';

export default function HomeTab() {
  const { user } = usePrivy();
  const { pubkey } = useNostr();
  const [pulling, setPulling] = useState(false);
  const contacts = useContacts(pubkey);
  const follows = contacts.data?.follows;
  const authors = follows && follows.length > 0 && pubkey ? [...follows, pubkey] : undefined;
  const feed = useFeed(authors);
  const ids = feed.data?.map((e) => e.id) ?? [];
  const engagement = useEngagement(ids);

  if (!user) return null;
  const { initials } = describeUser(user);

  async function refresh() {
    setPulling(true);
    await Promise.all([contacts.refetch(), feed.refetch()]);
    await engagement.refetch();
    setPulling(false);
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
      header={
        <TabHeader
          title="Home"
          left={
            <HeaderButton label="Open profile" onPress={() => router.push('/profile')}>
              {pubkey ? <PubkeyAvatar pubkey={pubkey} size={36} /> : <Avatar initials={initials} />}
            </HeaderButton>
          }
          right={
            <View style={styles.headerRight}>
              <HeaderIcon symbol="square.and.pencil" label="New post" onPress={() => router.push('/compose')} />
              <HeaderIcon symbol="bell" label="Open notifications" onPress={() => router.push('/notifications')} />
            </View>
          }
        />
      }>
      <NostrGate>
        {contacts.isPending ? (
          <Loading />
        ) : !authors ? (
          <Welcome />
        ) : feed.isPending ? (
          <Loading label="Loading your feed…" />
        ) : feed.isError ? (
          <ErrorText message="Couldn't reach Nostr relays. Pull to retry." />
        ) : feed.data && feed.data.length > 0 ? (
          <View>
            {feed.data.map((note) => (
              <NoteCard key={note.id} note={note} stats={engagement.data?.[note.id]} />
            ))}
          </View>
        ) : (
          <EmptyState symbol="text.bubble" title="Quiet in here" body="People you follow haven't posted recently." />
        )}
      </NostrGate>
    </Screen>
  );
}

/** First run: nobody followed yet, so offer a few well-known accounts. */
function Welcome() {
  const follow = useFollow();
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeText}>
        <ThemedText type="smallBold" style={styles.welcomeTitle}>
          Welcome to Commons
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Follow a few people to fill your feed. You can find anyone on Nostr from Search.
        </ThemedText>
      </View>
      {SUGGESTED.map((pk) => (
        <PersonRow key={pk} pubkey={pk} />
      ))}
      <Button
        title={follow.isPending ? 'Following…' : 'Follow all'}
        loading={follow.isPending}
        onPress={() => follow.mutate({ target: SUGGESTED, follow: true })}
      />
      <ErrorText message={follow.error ? "Couldn't update your follows. Try again." : null} />
    </View>
  );
}

function HeaderButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Spacing.two}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {children}
    </Pressable>
  );
}

function HeaderIcon({ symbol, label, onPress }: { symbol: SymbolViewProps['name']; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <HeaderButton label={label} onPress={onPress}>
      <View style={styles.iconButton}>
        <SymbolView name={symbol} size={24} tintColor={theme.text} />
      </View>
    </HeaderButton>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', gap: Spacing.two },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  welcome: { gap: Spacing.two },
  welcomeText: { gap: Spacing.one, marginBottom: Spacing.two },
  welcomeTitle: { fontSize: 20, lineHeight: 26 },
});
