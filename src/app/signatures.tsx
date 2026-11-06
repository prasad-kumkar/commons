import {
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  usePrivy,
  useSign7702Authorization,
} from '@privy-io/expo';
import { useSignRawHash } from '@privy-io/expo/extended-chains';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { Hex } from 'viem';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSponsoredSend } from '@/hooks/use-sponsored-send';
import { linkedWalletAddress } from '@/hooks/use-wallets';
import {
  SIGNATURE_TESTS,
  type EvmProvider,
  type Signers,
  type SignatureTest,
  type SolanaProvider,
  type TestResult,
} from '@/lib/signature-tests';

type Status = { state: 'idle' } | { state: 'running' } | ({ state: 'done' } & TestResult) | { state: 'error'; message: string };

function useSigners(): Signers {
  const { user } = usePrivy();
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();
  const { signAuthorization } = useSign7702Authorization();
  const { signRawHash } = useSignRawHash();
  const sponsored = useSponsoredSend();

  const evmWallet = eth.wallets[0];
  const solWallet = sol.wallets?.[0];
  return {
    evm: evmWallet && {
      address: evmWallet.address as Hex,
      provider: () => evmWallet.getProvider() as Promise<EvmProvider>,
    },
    sign7702: (input) => signAuthorization(input),
    sponsored: { evm: sponsored.evm, solana: sponsored.solana },
    solana: solWallet && {
      address: solWallet.address,
      provider: () => solWallet.getProvider() as unknown as Promise<SolanaProvider>,
    },
    bitcoin: {
      // Privy signs by its own (mainnet-encoded) address; same key on testnet.
      segwit: linkedWalletAddress(user, 'bitcoin-segwit'),
      taproot: linkedWalletAddress(user, 'bitcoin-taproot'),
      signRawHash,
    },
  };
}

export default function SignatureLab() {
  const theme = useTheme();
  const signers = useSigners();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [runningAll, setRunningAll] = useState(false);

  async function run(test: SignatureTest) {
    setStatus((s) => ({ ...s, [test.id]: { state: 'running' } }));
    try {
      const result = await test.run(signers);
      setStatus((s) => ({ ...s, [test.id]: { state: 'done', ...result } }));
    } catch (err) {
      console.warn(`[signature-lab] ${test.id}`, err);
      const message = err instanceof Error ? err.message : String(err);
      setStatus((s) => ({ ...s, [test.id]: { state: 'error', message } }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    // Sequential: Privy serialises signing requests per wallet anyway, and logs stay readable.
    for (const test of SIGNATURE_TESTS) await run(test);
    setRunningAll(false);
  }

  const results = Object.values(status);
  const passed = results.filter((r) => r.state === 'done' && r.ok).length;
  const finished = results.filter((r) => r.state === 'done' || r.state === 'error').length;

  const groups = ['EVM', 'Solana', 'Bitcoin', 'Sponsored'] as const;

  return (
    <Screen edges={['bottom']}>
      <ThemedText themeColor="textSecondary">
        Signs with your Privy wallets and verifies each signature on-device. Only the Sponsored tests broadcast (testnet, gas paid by the app).
      </ThemedText>
      <Button
        title={runningAll ? 'Running…' : finished > 0 ? `Run all again (${passed}/${SIGNATURE_TESTS.length} passed)` : 'Run all tests'}
        loading={runningAll}
        onPress={runAll}
      />

      {groups.map((group) => (
        <ThemedView key={group} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {group}
          </ThemedText>
          {SIGNATURE_TESTS.filter((t) => t.group === group).map((test, i) => {
            const st = status[test.id] ?? { state: 'idle' };
            return (
              <Pressable
                key={test.id}
                accessibilityRole="button"
                accessibilityLabel={`Run ${test.name}`}
                disabled={st.state === 'running' || runningAll}
                onPress={() => run(test)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                  pressed && { opacity: 0.6 },
                ]}>
                <View style={styles.rowText}>
                  <ThemedText style={styles.name}>{test.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {test.description}
                  </ThemedText>
                  {st.state === 'done' ? (
                    <>
                      <ThemedText type="small" themeColor={st.ok ? 'textSecondary' : 'danger'}>
                        {st.detail}
                      </ThemedText>
                      {st.signature ? (
                        <ThemedText type="code" themeColor="textSecondary" selectable>
                          {st.signature}
                        </ThemedText>
                      ) : null}
                    </>
                  ) : null}
                  {st.state === 'error' ? (
                    <ThemedText type="small" themeColor="danger" numberOfLines={4}>
                      {st.message}
                    </ThemedText>
                  ) : null}
                </View>
                <StatusIcon status={st} />
              </Pressable>
            );
          })}
        </ThemedView>
      ))}
    </Screen>
  );
}

function StatusIcon({ status }: { status: Status }) {
  const theme = useTheme();
  if (status.state === 'running') return <ActivityIndicator />;
  if (status.state === 'idle') return <SymbolView name="play.circle" size={24} tintColor={theme.textSecondary} />;
  const ok = status.state === 'done' && status.ok;
  return (
    <SymbolView
      name={ok ? 'checkmark.circle.fill' : 'xmark.octagon.fill'}
      size={24}
      tintColor={ok ? '#30A46C' : theme.danger}
      accessibilityLabel={ok ? 'Passed' : 'Failed'}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  rowText: { flex: 1, gap: Spacing.half },
  name: { fontWeight: 600 },
});
