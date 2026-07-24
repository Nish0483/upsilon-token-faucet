export type RejectReason =
  | "too_many_requests_per_minute"
  | "ip_daily_limit"
  | "vpn_or_proxy_blocked"
  | "wallet_cooldown"
  | "invalid_chain"
  | "invalid_address"
  | "faucet_unconfigured"
  | "server_error";

export type RejectionBody = {
  error: string;
  reason: RejectReason;
  title: string;
  message: string;
  [key: string]: unknown;
};

function rejection(
  reason: RejectReason,
  title: string,
  message: string,
  extra: Record<string, unknown> = {},
): RejectionBody {
  return { error: reason, reason, title, message, ...extra };
}

export function rateLimitRejection(limitPerMin: number, ip: string) {
  return rejection(
    "too_many_requests_per_minute",
    "Too many requests",
    `Max ${limitPerMin}/min from one IP. Wait a minute and try again.`,
    { limitPerMin, ip },
  );
}

export function ipDailyLimitRejection(limitPerDay: number, claimsToday: number, ip: string) {
  return rejection(
    "ip_daily_limit",
    "Daily IP limit reached",
    `${claimsToday}/${limitPerDay} claims used today across all chains.`,
    { limitPerDay, claimsToday, ip },
  );
}

export function vpnProxyRejection(detection: string, ip: string) {
  const kind = detection.replace(/_/g, " ").trim() || "VPN / proxy";
  return rejection(
    "vpn_or_proxy_blocked",
    "VPN / proxy blocked",
    `Detected ${kind}. Use a residential connection.`,
    { detection: kind, ip },
  );
}

export function walletCooldownRejection(secondsLeft: string, chain: string) {
  const hours = Math.ceil(Number(secondsLeft) / 3600);
  return rejection(
    "wallet_cooldown",
    "Wallet cooldown",
    Number.isFinite(hours)
      ? `Already claimed on ${chain} (~${hours}h left). Try another network.`
      : `Already claimed on ${chain}. Try another network.`,
    { secondsLeft, chain },
  );
}

export function invalidChainRejection() {
  return rejection("invalid_chain", "Invalid network", "Use sepolia, hoodi, or bsc.");
}

export function invalidAddressRejection() {
  return rejection("invalid_address", "Invalid wallet", "Provide a valid 0x address.");
}

export function faucetUnconfiguredRejection(chain: string) {
  return rejection(
    "faucet_unconfigured",
    "Faucet not configured",
    `No faucet for ${chain} on this server.`,
    { chain },
  );
}

export function serverErrorRejection(detail: string) {
  return rejection("server_error", "Server error", "Drip failed. Try again shortly.", {
    detail,
  });
}
