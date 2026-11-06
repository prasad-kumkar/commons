import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PubkeyAvatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useContacts, useFollow, useProfile } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/nostr';

/** A person with avatar, name, bio line and a follow toggle. */
export function PersonRow({ pubkey }: { pubkey: string }) {
  const { data: profile } = useProfile(pubkey);
  const name = displayName(profile, pubkey);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[pubkey]', params: { pubkey } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <PubkeyAvatar pubkey={pubkey} size={44} />
      <View style={styles.text}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {profile?.nip05?.replace(/^_@/, '') || profile?.about || ' '}
        </ThemedText>
      </View>
      <FollowButton pubkey={pubkey} />
    </Pressable>
  );
}

export function FollowButton({ pubkey }: { pubkey: string }) {
  const theme = useTheme();
  const me = useNostr().pubkey;
  const { data } = useContacts(me);
  const follow = useFollow();
  if (!me || pubkey === me) return null;
  const following = data?.follows.includes(pubkey) ?? false;
  const busy = follow.isPending;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, selected: following }}
      disabled={busy || !data}
      onPress={() => follow.mutate({ target: pubkey, follow: !following })}
      style={({ pressed }) => [
        styles.follow,
        following
          ? { backgroundColor: theme.backgroundElement }
          : { backgroundColor: theme.text },
        (pressed || busy) && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: following ? theme.text : theme.background }}>
        {busy ? '…' : following ? 'Following' : 'Follow'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: Spacing.half },
  name: { fontWeight: 700 },
  follow: {
    minWidth: 92,
    height: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
