# UPX Faucet

Testnet faucet for UPX (`0x57bfdA49355F95799399Deb4ff79aAB8d1971914`) on Sepolia, Hoodi, and BSC Testnet.

User claims from the UI → backend spam checks → operator wallet calls `Faucet.drip(to)` and pays gas. Claim is free for the user.

```
contracts/   Foundry
backend/     drip API
frontend/    claim UI
```

## Features

- Gasless claims — backend operator pays gas
- Same UPX token address on all three chains
- Configurable drip amount / cooldown (defaults: 100 UPX, 24h)
- Owner can withdraw tokens and rotate the operator

## Security / spam filtering

Three layers:

**Contract**
- Only the `operator` can call `drip`; cannot withdraw the vault
- Per-wallet cooldown on-chain (default 24h) — survives backend restarts
- Fixed drip amount; reverts if faucet balance is too low

**IP**
- Rate limit: max requests per minute per IP
- Daily claim cap per IP across all chains (default 6/day)
- Local / private IPs blocked in production

**VPN / proxy**
- proxycheck.io blocks VPN, Tor, proxies, and datacenter / hosting IPs
- High-risk score threshold (default 66)

## Deployed

| Network | Chain ID | Faucet |
|---------|----------|--------|
| Sepolia | 11155111 | `0x072330AEabcfD09D72b08c48EfcfdC1DAecd02ac` |
| Hoodi | 560048 | `0x79Ab181E79dac8E5480D69e1902469D6718CAcaF` |
| BSC Testnet | 97 | `0x2A2321015336B572EBb9250f64F0325d846e929E` |

## Contracts

```bash
cd contracts
cp .env.example .env   # PRIVATE_KEY, OPERATOR, RPC URLs
forge test

forge script script/DeployFaucet.s.sol:DeployFaucet \
  --rpc-url $SEPOLIA_RPC_URL --broadcast -vvvv

export FAUCET=0x... FUND_AMOUNT=1000000000000000000000
forge script script/FundFaucet.s.sol:FundFaucet \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

Fund the operator with a bit of native gas on each chain.

## Backend

```bash
cd backend
cp .env.example .env   # OPERATOR_PRIVATE_KEY, FAUCET_*, PROXYCHECK_API_KEY
npm i && npm run dev
```

`POST /api/drip` `{ "chain": "sepolia", "address": "0x…" }` → `{ txHash }`

## Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL, VITE_FAUCET_*
npm i && npm run dev
```
