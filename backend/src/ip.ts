import type { Request } from "express";
import requestIp from "request-ip";
import { isIP } from "node:net";
import ProxyCheck from "proxycheck-ts";

const PRIVATE_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|169\.254\.|::1$|fc00:|fe80:)/i;

export type IpRisk = { blocked: boolean; reason?: string };

function normalizeIp(ip: string) {
  return ip.trim().replace(/^::ffff:/, "");
}

function isLocal(ip: string) {
  return PRIVATE_RE.test(normalizeIp(ip));
}

export function extractClientIp(req: Request): string {
  const forced = process.env.FORCE_CLIENT_IP?.trim();
  if (forced && isIP(forced)) return normalizeIp(forced);

  const raw = requestIp.getClientIp(req) || req.socket.remoteAddress || "0.0.0.0";
  const ip = normalizeIp(raw);
  return isIP(ip) ? ip : "0.0.0.0";
}

export async function assessIpRisk(ip: string): Promise<IpRisk> {
  if (isLocal(ip)) {
    return process.env.ALLOW_LOCAL_IP === "true"
      ? { blocked: false }
      : { blocked: true, reason: "private_or_local_ip" };
  }

  const apiKey = process.env.PROXYCHECK_API_KEY?.trim();
  if (!apiKey) return { blocked: false };

  try {
    const client = new ProxyCheck({ api_key: apiKey });
    const row = (await client.checkIP(ip, { vpn: 2, asn: 1, risk: 1 }))[ip] as
      | { proxy?: string; type?: string; risk?: number }
      | undefined;

    if (!row || typeof row !== "object") return { blocked: false };

    const type = (row.type || "").toLowerCase();
    const risk = typeof row.risk === "number" ? row.risk : 0;
    const threshold = Number(process.env.IP_RISK_THRESHOLD || 66);
    const bad =
      row.proxy === "yes" ||
      /vpn|proxy|tor|socks|comp|hosting|data/.test(type) ||
      risk >= threshold;

    if (!bad) return { blocked: false };

    if (type.includes("vpn")) return { blocked: true, reason: "VPN" };
    if (type.includes("tor")) return { blocked: true, reason: "Tor" };
    if (type.includes("hosting") || type.includes("data")) {
      return { blocked: true, reason: "datacenter / hosting" };
    }
    if (risk >= threshold) return { blocked: true, reason: `high-risk IP (score ${risk})` };
    return { blocked: true, reason: "proxy" };
  } catch (err) {
    console.warn("[ip] proxycheck failed, allowing:", err instanceof Error ? err.message : err);
    return { blocked: false };
  }
}
