import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-social';
import { avatarFallback, displayName } from '@/lib/nostr';

/** Circle avatar: the image when there is one, otherwise initials. */
export function Avatar({ initials, uri, size = 36 }: { initials?: string; uri?: string; size?: number }) {
  const theme = useTheme();
  const circle = { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={circle}
        contentFit="cover"
        cachePolicy="disk"
        transition={150}
        recyclingKey={uri}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.circle, circle]}>
      <ThemedText style={{ fontSize: size * 0.4, lineHeight: size * 0.5, fontWeight: 700 }}>{initials ?? '?'}</ThemedText>
    </View>
  );
}

/** Avatar for a Nostr pubkey, loading its kind-0 picture. */
export function PubkeyAvatar({ pubkey, size = 40 }: { pubkey: string; size?: number }) {
  const { data: profile } = useProfile(pubkey);
  const name = displayName(profile, pubkey);
  return <Avatar size={size} uri={profile?.picture || avatarFallback(pubkey)} initials={name.slice(0, 1).toUpperCase()} />;
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
