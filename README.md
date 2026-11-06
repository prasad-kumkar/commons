# nostr-privy

Bare-shell Nostr client on Expo SDK 58 + Expo Router, authenticated with Privy.

## Stack
- Expo SDK 58 / React Native 0.88 / React 19.3, New Architecture, React Compiler
- Expo Router (typed routes), TypeScript strict
- `@privy-io/expo` (email OTP + Google OAuth)

## Config
| What | Value |
| --- | --- |
| Privy app | Commons (`cmtye8sa401b10djjptt2fzhr`) |
| Privy mobile client | `nostr-mobile` |
| Bundle ID / package | `com.chainscore.nostr` |
| URL scheme | `nostrprivy` |
| Google OAuth | GCP project `commons-nostr`, web client `privy-commons`, redirect `https://auth.privy.io/api/v1/oauth/callback` |

Public IDs live in `.env` (`EXPO_PUBLIC_PRIVY_APP_ID`, `EXPO_PUBLIC_PRIVY_CLIENT_ID`).

## Run
Privy doesn't run in Expo Go or on web — use a dev build:

```bash
npm install
LANG=en_US.UTF-8 npm run ios   # expo run:ios (needs Xcode; UTF-8 avoids a CocoaPods crash)
npm run android   # expo run:android
```

or in the cloud: `npx eas-cli@latest build --profile development`.

## Layout
- `entrypoint.js`: loads Privy polyfills before expo-router
- `metro.config.js`: Privy's resolver tweaks (isows, zustand, jose)
- `src/app/_layout.tsx`: `PrivyProvider` + `WalletsProvider`; auth gate via `Stack.Protected`
- `src/app/sign-in.tsx`: email OTP + Google (`components/login-screen.tsx`)
- `src/app/(tabs)/`: native tabs: Home (avatar → Profile, bell → Notifications), Search, Wallet, DMs
- `src/app/profile.tsx`, `src/app/notifications.tsx`: pushed pages
- `src/app/deposit/[network].tsx`: deposit sheet (QR, copy, network warning)
- `src/hooks/use-wallets.tsx`: creates/reads EVM, Solana and Bitcoin wallets once per user
- `src/lib/networks.ts`: networks, address types, tokens (native + USDC), RPC URLs
- `src/lib/balances.ts` + `src/hooks/use-balances.ts`: keyless balance/price reads via TanStack Query

## Wallets
The app uses Privy **TEE** wallet execution.
- EVM + Solana: `useEmbeddedEthereumWallet` / `useEmbeddedSolanaWallet`.
- Bitcoin: two address types, Native SegWit (`bc1q…`) and Taproot (`bc1p…`); Privy has no legacy (`1…`) or nested SegWit (`3…`). Extended chain: Create with `useCreateWallet({ chainType: 'bitcoin-segwit' })`
  and sign with `useSignRawHash` (both `@privy-io/expo/extended-chains`). To send BTC, build the PSBT in-app
  (e.g. `@scure/btc-signer`), sign each input's sighash with `useSignRawHash`, then finalize and broadcast.
  Privy requires an EVM or Solana wallet before Bitcoin.

## Balances
Total balance = native token + USDC on every EVM chain and Solana, plus BTC across both address types, priced in USD.
Sources (public, keyless, rate-limited; swap for paid providers before launch): publicnode RPCs (EVM), Solana mainnet RPC,
mempool.space (BTC, includes unconfirmed), CoinGecko (prices). Refreshes on pull, on app foreground, and when stale (60s).

## Testnet
`EXPO_PUBLIC_CHAIN_ENV=testnet` (default) uses Sepolia, Base Sepolia, Arbitrum Sepolia, OP Sepolia, Polygon Amoy,
Solana Devnet and Bitcoin Testnet4. Same keys as mainnet; Bitcoin addresses are re-encoded `bc1…` → `tb1…`
(`src/lib/bitcoin.ts`). Circle's faucet (faucet.circle.com) funds USDC on every supported testnet.

## Signature lab (Profile → Signature lab)
Signs with Privy and verifies on-device. All pass on TEE wallets:
EVM `personal_sign`, `eth_signTypedData_v4`, `eth_signTransaction`, `secp256k1_sign`, EIP-7702 authorization;
Solana `signMessage` (message is **base64** bytes), `signTransaction`; Bitcoin `useSignRawHash` for SegWit (ECDSA)
and Taproot (BIP-340 Schnorr, signs with the tweaked output key).

## Gas sponsorship
Enabled in the Privy dashboard (Fee sponsorship) for Sepolia, Base Sepolia, OP Sepolia, Arbitrum Sepolia, Amoy and
Solana Devnet, with **Allow transactions from the client** on. No server or app secret needed:
`src/hooks/use-sponsored-send.ts` calls Privy's Wallet API `rpc` (from `@privy-io/js-sdk-core`, pinned to the version
`@privy-io/expo` uses) with `sponsor: true`, and each request is signed by the user's own authorization key
(`useAuthorizationSignature`), so it can only move that user's funds.

Verified on testnet (Signature lab → Sponsored): a USDC transfer on Base Sepolia and a Solana Devnet transfer both
confirmed from wallets holding 0 ETH / 0 SOL. On EVM, Privy sponsors via **EIP-7702**: the first sponsored tx
delegates the EOA to Privy's smart-account code (`eth_getCode` shows `0xef0100…`).

Before mainnet: client-side sponsorship lets any signed-in user spend your gas credits. Add Privy policies/limits or
move sponsored sends to a server and turn the client toggle off.

## Next: Nostr keys
Privy embedded wallets sign ECDSA (secp256k1), but Nostr events need BIP-340 Schnorr signatures, so they can't sign Nostr events directly. Options: deterministically derive a Nostr key from a Privy wallet signature, or generate an nsec and keep it in `expo-secure-store`.
