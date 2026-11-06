import { useState } from 'react';

import { EmptyState, Screen, TabHeader } from '@/components/screen';
import { TextField } from '@/components/text-field';

export default function SearchTab() {
  const [query, setQuery] = useState('');

  return (
    <Screen header={<TabHeader title="Search" />}>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="People, notes, npub or NIP-05"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search"
      />
      <EmptyState
        symbol="magnifyingglass"
        title={query ? 'Search is coming soon' : 'Find people and notes'}
        body={
          query
            ? 'Searching Nostr relays is not wired up yet.'
            : 'Search by name, npub, NIP-05 address or keyword.'
        }
      />
    </Screen>
  );
}
