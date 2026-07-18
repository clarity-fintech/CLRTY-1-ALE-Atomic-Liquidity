/** USDT settlement log against CLRTY-1 tip. */

import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadClrty1Config, probeClrty1, type Clrty1Config } from "./clrty1.js";

export type UsdtSettlement = {
  asset: "USDT";
  amount: string;
  txHash: string;
  tipHeight?: string | number;
  chainId: string;
  ts: string;
  status: "logged" | "rejected";
  reason?: string;
};

const STORE = join(process.cwd(), "var", "settlements.jsonl");

export async function settleUsdt(
  input: { amount: string; txHash: string },
  cfg: Clrty1Config = loadClrty1Config(),
): Promise<UsdtSettlement> {
  const probe = await probeClrty1(cfg);
  const record: UsdtSettlement = {
    asset: "USDT",
    amount: input.amount,
    txHash: input.txHash,
    tipHeight: probe.tipHeight,
    chainId: probe.chainId || cfg.chainId,
    ts: new Date().toISOString(),
    status: "logged",
  };

  if (!probe.ok) {
    record.status = "rejected";
    record.reason = probe.error || "clrty1_unreachable";
  }

  await mkdir(dirname(STORE), { recursive: true });
  await appendFile(STORE, `${JSON.stringify(record)}\n`, "utf8");

  // Best-effort finalize to CLRTY API / KV
  if (record.status === "logged" && process.env.CLRTY_SETTLE_FINALIZE === "1") {
    try {
      await fetch(`${cfg.apiBase.replace(/\/$/, "")}/v1/settlements/usdt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch {
      /* ignore */
    }
  }

  return record;
}
