import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execute_ale_trade } from "../src/ale.js";
import { oneInchConfigured } from "../src/oneinch.js";
import { validateEbpfPolicy } from "../src/security/validate_ebpf.js";
import {
  CLRTY1_CHAIN_ID,
  CLRTY1_NUMERIC_CHAIN_ID,
  loadClrty1Config,
  rpcSmokeEnabled,
} from "../src/clrty1.js";

describe("clrty1 config", () => {
  it("defaults to clrty-1 / 1202", () => {
    const cfg = loadClrty1Config({});
    expect(cfg.chainId).toBe(CLRTY1_CHAIN_ID);
    expect(cfg.numericChainId).toBe(CLRTY1_NUMERIC_CHAIN_ID);
  });

  it("respects CLRTY_RPC_SMOKE=0", () => {
    expect(rpcSmokeEnabled({ CLRTY_RPC_SMOKE: "0" })).toBe(false);
  });
});

const offlineEnv = {
  CLRTY_RPC_SMOKE: "0",
  CLRTY_L1_RPC: "http://127.0.0.1:9",
  CLRTY_L1_RPC_FALLBACK: "http://127.0.0.1:9",
  CLRTY_API_BASE: "http://127.0.0.1:9",
  CLRTY_EXCHANGE_HEALTH: "http://127.0.0.1:9",
  ONEINCH_API_KEY: "",
};

describe("execute_ale_trade", () => {
  it("fail-closed when probe fails and not dryRun", async () => {
    const result = await execute_ale_trade(
      { amount: "1000", dryRun: false },
      offlineEnv,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected_probe");
  });

  it("dryRun proceeds with mock Fusion + USDT settle log", async () => {
    const result = await execute_ale_trade(
      { amount: "2500", srcToken: "ETH", dstToken: "USDT", dryRun: true },
      offlineEnv,
    );
    expect(result.ok).toBe(true);
    expect(result.quote?.mode).toBe("mock");
    expect(result.swap?.status).toBe("success");
    expect(result.settlement?.asset).toBe("USDT");
    expect(oneInchConfigured({})).toBe(false);
  });
});

describe("security + skill", () => {
  it("validates eBPF deny-by-default policy", () => {
    const ebpf = validateEbpfPolicy(process.cwd());
    expect(ebpf.ok).toBe(true);
    expect(ebpf.version).toBeTruthy();
  });

  it("skill manifest declares CLRTY-ALE-001 + CLRTY-1 substrate", () => {
    const skill = JSON.parse(
      readFileSync(join(process.cwd(), "manifests/skill.json"), "utf8"),
    ) as {
      skill_id: string;
      operational_logic: { substrate: string };
      components: string[];
    };
    expect(skill.skill_id).toBe("CLRTY-ALE-001");
    expect(skill.operational_logic.substrate).toBe("CLRTY-1");
    expect(skill.components.some((c) => c.includes("1inch"))).toBe(true);
    expect(skill.components.some((c) => c.includes("tether"))).toBe(true);
  });
});
