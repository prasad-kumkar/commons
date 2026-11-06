import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorText } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useConversations, useProfile, useSendDM, type Message } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { displayName, timeAgo } from '@/lib/nostr';

export default function Chat() {
  const { pubkey: peer } = useLocalSearchParams<{ pubkey: string }>();
  const theme = useTheme();
  const me = useNostr().pubkey;
  const { data: profile } = useProfile(peer);
  const dms = useConversations({ live: true });
  const send = useSendDM();
  const [text, setText] = useState('');
  const messages = dms.data?.find((c) => c.peer === peer)?.messages ?? [];
  const content = text.trim();

  function submit() {
    if (!content) return;
    send.mutate({ to: peer, content }, { onSuccess: () => setText('') });
  }

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: displayName(profile, peer) }} />
      <SafeAreaView style={styles.fill} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}>
          <FlatList
            inverted
            data={[...messages].reverse()}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => <Bubble message={item} mine={item.from === me} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <SymbolView name="lock.fill" size={20} tintColor={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {dms.isPending ? 'Decrypting…' : 'Messages are end-to-end encrypted with NIP-17. Only you two can read them.'}
                </ThemedText>
              </View>
            }
          />
          <ErrorText message={send.error ? "Couldn't send. Try again." : null} />
          <View style={[styles.composer, { borderTopColor: theme.backgroundSelected }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={theme.textSecondary}
              selectionColor={theme.text}
              multiline
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              accessibilityLabel="Message text"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!content || send.isPending}
              onPress={submit}
              style={[styles.send, { backgroundColor: theme.text }, (!content || send.isPending) && styles.dim]}>
              <SymbolView name="arrow.up" size={18} weight="bold" tintColor={theme.background} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.bubbleRow, mine && styles.mineRow]}>
      <View style={[styles.bubble, { backgroundColor: mine ? '#3c87f7' : theme.backgroundElement }]}>
        <ThemedText style={mine ? styles.mineText : undefined} selectable>
          {message.content}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
        {timeAgo(message.created_at)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  empty: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five, transform: [{ scaleY: -1 }] },
  center: { textAlign: 'center' },
  bubbleRow: { alignItems: 'flex-start', gap: Spacing.half },
  mineRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 18 },
  mineText: { color: '#fff' },
  time: { fontSize: 11, lineHeight: 14, paddingHorizontal: Spacing.one },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.4 },
});
