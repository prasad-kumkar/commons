import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { Event } from 'nostr-tools/core';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { PubkeyAvatar } from '@/components/avatar';
import { Loading, NostrGate } from '@/components/nostr-gate';
import { EmptyState, Screen } from '@/components/screen';
import { ErrorText } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNotifications, useProfile } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { displayName, Kind, readTip, replyParent, timeAgo } from '@/lib/nostr';

export default function NotificationsPage() {
  const notifications = useNotifications();
  const [pulling, setPulling] = useState(false);

  async function refresh() {
    setPulling(true);
    await notifications.refetch();
    setPulling(false);
  }

  return (
    <Screen edges={['bottom']} refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}>
      <NostrGate>
        {notifications.isPending ? (
          <Loading />
        ) : notifications.isError ? (
          <ErrorText message="Couldn't load notifications. Pull to retry." />
        ) : notifications.data.length > 0 ? (
          <View>
            {notifications.data.map((e) => (
              <Row key={e.id} event={e} />
            ))}
          </View>
        ) : (
          <EmptyState symbol="bell" title="You're all caught up" body="Replies, mentions, likes and tips will show up here." />
        )}
      </NostrGate>
    </Screen>
  );
}

function describe(event: Event): { symbol: SymbolViewProps['name']; tint: string; verb: string; target?: string } {
  if (event.kind === Kind.Reaction) {
    const target = event.tags.filter((t) => t[0] === 'e').at(-1)?.[1];
    const tip = readTip(event);
    if (tip) return { symbol: 'dollarsign.circle.fill', tint: '#30A46C', verb: `tipped you ${tip.amount} ${tip.symbol}`, target };
    return { symbol: 'heart.fill', tint: '#E5484D', verb: 'liked your post', target };
  }
  const parent = replyParent(event);
  return parent
    ? { symbol: 'arrowshape.turn.up.left.fill', tint: '#3c87f7', verb: 'replied', target: event.id }
    : { symbol: 'at', tint: '#8E4EC6', verb: 'mentioned you', target: event.id };
}

function Row({ event }: { event: Event }) {
  const theme = useTheme();
  const { data: profile } = useProfile(event.pubkey);
  const d = describe(event);
  return (
    <Pressable
      disabled={!d.target}
      onPress={() => d.target && router.push({ pathname: '/note/[id]', params: { id: d.target } })}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.backgroundSelected }, pressed && styles.pressed]}>
      <View>
        <PubkeyAvatar pubkey={event.pubkey} size={40} />
        <View style={[styles.badge, { backgroundColor: theme.background }]}>
          <SymbolView name={d.symbol} size={16} tintColor={d.tint} />
        </View>
      </View>
      <View style={styles.text}>
        <ThemedText numberOfLines={2}>
          <ThemedText style={styles.name}>{displayName(profile, event.pubkey)}</ThemedText> {d.verb}
          <ThemedText type="small" themeColor="textSecondary">
            {'  '}
            {timeAgo(event.created_at)}
          </ThemedText>
        </ThemedText>
        {event.kind === Kind.Note ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {event.content}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  badge: { position: 'absolute', right: -4, bottom: -4, borderRadius: 10, padding: 2 },
  text: { flex: 1, gap: Spacing.half },
  name: { fontWeight: 700 },
});
