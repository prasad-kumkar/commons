import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { NoteCard, useOpenNote } from '@/components/note-card';
import { Loading } from '@/components/nostr-gate';
import { EmptyState, Screen } from '@/components/screen';
import { useEngagement, useNote, useReplies } from '@/hooks/use-social';
import { replyParent } from '@/lib/nostr';

export default function NoteThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNote(id);
  const replies = useReplies(id);
  // Direct replies only; deeper ones open as their own thread.
  const direct = (replies.data ?? []).filter((r) => replyParent(r) === id);
  const engagement = useEngagement([id, ...direct.map((r) => r.id)]);
  const open = useOpenNote();
  const [pulling, setPulling] = useState(false);

  async function refresh() {
    setPulling(true);
    await replies.refetch();
    await engagement.refetch();
    setPulling(false);
  }

  return (
    <Screen edges={['bottom']} refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}>
      {note.isPending ? (
        <Loading />
      ) : !note.data ? (
        <EmptyState symbol="questionmark.bubble" title="Post not found" body="It may have been deleted, or relays are slow. Pull to retry." />
      ) : (
        <View>
          <NoteCard note={note.data} stats={engagement.data?.[note.data.id]} compact />
          {direct.map((r) => (
            <NoteCard key={r.id} note={r} stats={engagement.data?.[r.id]} onPress={() => open(r)} />
          ))}
        </View>
      )}
    </Screen>
  );
}
