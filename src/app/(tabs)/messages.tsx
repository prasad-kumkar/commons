import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { PubkeyAvatar } from '@/components/avatar';
import { Loading, NostrGate } from '@/components/nostr-gate';
import { EmptyState, Screen, TabHeader } from '@/components/screen';
import { ErrorText } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useConversations, useProfile, type Conversation } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { displayName, timeAgo } from '@/lib/nostr';

export default function MessagesTab() {
  const dms = useConversations();
  const [pulling, setPulling] = useState(false);

  async function refresh() {
    setPulling(true);
    await dms.refetch();
    setPulling(false);
  }

  return (
    <Screen header={<TabHeader title="DMs" />} refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}>
      <NostrGate>
        {dms.isPending ? (
          <Loading label="Decrypting messages…" />
        ) : dms.isError ? (
          <ErrorText message="Couldn't load messages. Pull to retry." />
        ) : dms.data && dms.data.length > 0 ? (
          <View>
            {dms.data.map((c) => (
              <ConversationRow key={c.peer} conversation={c} />
            ))}
          </View>
        ) : (
          <EmptyState
            symbol="lock.fill"
            title="No messages yet"
            body="Messages are end-to-end encrypted (NIP-17). Start one from anyone's profile."
          />
        )}
      </NostrGate>
    </Screen>
  );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const theme = useTheme();
  const me = useNostr().pubkey;
  const { data: profile } = useProfile(conversation.peer);
  const { last } = conversation;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/dm/[pubkey]', params: { pubkey: conversation.peer } })}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.backgroundSelected }, pressed && styles.pressed]}>
      <PubkeyAvatar pubkey={conversation.peer} size={48} />
      <View style={styles.text}>
        <View style={styles.top}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {displayName(profile, conversation.peer)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {timeAgo(last.created_at)}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {last.from === me ? 'You: ' : ''}
          {last.content}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: Spacing.half },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontWeight: 700, flexShrink: 1 },
});
