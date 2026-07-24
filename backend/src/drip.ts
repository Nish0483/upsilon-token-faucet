import {
  type Address,
  type Hex,
  type Hash,
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbi,
  parseGwei,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet, sepolia } from "viem/chains";
import type { Chain } from "viem";

const faucetAbi = parseAbi([
  "function drip(address to)",
  "function operator() view returns (address)",
  "function timeUntilNextClaim(address user) view returns (uint256)",
]);

export type ChainKey = "sepolia" | "hoodi" | "bsc";

const hoodi = {
  id: 560048,
  name: "Hoodi",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.HOODI_RPC_URL || "https://0xrpc.io/hoodi"] },
  },
} as const satisfies Chain;

function envAddr(name: string): Address | undefined {
  const v = process.env[name]?.trim();
  return v && isAddress(v) ? (v as Address) : undefined;
}

export const CHAINS: Record<ChainKey, { chain: Chain; faucet?: Address; rpc: string }> = {
  sepolia: {
    chain: sepolia,
    faucet: envAddr("FAUCET_SEPOLIA"),
    rpc: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  },
  hoodi: {
    chain: hoodi,
    faucet: envAddr("FAUCET_HOODI"),
    rpc: process.env.HOODI_RPC_URL || "https://0xrpc.io/hoodi",
  },
  bsc: {
    chain: bscTestnet,
    faucet: envAddr("FAUCET_BSC"),
    rpc: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
  },
};

export function getOperatorAccount() {
  const key = process.env.OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!key) throw new Error("OPERATOR_PRIVATE_KEY (or PRIVATE_KEY) is required");
  return privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
}

function clients(chainKey: ChainKey) {
  const cfg = CHAINS[chainKey];
  if (!cfg.faucet) throw new Error(`Faucet not configured for ${chainKey}`);
  const account = getOperatorAccount();
  const transport = http(cfg.rpc);
  return {
    cfg,
    account,
    publicClient: createPublicClient({ chain: cfg.chain, transport }),
    walletClient: createWalletClient({ account, chain: cfg.chain, transport }),
  };
}

export async function readCanClaim(chainKey: ChainKey, user: Address) {
  const { cfg, publicClient } = clients(chainKey);
  const secondsLeft = await publicClient.readContract({
    address: cfg.faucet!,
    abi: faucetAbi,
    functionName: "timeUntilNextClaim",
    args: [user],
  });
  return { canClaim: secondsLeft === 0n, secondsLeft };
}

export async function dripTo(chainKey: ChainKey, to: Address): Promise<Hash> {
  const { cfg, publicClient, walletClient, account } = clients(chainKey);

  const operator = await publicClient.readContract({
    address: cfg.faucet!,
    abi: faucetAbi,
    functionName: "operator",
  });
  if (operator.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Operator mismatch: ${account.address} vs ${operator}`);
  }

  return walletClient.writeContract({
    address: cfg.faucet!,
    abi: faucetAbi,
    functionName: "drip",
    args: [to],
    ...(chainKey === "hoodi"
      ? { maxFeePerGas: parseGwei("30"), maxPriorityFeePerGas: parseGwei("5") }
      : {}),
  });
}
