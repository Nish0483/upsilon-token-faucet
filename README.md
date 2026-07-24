# UPX Faucet

Monorepo layout:

```text
contracts/   # Foundry (Faucet.sol, scripts, tests)
backend/     # drip API
frontend/    # claim UI
```

Foundry faucet for **UPX** (`0x57bfdA49355F95799399Deb4ff79aAB8d1971914`) on three testnets:

| Network | Chain ID |
|---------|----------|
| Ethereum Sepolia | 11155111 |
| Ethereum Hoodi | 560048 |
| BSC Testnet | 97 |

Same token address on every chain. Deploy the faucet once per network, fund it with UPX, then point the frontend + backend at the three faucet addresses.

## How it works (Pattern A)

1. User pastes an address (or connects a wallet) and clicks claim.
2. Backend checks IP (VPN / proxy / datacenter via `proxycheck-ts` + `request-ip`).
3. Backend **operator EOA** calls `Faucet.drip(to)` and pays gas.
4. Contract enforces cooldown + drip amount. Tokens stay in the contract.

| Role | Powers |
|------|--------|
| **operator** (backend key) | `drip` only — cannot withdraw the vault |
| **owner** (admin / deployer) | withdraw, set drip/cooldown/operator |

## Contracts

```text
contracts/src/Faucet.sol
contracts/src/mocks/MockUPS.sol
contracts/script/DeployFaucet.s.sol
contracts/script/FundFaucet.s.sol
```

Defaults: **100 UPX** per drip, **24h** cooldown.

### Setup

```bash
cd contracts
cp .env.example .env
# set PRIVATE_KEY, OPERATOR, RPC URLs
```

### Test

```bash
cd contracts
forge test
```

### Deploy (example: Sepolia)

```bash
cd contracts
forge script script/DeployFaucet.s.sol:DeployFaucet \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  -vvvv
```

Repeat with `$HOODI_RPC_URL` and `$BSC_TESTNET_RPC_URL`.

Fund the operator wallet with a little **native** test ETH/BNB on each chain so it can pay drip gas.

### Fund after deploy

```bash
cd contracts
export FAUCET=0xYourFaucet
export FUND_AMOUNT=1000000000000000000000   # 1000 UPX
forge script script/FundFaucet.s.sol:FundFaucet \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast
```

## Backend

```bash
cd backend
cp .env.example .env
# set FAUCET_*, OPERATOR_PRIVATE_KEY, PROXYCHECK_API_KEY (prod)
npm install
npm run dev
```

`POST /api/drip` `{ "chain": "sepolia", "address": "0x…" }` → returns `{ txHash }`.

## Frontend

```bash
cd frontend
cp .env.example .env
# fill VITE_FAUCET_* and VITE_API_URL
npm install
npm run dev
```

Paste an address or connect MetaMask — no claim gas required from the user.

## Env reference

| Package | File | Purpose |
|---------|------|---------|
| `contracts/` | `PRIVATE_KEY`, `OPERATOR`, RPCs, `UPS_TOKEN`, drip params | Deploy / fund / verify |
| `backend/` | `OPERATOR_PRIVATE_KEY`, `FAUCET_*`, RPCs, limits, `PROXYCHECK_API_KEY` | Drip API |
| `frontend/` | `VITE_API_URL`, `VITE_FAUCET_*` | Claim UI |
