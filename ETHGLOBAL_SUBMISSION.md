# ETHGlobal Mumbai: project draft

Draft only. Nothing has been submitted.

## Project name
Commons

## Short description (≤100 chars)
A Nostr social app with a built-in multichain wallet: email login, gasless USDC, BTC + Solana.

## Description
Commons is a mobile social app built on Nostr where every account comes with a self-custodial wallet, without seed
phrases or gas. People sign in with email or Google; behind the scenes Privy creates embedded wallets on EVM, Solana
and Bitcoin (both Native SegWit and Taproot) for them.

The Wallet tab shows one total balance across Ethereum, Base, Arbitrum, Optimism, Polygon, Solana and Bitcoin, with
native tokens and USDC, plus per-network deposit sheets with QR codes and clear network warnings. Transactions are
gas-sponsored: a brand-new user holding 0 ETH and 0 SOL can still move USDC, because the app pays the fees.

The social layer (feed, search, DMs, notifications) is set up as native tabs, ready for Nostr relays. The goal is a
Nostr client where tipping, paying and holding stablecoins feels as simple as posting.

## How it's made
- **App:** Expo SDK 58, React Native 0.88 (New Architecture, React Compiler), Expo Router with native tabs and
  protected routes, TypeScript strict, TanStack Query.
- **Auth + wallets:** Privy (`@privy-io/expo`) with whitelabel email-OTP and Google login. Wallets run on Privy's TEE
  infrastructure; the app creates EVM, Solana and Bitcoin (extended-chain) wallets itself after login.
- **Gas sponsorship without a backend:** the Expo SDK has no `sponsor: true` yet, so the app calls Privy's Wallet API
  `rpc` directly with each request signed by the user's own authorization key. On EVM Privy sponsors via EIP-7702
  (the EOA is delegated to a smart account); on Solana the fee is paid by the sponsor. Both confirmed on testnet from
  zero-balance wallets.
- **Signature lab:** an in-app test suite that signs with every method Privy offers and verifies each result
  on-device with viem and @noble/curves: EIP-191, EIP-712, EIP-1559 tx, raw secp256k1, EIP-7702 authorization,
  Solana message + tx (ed25519), Bitcoin SegWit (ECDSA, key matched to the witness program) and Taproot (BIP-340
  Schnorr against the tweaked output key).
- **Bitcoin testnet trick:** Privy only issues `bc1…` addresses, so the app re-encodes the witness program with the
  `tb` prefix (bech32/bech32m, checked against BIP-173/350 vectors) to use the same keys on Testnet4.
- **Balances:** keyless public RPCs (publicnode, Solana RPC, mempool.space) batched per chain, CoinGecko for prices
  and token logos, DefiLlama for chain icons; images load from CDNs and are disk-cached, nothing bundled.

## Tech / sponsors to tag
Privy, Base, Arbitrum, Optimism, Polygon, Solana, Bitcoin, Circle (USDC), Nostr, Expo, React Native

## Still needed from you
- GitHub repo URL (the project is only a local git repo right now)
- Demo video and screenshots
- Logo
- Team members
