import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import {
  loadClrty1Config,
  getClrty1ConnectionReport,
  CLRTY1_CHAIN_ID,
} from "./clrty1.js";
import { execute_ale_trade, type AleOrder } from "./ale.js";
import { runPoolLoop, poolLoopsVersion, type PoolAction } from "./liquidity/pool_loops.js";
import { validateEbpfPolicy } from "./security/validate_ebpf.js";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const POOL_ACTIONS = new Set<PoolAction>([
  "addLiquidity",
  "removeLiquidity",
  "rebalance",
  "quotePool",
]);

export function createApp() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        const cfg = loadClrty1Config();
        const clrty1 = await getClrty1ConnectionReport(cfg);
        const ebpf = validateEbpfPolicy();
        return send(res, 200, {
          ok: true,
          service: "CLRTY-1-ALE-Atomic-Liquidity",
          chainId: CLRTY1_CHAIN_ID,
          clrty1,
          ebpf_policy: ebpf,
          pool_loops: poolLoopsVersion(),
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/ale/execute") {
        const body = (await readJson(req)) as Partial<AleOrder>;
        if (!body.amount) {
          return send(res, 400, { ok: false, error: "amount is required" });
        }
        const result = await execute_ale_trade({
          amount: String(body.amount),
          srcToken: body.srcToken ? String(body.srcToken) : undefined,
          dstToken: body.dstToken ? String(body.dstToken) : undefined,
          dryRun: Boolean(body.dryRun),
        });
        return send(res, result.ok ? 200 : 503, result);
      }

      const poolMatch = url.pathname.match(/^\/v1\/pools\/([a-zA-Z]+)$/);
      if (req.method === "POST" && poolMatch) {
        const action = poolMatch[1] as PoolAction;
        if (!POOL_ACTIONS.has(action)) {
          return send(res, 400, {
            ok: false,
            error: `unknown pool action; use ${[...POOL_ACTIONS].join("|")}`,
          });
        }
        const body = (await readJson(req)) as {
          asset?: string;
          amount?: string;
          poolId?: string;
          dryRun?: boolean;
        };
        if (!body.amount) {
          return send(res, 400, { ok: false, error: "amount is required" });
        }
        const asset = (body.asset === "USDT" ? "USDT" : "CLRTY") as "CLRTY" | "USDT";
        const intent = await runPoolLoop(action, {
          asset,
          amount: String(body.amount),
          poolId: body.poolId,
          dryRun: Boolean(body.dryRun),
        });
        return send(res, intent.status === "rejected" ? 503 : 200, { ok: intent.status !== "rejected", intent });
      }

      return send(res, 404, { ok: false, error: "not_found" });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

const isMain =
  process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT || 8101);
  const server = createApp();
  server.listen(port, () => {
    console.log(`CLRTY-1-ALE-Atomic-Liquidity listening on :${port}`);
  });
}
