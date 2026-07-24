export function formatUnits(value: bigint, decimals = 18, maxFrac = 4): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  if (frac === 0n) return `${neg ? "-" : ""}${whole.toString()}`;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "ready";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
