import { http, createConfig } from "wagmi";
import { sepolia, bscTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import type { Chain } from "viem";

export const hoodi = {
  id: 560048,
  name: "Hoodi",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://0xrpc.io/hoodi"] } },
  blockExplorers: {
    default: { name: "Hoodi Explorer", url: "https://hoodi.etherscan.io" },
  },
  testnet: true,
} as const satisfies Chain;

export const UPS_TOKEN =
  "0x57bfdA49355F95799399Deb4ff79aAB8d1971914" as const;

export type ChainKey = "sepolia" | "hoodi" | "bsc";

export type ChainConfig = {
  id: typeof sepolia.id | typeof hoodi.id | typeof bscTestnet.id;
  key: ChainKey;
  label: string;
  short: string;
  nativeSymbol: string;
  explorer: string;
  faucet: `0x${string}` | undefined;
};

export const CHAINS: ChainConfig[] = [
  {
    id: sepolia.id,
    key: "sepolia",
    label: "Sepolia",
    short: "Sepolia",
    nativeSymbol: "ETH",
    explorer: "https://sepolia.etherscan.io",
    faucet: import.meta.env.VITE_FAUCET_SEPOLIA as `0x${string}` | undefined,
  },
  {
    id: hoodi.id,
    key: "hoodi",
    label: "Hoodi",
    short: "Hoodi",
    nativeSymbol: "ETH",
    explorer: "https://hoodi.etherscan.io",
    faucet: import.meta.env.VITE_FAUCET_HOODI as `0x${string}` | undefined,
  },
  {
    id: bscTestnet.id,
    key: "bsc",
    label: "BSC Testnet",
    short: "BSC",
    nativeSymbol: "tBNB",
    explorer: "https://testnet.bscscan.com",
    faucet: import.meta.env.VITE_FAUCET_BSC as `0x${string}` | undefined,
  },
];

export const config = createConfig({
  chains: [sepolia, hoodi, bscTestnet],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
    [hoodi.id]: http("https://0xrpc.io/hoodi"),
    [bscTestnet.id]: http("https://bsc-testnet-rpc.publicnode.com"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
