import { useAuthorizationSignature, usePrivy, usePrivyClient } from '@privy-io/expo';
import { rpc } from '@privy-io/js-sdk-core';
import { base64 } from '@scure/base';

type Account = { type: string; chain_type?: string; address?: string; id?: string | null };

type EvmTx = { to: `0x${string}`; value?: `0x${string}`; data?: `0x${string}` };

/**
 * Gas-sponsored sends straight from the app, no server.
 *
 * `@privy-io/expo` has no `sponsor: true` option yet, so this calls Privy's Wallet API
 * RPC directly (the same `rpc` helper the SDK uses internally). Each request is signed
 * with the user's own authorization key, so it only works for this user's wallets.
 * Requires "Sponsor gas fees" + "Allow transactions from the client" in the dashboard
 * and the chain listed under supported chains.
 */
export function useSponsoredSend() {
  const client = usePrivyClient();
  const { user } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();

  // Wallet API ids live on the linked wallet accounts.
  function walletId(chainType: 'ethereum' | 'solana') {
    const accounts = (user?.linked_accounts ?? []) as unknown as Account[];
    const id = accounts.find((a) => a.type === 'wallet' && a.chain_type === chainType)?.id;
    if (!id) throw new Error(`No ${chainType} wallet id on this user`);
    return id;
  }

  const context = {
    fetchPrivyRoute: client.fetchPrivyRoute.bind(client),
    getCompiledPath: client.getCompiledPath.bind(client),
    app: { appId: client.app.appId },
  } as Parameters<typeof rpc>[0];

  // The Wallet API hands us the canonical payload (base64); the user's key signs it.
  const sign: Parameters<typeof rpc>[1] = async ({ message }) =>
    generateAuthorizationSignature(base64.decode(message));

  return {
    /** Sends an EVM tx with gas paid by the app's sponsorship credits. Returns the tx hash. */
    async evm(chainId: number, transaction: EvmTx): Promise<`0x${string}`> {
      const res = (await rpc(context, sign, {
        wallet_id: walletId('ethereum'),
        method: 'eth_sendTransaction',
        caip2: `eip155:${chainId}`,
        sponsor: true,
        params: { transaction },
      } as never)) as { data?: { hash?: string } };
      const hash = res.data?.hash;
      if (!hash) throw new Error(`Unexpected response: ${JSON.stringify(res).slice(0, 200)}`);
      return hash as `0x${string}`;
    },

    /** Signs + sends a serialized Solana tx with the fee sponsored. Returns the signature. */
    async solana(caip2: string, serializedTx: Uint8Array): Promise<string> {
      const res = (await rpc(context, sign, {
        wallet_id: walletId('solana'),
        method: 'signAndSendTransaction',
        caip2,
        sponsor: true,
        params: { transaction: base64.encode(serializedTx), encoding: 'base64' },
      } as never)) as { data?: { hash?: string; signature?: string } };
      const sig = res.data?.hash ?? res.data?.signature;
      if (!sig) throw new Error(`Unexpected response: ${JSON.stringify(res).slice(0, 200)}`);
      return sig;
    },
  };
}
