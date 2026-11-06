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

The social side is a full Nostr client: a home feed of people you follow, posting, replies and threads, likes,
profiles, search across Nostr (people, posts, npub, NIP-05), notifications, and end-to-end encrypted DMs (NIP-17).
Every post and profile can be tipped in USDC with no gas, and the tip shows up on Nostr for everyone to see. Your
Nostr identity is derived from your Privy wallet, so logging in with the same email on a new phone gives you the
same npub, with no nsec or seed phrase to manage.

## How it's made
- **App:** Expo SDK 58, React Native 0.88 (New Architecture, React Compiler), Expo Router with native tabs and
  protected routes, TypeScript strict, TanStack Query.
- **Auth + wallets:** Privy (`@privy-io/expo`) with whitelabel email-OTP and Google login. Wallets run on Privy's TEE
  infrastructure; the app creates EVM, Solana and Bitcoin (extended-chain) wallets itself after login.
- **Gas sponsorship without a backend:** the Expo SDK has no `sponsor: true` yet, so the app calls Privy's Wallet API
  `rpc` directly with each request signed by the user's own authorization key. On EVM Privy sponsors via EIP-7702
  (the EOA is delegated to a smart account); on Solana the fee is paid by the sponsor. Both confirmed on testnet from
  zero-balance wallets.
- **Nostr identity from Privy:** Nostr needs a raw key in the app (Schnorr signatures, NIP-44 ECDH), which a remote
  signer can't provide. The app asks the Privy EVM wallet for a deterministic (RFC 6979) `personal_sign` over a fixed
  message and runs it through HKDF-SHA256 to get the Nostr secret key, cached in the iOS Keychain. Same login, same
  npub, on any device.
- **Nostr client:** nostr-tools with one shared relay pool, publish-on-first-ack so slow relays never block the UI,
  batched profile loading, one query for a whole feed's likes/replies/tips, optimistic follows and likes. DMs are
  NIP-17: one kind-14 rumor sealed and gift-wrapped for both sides and sent to the recipient's kind-10050 relays.
  Search uses NIP-50 relays plus npub/NIP-05 lookup.
- **USDC tips:** profiles publish an EVM tip address; tips are sponsored USDC transfers on Base, announced as a
  kind-7 reaction with a `tip` tag (amount, CAIP-2 chain, tx hash) so they show up in notifications and on the post.
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

## Linked
- GitHub: https://github.com/prasad-kumkar/commons (Primary, Monorepo), saved on the ETHGlobal form
- Demo video: recorded from the iOS simulator (Release build), with captions

## Still needed from you
- Demo link
- Logo, cover image, screenshots (min 3)
- Tech stack + prize selection
- Team members
