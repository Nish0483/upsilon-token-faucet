/** Map API rejection → single-line UI copy. */
export type RejectionPayload = {
  error?: string;
  reason?: string;
  title?: string;
  message?: string;
  claimsToday?: number;
  limitPerDay?: number;
  detection?: string;
};

export function formatRejection(data: RejectionPayload): string {
  const reason = data.reason || data.error;

  if (reason === "ip_daily_limit") {
    const n =
      typeof data.claimsToday === "number" && typeof data.limitPerDay === "number"
        ? ` (${data.claimsToday}/${data.limitPerDay} today)`
        : "";
    return `Daily IP limit reached${n} — switching wallets does not reset this.`;
  }

  if (reason === "vpn_or_proxy_blocked") {
    const kind = data.detection?.trim();
    return kind
      ? `VPN / proxy blocked — detected ${kind}. Turn it off and retry.`
      : "VPN / proxy blocked — turn off VPN/proxy and retry.";
  }

  if (data.title && data.message) return `${data.title} — ${data.message}`;
  return data.message || data.title || data.error || "Request failed";
}
