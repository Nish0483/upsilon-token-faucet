/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FAUCET_SEPOLIA?: string;
  readonly VITE_FAUCET_HOODI?: string;
  readonly VITE_FAUCET_BSC?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
