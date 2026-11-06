import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import type { Event } from 'nostr-tools/core';
import * as nip27 from 'nostr-tools/nip27';
import { Fragment, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PubkeyAvatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useProfile, useReact, type Engagement } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { displayName, timeAgo } from '@/lib/nostr';

const LINK = '#3c87f7';

/** Opens a note's thread with the event already in cache, so it renders instantly. */
export function useOpenNote() {
  const qc = useQueryClient();
  return (note: Event) => {
    qc.setQueryData(['note', note.id], note);
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  };
}

export function NoteCard({
  note,
  stats,
  compact,
  onPress,
}: {
  note: Event;
  stats?: Engagement[string];
  /** Thread/detail view: larger text, no truncation, not pressable. */
  compact?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { data: profile } = useProfile(note.pubkey);
  const react = useReact();
  const open = useOpenNote();
  const name = displayName(profile, note.pubkey);
  const mine = useNostr().pubkey === note.pubkey;

  function openUser() {
    router.push({ pathname: '/user/[pubkey]', params: { pubkey: note.pubkey } });
  }
  function reply() {
    qc.setQueryData(['note', note.id], note);
    router.push({ pathname: '/compose', params: { reply: note.id } });
  }
  function tip() {
    qc.setQueryData(['note', note.id], note);
    router.push({ pathname: '/tip/[pubkey]', params: { pubkey: note.pubkey, note: note.id } });
  }

  return (
    <Pressable
      disabled={compact && !onPress}
      onPress={onPress ?? (() => open(note))}
      style={({ pressed }) => [styles.card, { borderBottomColor: theme.backgroundSelected }, pressed && styles.pressed]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}'s profile`} onPress={openUser}>
        <PubkeyAvatar pubkey={note.pubkey} size={44} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.meta}>
          <ThemedText style={styles.name} numberOfLines={1} onPress={openUser}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            · {timeAgo(note.created_at)}
          </ThemedText>
        </View>
        <NoteContent content={note.content} large={!!compact} />
        <View style={styles.actions}>
          <Action symbol="bubble.left" label="Reply" count={stats?.replies} onPress={reply} />
          <Action
            symbol={stats?.liked ? 'heart.fill' : 'heart'}
            label={stats?.liked ? 'Liked' : 'Like'}
            tint={stats?.liked ? '#E5484D' : undefined}
            count={stats?.likes}
            onPress={() => !stats?.liked && react.mutate({ note })}
          />
          {profile?.evm_address && !mine ? (
            <Action
              symbol="dollarsign.circle"
              label="Tip USDC"
              tint={stats?.tips ? '#30A46C' : undefined}
              count={stats?.tips}
              onPress={tip}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function Action({
  symbol,
  label,
  count,
  tint,
  onPress,
}: {
  symbol: SymbolViewProps['name'];
  label: string;
  count?: number;
  tint?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Spacing.two}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <SymbolView name={symbol} size={18} tintColor={tint ?? theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
        {count ? count : ''}
      </ThemedText>
    </Pressable>
  );
}

/** Renders note text with links, mentions, hashtags and inline images (NIP-27). */
export function NoteContent({ content, large }: { content: string; large?: boolean }) {
  const blocks = useMemo(() => [...nip27.parse(content)], [content]);
  const images = blocks.filter((b) => b.type === 'image').slice(0, 4);

  return (
    <View style={styles.content}>
      <ThemedText style={large ? styles.large : undefined} numberOfLines={large ? undefined : 14}>
        {blocks.map((b, i) => {
          switch (b.type) {
            case 'text':
              return <Fragment key={i}>{b.text}</Fragment>;
            case 'image':
              return null;
            case 'url':
            case 'video':
            case 'audio':
              return (
                <ThemedText key={i} style={styles.link} onPress={() => WebBrowser.openBrowserAsync(b.url)}>
                  {b.url.replace(/^https?:\/\//, '').slice(0, 40)}
                  {b.url.length > 48 ? '…' : ''}
                </ThemedText>
              );
            case 'hashtag':
              return (
                <ThemedText key={i} style={styles.link}>
                  #{b.value}
                </ThemedText>
              );
            case 'reference':
              // Event/address pointers are quotes; a bare profile pointer is a mention.
              return 'id' in b.pointer || 'identifier' in b.pointer ? (
                <ThemedText key={i} style={styles.link}>
                  ↗ quoted note
                </ThemedText>
              ) : (
                <Mention key={i} pubkey={b.pointer.pubkey} />
              );
            default:
              return null;
          }
        })}
      </ThemedText>
      {images.map((b) =>
        b.type === 'image' ? (
          <Image
            key={b.url}
            source={{ uri: b.url }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
            accessibilityLabel="Image attached to post"
          />
        ) : null,
      )}
    </View>
  );
}

function Mention({ pubkey }: { pubkey: string }) {
  const { data: profile } = useProfile(pubkey);
  return (
    <ThemedText
      style={styles.link}
      onPress={() => router.push({ pathname: '/user/[pubkey]', params: { pubkey } })}>
      @{displayName(profile, pubkey)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: Spacing.one },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  name: { fontWeight: 700, flexShrink: 1 },
  content: { gap: Spacing.two },
  large: { fontSize: 18, lineHeight: 26 },
  link: { color: LINK },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.five, marginTop: Spacing.one },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minWidth: 44, minHeight: 28 },
  count: { minWidth: 12 },
});
