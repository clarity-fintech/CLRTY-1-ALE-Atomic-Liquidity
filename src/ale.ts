/** Atomic Liquidity Engine — Signal → 1inch Fusion → USDT settle. */

import { loadClrty1Config, probeClrty1, type Clrty1Config } from "./clrty1.js";
import { getFusionQuote, fusionSwap } from "./oneinch.js";
import { settleUsdt } from "./settle_usdt.js";

export type AleOrder = {
  srcToken?: string;
  dstToken?: string;
  amount: string;
  dryRun?: boolean;
};

export type AleResult = {
  ok: boolean;
  status: string;
  signal?: {
    tipHeight?: string | number;
    chainId: string;
    size: string;
  };
  quote?: Awaited<ReturnType<typeof getFusionQuote>>;
  swap?: Awaited<ReturnType<typeof fusionSwap>>;
  settlement?: Awaited<ReturnType<typeof settleUsdt>>;
  error?: string;
};

export async function execute_ale_trade(
  order: AleOrder,
  env: NodeJS.ProcessEnv = process.env,
  cfg: Clrty1Config = loadClrty1Config(env),
): Promise<AleResult> {
  const dryRun = Boolean(order.dryRun);
  const probe = await probeClrty1(cfg);

  if (!dryRun && !probe.ok) {
    return {
      ok: false,
      status: "rejected_probe",
      error: probe.error || "clrty1_unreachable",
      signal: {
        tipHeight: probe.tipHeight,
        chainId: probe.chainId || cfg.chainId,
        size: order.amount,
      },
    };
  }

  const signal = {
    tipHeight: probe.tipHeight,
    chainId: probe.chainId || cfg.chainId,
    size: order.amount,
  };

  const srcToken = order.srcToken || "ETH";
  const dstToken = order.dstToken || "USDT";

  const quote = await getFusionQuote({
    srcToken,
    dstToken,
    amount: order.amount,
    env,
  });

  const swap = await fusionSwap(quote, env);
  if (swap.status !== "success") {
    return {
      ok: false,
      status: "swap_failed",
      signal,
      quote,
      swap,
      error: swap.note,
    };
  }

  const settlement = await settleUsdt(
    { amount: swap.received, txHash: swap.hash },
    cfg,
  );

  if (settlement.status === "rejected" && !dryRun) {
    return {
      ok: false,
      status: "settlement_rejected",
      signal,
      quote,
      swap,
      settlement,
      error: settlement.reason,
    };
  }

  return {
    ok: true,
    status: "Atomic Settlement Confirmed",
    signal,
    quote,
    swap,
    settlement,
  };
}
