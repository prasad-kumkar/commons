import { EmptyState, Screen } from '@/components/screen';

export default function NotificationsPage() {
  return (
    <Screen edges={['bottom']}>
      <EmptyState
        symbol="bell"
        title="You're all caught up"
        body="Replies, mentions, reactions and zaps will show up here."
      />
    </Screen>
  );
}
