import { useEmbeddedEthereumWallet, useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { useCreateWallet } from '@privy-io/expo/extended-chains';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { reencodeSegwitAddress } from '@/lib/bitcoin';
import { IS_TESTNET, type WalletKey } from '@/lib/networks';

export type WalletSlot =
  | { status: 'ready'; address: string }
  | { status: 'creating' }
  | { status: 'error'; message: string };

export type Wallets = Record<WalletKey, WalletSlot>;

// Shown to users; the raw SDK error is logged for developers instead.
const FRIENDLY_ERROR: Record<WalletKey, string> = {
  evm: "Couldn't set up your EVM address. Try again later.",
  solana: "Couldn't set up your Solana address. Try again later.",
  'bitcoin-segwit': "Couldn't set up your Bitcoin SegWit address. Try again later.",
  'bitcoin-taproot': "Couldn't set up your Bitcoin Taproot address. Try again later.",
};

type Account = { type: string; chain_type?: string; address?: string };

/** Address of a wallet linked to the user (covers TEE / extended-chain wallets). */
export function linkedWalletAddress(user: ReturnType<typeof usePrivy>['user'], chainType: string) {
  const accounts = (user?.linked_accounts ?? []) as unknown as Account[];
  return accounts.find((a) => a.type === 'wallet' && a.chain_type === chainType)?.address;
}

const WalletsContext = createContext<Wallets | null>(null);

/** Mount once under PrivyProvider so wallet creation runs in exactly one place. */
export function WalletsProvider({ children }: { children: ReactNode }) {
  const { user } = usePrivy();
  // Keyed on the user so creation attempts/errors reset when someone else signs in.
  return <WalletsState key={user?.id ?? 'signed-out'}>{children}</WalletsState>;
}

function WalletsState({ children }: { children: ReactNode }) {
  return <WalletsContext.Provider value={useEnsureWallets()}>{children}</WalletsContext.Provider>;
}

export function useWallets(): Wallets {
  const ctx = useContext(WalletsContext);
  if (!ctx) throw new Error('useWallets must be used inside <WalletsProvider>');
  return ctx;
}

/**
 * Returns one address per wallet key, creating any missing embedded wallet.
 *
 * Privy's "create on login" setting only applies to its hosted modal, so a whitelabel
 * login like ours has to create wallets itself.
 *
 * This app uses TEE wallet execution, so Bitcoin is an "extended chain": it is created
 * with `useCreateWallet` and signed with `useSignRawHash` (both from
 * `@privy-io/expo/extended-chains`), and shows up in `user.linked_accounts`.
 * Privy requires an EVM or Solana wallet first, so Bitcoin waits for those.
 */
function useEnsureWallets(): Wallets {
  const { user, isReady } = usePrivy();
  const eth = useEmbeddedEthereumWallet();
  const sol = useEmbeddedSolanaWallet();
  const { createWallet } = useCreateWallet();

  const [failed, setFailed] = useState<Partial<Record<WalletKey, true>>>({});
  const attempted = useRef<Set<WalletKey>>(new Set());

  // Privy's own (mainnet-encoded) addresses decide whether a wallet exists.
  const evm = eth.wallets[0]?.address;
  const solana = sol.wallets?.[0]?.address;
  const segwit = linkedWalletAddress(user, 'bitcoin-segwit');
  const taproot = linkedWalletAddress(user, 'bitcoin-taproot');

  // What the app shows/uses: same keys, Bitcoin re-encoded with tb1 on testnet.
  const forEnv = (btc: string | undefined) =>
    btc && IS_TESTNET ? reencodeSegwitAddress(btc, 'tb') : btc;
  const addresses: Record<WalletKey, string | undefined> = {
    evm,
    solana,
    'bitcoin-segwit': forEnv(segwit),
    'bitcoin-taproot': forEnv(taproot),
  };

  useEffect(() => {
    if (!isReady || !user) return;

    // Each key is attempted at most once per mount; a failure is surfaced, not retried in a loop.
    // Creations run one after another: Privy updates the same user record for each wallet.
    const queue: [WalletKey, () => Promise<unknown>][] = [];
    function enqueue(key: WalletKey, create: () => Promise<unknown>) {
      if (attempted.current.has(key)) return;
      attempted.current.add(key);
      queue.push([key, create]);
    }

    if (!evm) enqueue('evm', () => eth.create());
    if (!solana && sol.status === 'not-created' && sol.create) {
      const create = sol.create;
      enqueue('solana', () => create());
    }
    if (evm || solana) {
      if (!segwit) enqueue('bitcoin-segwit', () => createWallet({ chainType: 'bitcoin-segwit' }));
      if (!taproot) enqueue('bitcoin-taproot', () => createWallet({ chainType: 'bitcoin-taproot' }));
    }

    (async () => {
      for (const [key, create] of queue) {
        try {
          await create();
        } catch (err) {
          console.warn(`[wallets] ${key} wallet creation failed`, err);
          setFailed((f) => ({ ...f, [key]: true }));
        }
      }
    })();
  }, [isReady, user, evm, solana, segwit, taproot, sol.status, sol.create, eth, createWallet]);

  function slot(key: WalletKey): WalletSlot {
    const address = addresses[key];
    if (address) return { status: 'ready', address };
    if (failed[key] || (key === 'solana' && sol.status === 'error')) {
      return { status: 'error', message: FRIENDLY_ERROR[key] };
    }
    return { status: 'creating' };
  }

  return {
    evm: slot('evm'),
    solana: slot('solana'),
    'bitcoin-segwit': slot('bitcoin-segwit'),
    'bitcoin-taproot': slot('bitcoin-taproot'),
  };
}
