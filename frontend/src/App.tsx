import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
} from "wagmi";
import { erc20Abi, isAddress } from "viem";
import { useEffect, useState } from "react";
import faucetAbi from "./abi/faucet.json";
import { CHAINS, UPS_TOKEN, type ChainKey } from "./config";
import { formatDuration, formatUnits, shortenAddress } from "./lib/format";
import { formatRejection, type RejectionPayload } from "./lib/errors";
import { useCountdown } from "./hooks/useCountdown";
import upsilonMark from "./assets/upsilon-mark.png";
import "./App.css";

const abi = faucetAbi as unknown as readonly unknown[];
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8787";

type DripResponse = RejectionPayload & { txHash?: `0x${string}` };

function labelUpx(value: unknown, empty = "—") {
  return typeof value === "bigint" ? `${formatUnits(value)} UPX` : empty;
}

function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [manualAddress, setManualAddress] = useState("");
  const [selectedKey, setSelectedKey] = useState<ChainKey>("sepolia");
  const [gateError, setGateError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const active = CHAINS.find((c) => c.key === selectedKey) ?? CHAINS[0];
  const faucetAddress = active.faucet;

  const recipient = (() => {
    if (isConnected && address) return address;
    const trimmed = manualAddress.trim();
    return isAddress(trimmed) ? (trimmed as `0x${string}`) : undefined;
  })();

  const { data: walletUpx, refetch: refetchWalletUpx } = useReadContract({
    address: UPS_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: active.id,
    query: { enabled: Boolean(isConnected && address) },
  });

  const { data: dripAmount, refetch: refetchDrip } = useReadContract({
    address: faucetAddress,
    abi,
    functionName: "dripAmount",
    chainId: active.id,
    query: { enabled: Boolean(faucetAddress) },
  });

  const { data: faucetBalance, refetch: refetchBalance } = useReadContract({
    address: faucetAddress,
    abi,
    functionName: "faucetBalance",
    chainId: active.id,
    query: { enabled: Boolean(faucetAddress) },
  });

  const { data: cooldown } = useReadContract({
    address: faucetAddress,
    abi,
    functionName: "cooldown",
    chainId: active.id,
    query: { enabled: Boolean(faucetAddress) },
  });

  const { data: secondsLeft, refetch: refetchCooldown } = useReadContract({
    address: faucetAddress,
    abi,
    functionName: "timeUntilNextClaim",
    args: recipient ? [recipient] : undefined,
    chainId: active.id,
    query: { enabled: Boolean(faucetAddress && recipient) },
  });

  const remaining = useCountdown(
    typeof secondsLeft === "bigint" ? Number(secondsLeft) : undefined,
  );

  useEffect(() => {
    if (!txHash) return;
    void refetchCooldown();
    void refetchBalance();
    void refetchDrip();
    void refetchWalletUpx();
    const t1 = window.setTimeout(() => void refetchWalletUpx(), 4_000);
    const t2 = window.setTimeout(() => void refetchWalletUpx(), 15_000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [txHash, refetchCooldown, refetchBalance, refetchDrip, refetchWalletUpx]);

  const dripLabel = labelUpx(dripAmount);
  const canClaim =
    Boolean(faucetAddress) &&
    Boolean(recipient) &&
    remaining === 0 &&
    !isRequesting &&
    !txHash;

  function clearStatus() {
    setGateError(null);
    setTxHash(null);
  }

  async function onClaim() {
    if (!faucetAddress || !recipient || isRequesting) return;
    clearStatus();
    setIsRequesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/drip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: active.key, address: recipient }),
      });
      const data = (await res.json()) as DripResponse;
      if (!res.ok) {
        setGateError(formatRejection(data));
        return;
      }
      if (!data.txHash) {
        setGateError("No transaction hash returned");
        return;
      }
      setTxHash(data.txHash);
      void refetchCooldown();
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Failed to reach faucet API");
    } finally {
      setIsRequesting(false);
    }
  }

  function onConnect() {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) connect({ connector: injected });
  }

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div className="topbar-right">
          {isConnected && address ? (
            <>
              <div className="wallet-balance" aria-live="polite">
                <span className="wallet-balance-label">Your UPX · {active.short}</span>
                <span className="wallet-balance-value">{labelUpx(walletUpx, "…")}</span>
              </div>
              <button type="button" className="wallet-chip" onClick={() => disconnect()}>
                {shortenAddress(address)}
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="wallet-chip connect"
              onClick={onConnect}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      <main className="hero">
        <div className="brand-hero">
          <img
            className="brand-upsilon-hero"
            src={upsilonMark}
            alt=""
            width={72}
            height={84}
            aria-hidden="true"
          />
          <p className="brand">UPX</p>
        </div>
        <h1 className="headline">Testnet faucet</h1>
        <p className="lede">Enter a wallet or connect MetaMask.</p>

        {!isConnected && (
          <label className="address-field">
            <span className="address-label">Recipient address</span>
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => {
                setManualAddress(e.target.value);
                clearStatus();
              }}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
        )}

        <div className="cta-row">
          <button
            type="button"
            className={`btn primary${remaining > 0 ? " waiting" : ""}`}
            onClick={() => void onClaim()}
            disabled={!canClaim}
          >
            {isRequesting
              ? "Processing…"
              : remaining > 0
                ? `Wait ${formatDuration(remaining)}`
                : !faucetAddress
                  ? "Deploy faucet first"
                  : !recipient
                    ? "Enter or connect wallet"
                    : `Get ${dripLabel}`}
          </button>
        </div>

        <div className="chain-switch" role="tablist" aria-label="Select network">
          {CHAINS.map((c) => {
            const selected = selectedKey === c.key;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`chain-btn${selected ? " active" : ""}`}
                onClick={() => {
                  setSelectedKey(c.key);
                  clearStatus();
                }}
              >
                <span className="chain-name">{c.short}</span>
                <span className="chain-meta">{c.nativeSymbol}</span>
              </button>
            );
          })}
        </div>

        {(gateError || txHash) && (
          <div className="status-msg" aria-live="polite">
            {gateError && (
              <p className="error" role="alert">
                {gateError}
              </p>
            )}
            {txHash && (
              <p className="ok">
                Submitted — may take a bit to confirm on {active.label}.{" "}
                <a
                  href={`${active.explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View tx
                </a>
              </p>
            )}
          </div>
        )}
      </main>

      <section className="panel" aria-label="Faucet status">
        <div className="stat">
          <span className="stat-label">Network</span>
          <span className="stat-value">{active.label}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Drip</span>
          <span className="stat-value">{dripLabel}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Cooldown</span>
          <span className="stat-value">
            {typeof cooldown === "bigint" ? formatDuration(Number(cooldown)) : "—"}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Faucet balance</span>
          <span className="stat-value">{labelUpx(faucetBalance)}</span>
        </div>
      </section>

      <footer className="foot">
        <p>
          Token{" "}
          <a
            href={`${active.explorer}/token/${UPS_TOKEN}`}
            target="_blank"
            rel="noreferrer"
          >
            {shortenAddress(UPS_TOKEN, 6)}
          </a>
         
         
        </p>
        {faucetAddress ? (
          <p>
            Faucet{" "}
            <a
              href={`${active.explorer}/address/${faucetAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortenAddress(faucetAddress, 6)}
            </a>
          </p>
        ) : null}
      </footer>
    </div>
  );
}

export default App;
