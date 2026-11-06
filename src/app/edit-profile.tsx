import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ErrorText } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useProfile, useUpdateProfile } from '@/hooks/use-social';
import { shortAddress } from '@/lib/networks';
import { avatarFallback } from '@/lib/nostr';

export default function EditProfile() {
  const { pubkey } = useNostr();
  const { data: profile } = useProfile(pubkey);
  const evm = useEmbeddedEthereumWallet().wallets[0]?.address;
  const update = useUpdateProfile();
  const [name, setName] = useState(profile?.display_name || profile?.name || '');
  const [about, setAbout] = useState(profile?.about ?? '');
  const [picture, setPicture] = useState(profile?.picture ?? '');
  const [tips, setTips] = useState(!!profile?.evm_address);

  if (!pubkey) return null;
  const validPicture = !picture || /^https:\/\/\S+$/.test(picture.trim());

  function save() {
    update.mutate(
      {
        name: name.trim(),
        display_name: name.trim(),
        about: about.trim(),
        picture: picture.trim() || avatarFallback(pubkey!),
        evm_address: tips ? evm : undefined,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.center}>
        <Avatar size={88} uri={validPicture ? picture.trim() || avatarFallback(pubkey) : avatarFallback(pubkey)} />
      </View>
      <Field label="Name">
        <TextField value={name} onChangeText={setName} placeholder="Your name" maxLength={50} />
      </Field>
      <Field label="Bio">
        <TextField
          value={about}
          onChangeText={setAbout}
          placeholder="A line about you"
          multiline
          maxLength={300}
          style={styles.bio}
        />
      </Field>
      <Field label="Picture URL">
        <TextField
          value={picture}
          onChangeText={setPicture}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          invalid={!validPicture}
        />
      </Field>
      <ThemedView type="backgroundElement" style={styles.toggle}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Accept USDC tips</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {evm ? `Publishes ${shortAddress(evm)} on your public profile.` : 'Your wallet is still being set up.'}
          </ThemedText>
        </View>
        <Switch value={tips && !!evm} onValueChange={setTips} disabled={!evm} accessibilityLabel="Accept USDC tips" />
      </ThemedView>
      <ErrorText message={!validPicture ? 'Picture must be an https:// link.' : update.error ? "Couldn't save to relays. Try again." : null} />
      <Button
        title={update.isPending ? 'Saving…' : 'Save'}
        loading={update.isPending}
        disabled={!name.trim() || !validPicture}
        onPress={save}
      />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  field: { gap: Spacing.one },
  bio: { minHeight: 88, paddingTop: Spacing.three, textAlignVertical: 'top' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  flex: { flex: 1 },
});
