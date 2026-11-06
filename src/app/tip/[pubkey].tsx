import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { encodeFunctionData, erc20Abi, isAddress, parseUnits, type Hex } from 'viem';

import { PubkeyAvatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ScreenHeader, ErrorText } from '@/components/screen-header';
import { NetworkIcon } from '@/components/token-icon';
import { TestnetBadge } from '@/components/testnet-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useNote, useProfile, useReact } from '@/hooks/use-social';
import { useSponsoredSend } from '@/hooks/use-sponsored-send';
import { useTheme } from '@/hooks/use-theme';
import { findNetwork, IS_TESTNET, shortAddress } from '@/lib/networks';
import { displayName } from '@/lib/nostr';

const AMOUNTS = ['0.5', '1', '5'];

type State = { step: 'pick' } | { step: 'sending' } | { step: 'sent'; hash: Hex } | { step: 'error'; message: string };

/** Tip a Nostr user in USDC on Base; gas is sponsored, so the sender needs no ETH. */
export default function TipSheet() {
  const { pubkey, note: noteId } = useLocalSearchParams<{ pubkey: string; note?: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const { data: profile } = useProfile(pubkey);
  const note = useNote(noteId);
  const react = useReact();
  const sponsored = useSponsoredSend();
  const [amount, setAmount] = useState('1');
  const [state, setState] = useState<State>({ step: 'pick' });
  const base = findNetwork('base')!;
  const usdc = base.tokens[0]!;
  const to = profile?.evm_address;
  const name = displayName(profile, pubkey);

  async function send() {
    if (!to || !isAddress(to)) return;
    setState({ step: 'sending' });
    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, parseUnits(amount, usdc.decimals)],
      });
      const hash = await sponsored.evm(base.chainId!, { to: usdc.contract as Hex, data });
      setState({ step: 'sent', hash });
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('balance') });
      // Let the author (and everyone) see the tip on the post.
      if (note.data) {
        react.mutate({
          note: note.data,
          content: '💸',
          tip: { amount, symbol: 'USDC', caip2: `eip155:${base.chainId}`, tx: hash },
        });
      }
    } catch (err) {
      console.warn('[tip] failed', err);
      const raw = err instanceof Error ? err.message : String(err);
      setState({
        step: 'error',
        message: /insufficient|exceeds balance/i.test(raw)
          ? `Not enough USDC on ${base.name}.`
          : "The tip didn't go through. Try again.",
      });
    }
  }

  const txUrl = state.step === 'sent' ? base.explorer.replace('address/{address}', `tx/${state.hash}`) : null;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <ScreenHeader title="Send a tip" />
          <View style={styles.who}>
            <PubkeyAvatar pubkey={pubkey} size={64} />
            <ThemedText type="smallBold" style={styles.whoName}>
              {name}
            </ThemedText>
            {to ? (
              <ThemedText type="code" themeColor="textSecondary">
                {shortAddress(to)}
              </ThemedText>
            ) : null}
          </View>

          {!to ? (
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {`${name} hasn't set up a tip address yet.`}
            </ThemedText>
          ) : state.step === 'sent' ? (
            <View style={styles.done}>
              <ThemedText style={styles.big}>✓</ThemedText>
              <ThemedText type="smallBold" style={styles.center}>
                Sent {amount} USDC to {name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Gas was covered by Commons.
              </ThemedText>
              <Button variant="secondary" title="View transaction" onPress={() => WebBrowser.openBrowserAsync(txUrl!)} />
              <Button title="Done" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              <View style={styles.amounts}>
                {AMOUNTS.map((a) => {
                  const on = a === amount;
                  return (
                    <Pressable
                      key={a}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setAmount(a)}
                      style={[
                        styles.amount,
                        { backgroundColor: on ? theme.text : theme.backgroundElement },
                      ]}>
                      <ThemedText style={[styles.amountText, { color: on ? theme.background : theme.text }]}>${a}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedView type="backgroundElement" style={styles.network}>
                <NetworkIcon network={base} size={28} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">USDC on {base.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    No gas needed: fees are sponsored
                  </ThemedText>
                </View>
                {IS_TESTNET ? <TestnetBadge /> : null}
              </ThemedView>
              <ErrorText message={state.step === 'error' ? state.message : null} />
              <Button
                title={state.step === 'sending' ? 'Sending…' : `Tip ${amount} USDC`}
                loading={state.step === 'sending'}
                onPress={send}
              />
              <View style={styles.cancel}>
                <Button variant="link" title="Cancel" onPress={() => router.back()} />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  who: { alignItems: 'center', gap: Spacing.one },
  whoName: { fontSize: 18 },
  center: { textAlign: 'center' },
  amounts: { flexDirection: 'row', gap: Spacing.two },
  amount: { flex: 1, height: 64, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  amountText: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  network: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  flex: { flex: 1 },
  cancel: { alignItems: 'center' },
  done: { gap: Spacing.three, alignItems: 'stretch' },
  big: { fontSize: 48, lineHeight: 56, textAlign: 'center', color: '#30A46C' },
});
