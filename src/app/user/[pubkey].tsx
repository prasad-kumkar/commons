import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { PubkeyAvatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { NoteCard } from '@/components/note-card';
import { Loading } from '@/components/nostr-gate';
import { FollowButton } from '@/components/person-row';
import { EmptyState, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useContacts, useEngagement, useProfile, useUserNotes } from '@/hooks/use-social';
import { shortAddress } from '@/lib/networks';
import { displayName, npub, parsePubkey } from '@/lib/nostr';

export default function UserPage() {
  const params = useLocalSearchParams<{ pubkey: string }>();
  const pubkey = parsePubkey(params.pubkey) ?? params.pubkey;
  const me = useNostr().pubkey;
  const isMe = pubkey === me;
  const { data: profile } = useProfile(pubkey);
  const contacts = useContacts(pubkey);
  const notes = useUserNotes(pubkey);
  const engagement = useEngagement(notes.data?.map((n) => n.id) ?? []);
  const [copied, setCopied] = useState(false);
  const [pulling, setPulling] = useState(false);
  const name = displayName(profile, pubkey);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function refresh() {
    setPulling(true);
    await notes.refetch();
    await engagement.refetch();
    setPulling(false);
  }

  return (
    <Screen edges={['bottom']} refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: name }} />
      <View style={styles.header}>
        <PubkeyAvatar pubkey={pubkey} size={84} />
        <View style={styles.headerText}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.name}>
            {name}
          </ThemedText>
          {profile?.nip05 ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {profile.nip05.replace(/^_@/, '')}
            </ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy npub"
            onPress={async () => {
              await Clipboard.setStringAsync(npub(pubkey));
              setCopied(true);
            }}>
            <ThemedText type="code" themeColor="textSecondary">
              {copied ? 'Copied npub' : `${npub(pubkey).slice(0, 16)}…`}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {profile?.about ? <ThemedText>{profile.about}</ThemedText> : null}

      <View style={styles.stats}>
        <ThemedText type="small" themeColor="textSecondary">
          <ThemedText type="smallBold">{contacts.data?.follows.length ?? '–'}</ThemedText> following
        </ThemedText>
        {profile?.evm_address ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tips to <ThemedText type="code">{shortAddress(profile.evm_address)}</ThemedText>
          </ThemedText>
        ) : null}
      </View>

      {isMe ? (
        <Button variant="secondary" title="Edit profile" onPress={() => router.push('/edit-profile')} />
      ) : (
        <View style={styles.actions}>
          <FollowButton pubkey={pubkey} />
          <View style={styles.flex}>
            <Button
              variant="secondary"
              title="Message"
              onPress={() => router.push({ pathname: '/dm/[pubkey]', params: { pubkey } })}
            />
          </View>
          {profile?.evm_address ? (
            <View style={styles.flex}>
              <Button
                variant="secondary"
                title="Tip"
                onPress={() => router.push({ pathname: '/tip/[pubkey]', params: { pubkey } })}
              />
            </View>
          ) : null}
        </View>
      )}

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
        Posts
      </ThemedText>
      {notes.isPending ? (
        <Loading />
      ) : notes.data && notes.data.length > 0 ? (
        <View>
          {notes.data.map((n) => (
            <NoteCard key={n.id} note={n} stats={engagement.data?.[n.id]} />
          ))}
        </View>
      ) : (
        <EmptyState symbol="text.bubble" title="No posts yet" body={isMe ? 'Share your first post from Home.' : `${name} hasn't posted recently.`} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerText: { flex: 1, gap: Spacing.half },
  name: { fontSize: 26, lineHeight: 32 },
  stats: { flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  section: { marginTop: Spacing.two },
});
