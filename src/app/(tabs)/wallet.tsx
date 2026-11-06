import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { BalanceCard } from '@/components/balance-card';
import { DepositCard } from '@/components/deposit-card';
import { Screen, TabHeader } from '@/components/screen';
import { TestnetBadge } from '@/components/testnet-badge';
import { useBalances } from '@/hooks/use-balances';

export default function WalletTab() {
  const balances = useBalances();
  // Only show the pull spinner for user-initiated refreshes, not background refetches.
  const [pulling, setPulling] = useState(false);

  async function onRefresh() {
    setPulling(true);
    try {
      await balances.refresh();
    } finally {
      setPulling(false);
    }
  }

  return (
    <Screen
      header={<TabHeader title="Wallet" right={<TestnetBadge />} />}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}>
      <BalanceCard balances={balances} />
      <DepositCard />
    </Screen>
  );
}
