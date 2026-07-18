import { describe, expect, it } from "vitest";
import { probeClrty1, loadClrty1Config, rpcSmokeEnabled } from "../src/clrty1.js";

describe("clrty1 smoke", () => {
  it("probes live RPC when CLRTY_RPC_SMOKE != 0", async () => {
    if (!rpcSmokeEnabled(process.env)) {
      expect(true).toBe(true);
      return;
    }
    const probe = await probeClrty1(loadClrty1Config());
    expect(probe.ok).toBe(true);
  });
});
