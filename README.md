# CLRTY-1 ALE — Atomic Liquidity Engine

MCP-style service for **CLRTY-1** (`clrty-1` / `1202`): Signal → 1inch Fusion → USDT settlement.

Execute paths **fail closed** if `probeClrty1` fails (unless `dryRun: true`).

## Endpoints

| Method | Path | Body |
|--------|------|------|
| `GET` | `/health` | — (`clrty1`, `ebpf_policy`, `pool_loops`) |
| `POST` | `/v1/ale/execute` | `{ amount, srcToken?, dstToken?, dryRun? }` |
| `POST` | `/v1/pools/:action` | `{ asset, amount, poolId?, dryRun? }` — `addLiquidity` \| `removeLiquidity` \| `rebalance` \| `quotePool` |

## Skill

`manifests/skill.json` — `CLRTY-ALE-001` (substrate `CLRTY-1`, components Clarity / Tether / 1inch).

## Env

| Variable | Default |
|----------|---------|
| `CLRTY_L1_RPC` | `https://rpc.clarity-fintech.com` |
| `CLRTY_API_BASE` | `https://api.clarity-fintech.com` |
| `CLRTY_RPC_SMOKE` | `1` (set `0` for offline CI) |
| `ONEINCH_API_KEY` | unset → Fusion mock |
| `PORT` | `8101` |

## Run

```bash
cp .env.example .env
npm install
npm test
npm run build
npm start
```

```bash
curl -s http://127.0.0.1:8101/health
curl -s -X POST http://127.0.0.1:8101/v1/ale/execute \
  -H 'content-type: application/json' \
  -d '{"amount":"1000000","dryRun":true}'
```

## Security

See `security/CHECKLIST.md` and `security/ebpf/filters.yaml` (deny-by-default allowlist).

## License

Apache-2.0 © Clarity Fintech
