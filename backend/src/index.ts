import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { isAddress, type Address } from "viem";
import { assessIpRisk, extractClientIp } from "./ip.js";
import {
  CHAINS,
  type ChainKey,
  dripTo,
  getOperatorAccount,
  readCanClaim,
} from "./drip.js";
import {
  faucetUnconfiguredRejection,
  invalidAddressRejection,
  invalidChainRejection,
  ipDailyLimitRejection,
  rateLimitRejection,
  serverErrorRejection,
  vpnProxyRejection,
  walletCooldownRejection,
  type RejectionBody,
} from "./rejections.js";

const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174";
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 10);
const MAX_CLAIMS_PER_IP_PER_DAY = Number(process.env.MAX_CLAIMS_PER_IP_PER_DAY || 6);

const ipClaims = new Map<string, { count: number; day: string }>();

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function bumpIpCount(ip: string): { allowed: boolean; count: number } {
  const day = todayUtc();
  const cur = ipClaims.get(ip);
  if (!cur || cur.day !== day) {
    ipClaims.set(ip, { count: 1, day });
    return { allowed: true, count: 1 };
  }
  if (cur.count >= MAX_CLAIMS_PER_IP_PER_DAY) {
    return { allowed: false, count: cur.count };
  }
  cur.count += 1;
  return { allowed: true, count: cur.count };
}

function logBlocked(
  body: RejectionBody,
  ip: string,
  chain: string,
  address: string,
  extra?: Record<string, unknown>,
) {
  console.warn(
    "[BLOCKED]",
    JSON.stringify({
      event: "CLAIM_BLOCKED",
      reason: body.reason,
      detail: body.message,
      ip,
      chain: chain || null,
      address: address || null,
      at: new Date().toISOString(),
      ...extra,
    }),
  );
}

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY !== "false");
app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  }),
);
app.use(express.json({ limit: "32kb" }));

const limiter = rateLimit({
  windowMs: 60_000,
  max: RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => extractClientIp(req),
  handler: (req, res) => {
    const ip = extractClientIp(req);
    const chain = String(req.body?.chain ?? "");
    const address = String(req.body?.address ?? "");
    const body = rateLimitRejection(RATE_LIMIT_PER_MIN, ip);
    logBlocked(body, ip, chain, address, { limitPerMin: RATE_LIMIT_PER_MIN });
    res.status(429).json(body);
  },
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    operator: getOperatorAccount().address,
    limits: {
      maxClaimsPerIpPerDay: MAX_CLAIMS_PER_IP_PER_DAY,
      rateLimitPerMin: RATE_LIMIT_PER_MIN,
    },
    faucets: {
      sepolia: CHAINS.sepolia.faucet ?? null,
      hoodi: CHAINS.hoodi.faucet ?? null,
      bsc: CHAINS.bsc.faucet ?? null,
    },
  });
});

app.post("/api/drip", limiter, async (req, res) => {
  const started = Date.now();
  const ip = extractClientIp(req);
  const chain = String(req.body?.chain ?? "") as ChainKey;
  const user = String(req.body?.address ?? "");

  console.log(
    "[REQ]",
    JSON.stringify({ event: "DRIP_RECEIVED", ip, chain, address: user || null }),
  );

  try {
    if (!["sepolia", "hoodi", "bsc"].includes(chain)) {
      const body = invalidChainRejection();
      logBlocked(body, ip, chain, user);
      res.status(400).json(body);
      return;
    }
    if (!isAddress(user)) {
      const body = invalidAddressRejection();
      logBlocked(body, ip, chain, user);
      res.status(400).json(body);
      return;
    }
    if (!CHAINS[chain].faucet) {
      const body = faucetUnconfiguredRejection(chain);
      logBlocked(body, ip, chain, user);
      res.status(503).json(body);
      return;
    }

    const risk = await assessIpRisk(ip);
    if (risk.blocked) {
      const body = vpnProxyRejection(risk.reason ?? "VPN / proxy", ip);
      logBlocked(body, ip, chain, user, { detection: risk.reason });
      res.status(403).json(body);
      return;
    }

    const { canClaim, secondsLeft } = await readCanClaim(chain, user as Address);
    if (!canClaim) {
      const body = walletCooldownRejection(secondsLeft.toString(), chain);
      logBlocked(body, ip, chain, user, { secondsLeft: secondsLeft.toString() });
      res.status(429).json(body);
      return;
    }

    const ipQuota = bumpIpCount(ip);
    if (!ipQuota.allowed) {
      const body = ipDailyLimitRejection(MAX_CLAIMS_PER_IP_PER_DAY, ipQuota.count, ip);
      logBlocked(body, ip, chain, user, {
        limitPerDay: MAX_CLAIMS_PER_IP_PER_DAY,
        claimsToday: ipQuota.count,
      });
      res.status(429).json(body);
      return;
    }

    const txHash = await dripTo(chain, user as Address);

    console.log(
      "[OK]",
      JSON.stringify({
        event: "DRIP_SENT",
        ip,
        chain,
        address: user,
        txHash,
        ipClaimsToday: ipQuota.count,
        ms: Date.now() - started,
      }),
    );

    res.json({
      chain,
      faucet: CHAINS[chain].faucet,
      user,
      txHash,
      ip,
      ipClaimsToday: ipQuota.count,
      ipDailyLimit: MAX_CLAIMS_PER_IP_PER_DAY,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown_error";
    const body = serverErrorRejection(detail);
    logBlocked(body, ip, chain, user);
    console.error("[drip]", detail);
    res.status(500).json(body);
  }
});

app.listen(PORT, () => {
  console.log(`UPX faucet API on :${PORT}`);
  console.log(`Operator: ${getOperatorAccount().address}`);
  console.log(
    `Limits: ${MAX_CLAIMS_PER_IP_PER_DAY}/day per IP, ${RATE_LIMIT_PER_MIN}/min per IP`,
  );
  if (!process.env.PROXYCHECK_API_KEY?.trim()) {
    console.warn("[warn] PROXYCHECK_API_KEY unset — VPN/proxy checks are skipped");
  }
  console.log("Faucets:", {
    sepolia: CHAINS.sepolia.faucet,
    hoodi: CHAINS.hoodi.faucet,
    bsc: CHAINS.bsc.faucet,
  });
});
