import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { NoteCard } from '@/components/note-card';
import { Loading, NostrGate } from '@/components/nostr-gate';
import { PersonRow } from '@/components/person-row';
import { EmptyState, Screen, TabHeader } from '@/components/screen';
import { ErrorText } from '@/components/screen-header';
import { Segmented } from '@/components/segmented';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useEngagement, useSearch } from '@/hooks/use-social';
import { SUGGESTED } from '@/lib/nostr';

type Tab = 'people' | 'posts';

export default function SearchTab() {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<Tab>('people');
  const search = useSearch(term);
  const engagement = useEngagement(tab === 'posts' ? (search.data?.notes.map((n) => n.id) ?? []) : []);

  // Debounce so each keystroke doesn't hit the relays.
  useEffect(() => {
    const t = setTimeout(() => setTerm(input), 400);
    return () => clearTimeout(t);
  }, [input]);

  const active = term.trim().length >= 2;

  return (
    <Screen header={<TabHeader title="Search" />}>
      <TextField
        value={input}
        onChangeText={setInput}
        placeholder="People, posts, npub or NIP-05"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        onSubmitEditing={() => setTerm(input)}
        accessibilityLabel="Search"
      />
      <NostrGate>
        {!active ? (
          <View>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Suggested
            </ThemedText>
            {SUGGESTED.map((pk) => (
              <PersonRow key={pk} pubkey={pk} />
            ))}
          </View>
        ) : (
          <>
            <Segmented
              accessibilityLabel="Result type"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'people', label: `People${search.data ? ` · ${search.data.people.length}` : ''}` },
                { value: 'posts', label: `Posts${search.data ? ` · ${search.data.notes.length}` : ''}` },
              ]}
            />
            {search.isPending ? (
              <Loading label="Searching relays…" />
            ) : search.isError ? (
              <ErrorText message="Search relays didn't respond. Try again." />
            ) : tab === 'people' ? (
              search.data.people.length > 0 ? (
                <View>
                  {search.data.people.map((pk) => (
                    <PersonRow key={pk} pubkey={pk} />
                  ))}
                </View>
              ) : (
                <EmptyState symbol="person.crop.circle.badge.questionmark" title="No people found" body="Try a different name, an npub or a NIP-05 address." />
              )
            ) : search.data.notes.length > 0 ? (
              <View>
                {search.data.notes.map((n) => (
                  <NoteCard key={n.id} note={n} stats={engagement.data?.[n.id]} />
                ))}
              </View>
            ) : (
              <EmptyState symbol="text.magnifyingglass" title="No posts found" body="Try another keyword." />
            )}
          </>
        )}
      </NostrGate>
    </Screen>
  );
}
