import { EmptyState, Screen, TabHeader } from '@/components/screen';

export default function MessagesTab() {
  return (
    <Screen header={<TabHeader title="DMs" />}>
      <EmptyState
        symbol="bubble.left.and.bubble.right"
        title="No messages yet"
        body="Encrypted direct messages with other Nostr users will appear here."
      />
    </Screen>
  );
}
