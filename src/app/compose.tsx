import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PubkeyAvatar } from '@/components/avatar';
import { NoteContent } from '@/components/note-card';
import { ErrorText } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useNostr } from '@/hooks/use-nostr';
import { useNote, usePost, useProfile } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/nostr';

const MAX = 1000;

export default function Compose() {
  const { reply } = useLocalSearchParams<{ reply?: string }>();
  const theme = useTheme();
  const { pubkey } = useNostr();
  const parent = useNote(reply);
  const { data: parentAuthor } = useProfile(parent.data?.pubkey);
  const post = usePost();
  const [text, setText] = useState('');
  const content = text.trim();
  const canPost = content.length > 0 && content.length <= MAX && !post.isPending && (!reply || !!parent.data);

  function submit() {
    post.mutate({ content, parent: parent.data ?? undefined }, { onSuccess: () => router.back() });
  }

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.bar}>
            <Pressable accessibilityRole="button" hitSlop={Spacing.two} onPress={() => router.back()}>
              <ThemedText>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{reply ? 'Reply' : 'New post'}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canPost, busy: post.isPending }}
              disabled={!canPost}
              onPress={submit}
              style={[styles.post, { backgroundColor: theme.text }, !canPost && styles.dim]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {post.isPending ? 'Posting…' : reply ? 'Reply' : 'Post'}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.body}>
            {parent.data ? (
              <View style={[styles.parent, { borderLeftColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Replying to {displayName(parentAuthor, parent.data.pubkey)}
                </ThemedText>
                <View style={styles.parentText}>
                  <NoteContent content={parent.data.content.slice(0, 280)} />
                </View>
              </View>
            ) : null}
            <View style={styles.editor}>
              {pubkey ? <PubkeyAvatar pubkey={pubkey} size={40} /> : null}
              <TextInput
                autoFocus
                multiline
                value={text}
                onChangeText={setText}
                placeholder={reply ? 'Post your reply' : "What's happening?"}
                placeholderTextColor={theme.textSecondary}
                selectionColor={theme.text}
                style={[styles.input, { color: theme.text }]}
                accessibilityLabel="Post text"
              />
            </View>
            <ErrorText message={post.error ? "Couldn't publish to relays. Try again." : null} />
          </View>
          <ThemedText type="small" themeColor={content.length > MAX ? 'danger' : 'textSecondary'} style={styles.counter}>
            {content.length > 0 ? `${content.length}/${MAX}` : 'Posts are public on Nostr'}
          </ThemedText>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  post: { paddingHorizontal: Spacing.three, height: 34, borderRadius: 17, justifyContent: 'center' },
  dim: { opacity: 0.4 },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  parent: { borderLeftWidth: 3, paddingLeft: Spacing.three, gap: Spacing.one },
  parentText: { opacity: 0.8 },
  editor: { flexDirection: 'row', gap: Spacing.three, flex: 1 },
  input: { flex: 1, fontSize: 18, lineHeight: 24, textAlignVertical: 'top', paddingTop: Spacing.two },
  counter: { textAlign: 'right', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
});
