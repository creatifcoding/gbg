# Consumer Migration Inventory — Holonet → v4 packages

> Status: strict-v4 guardrail inventory  
> Updated: 2026-05-17

## Guardrail

No Effect v3 consumer may import `@tmnl/msh` directly. `@tmnl/msh`, `@tmnl/pct`, and `@tmnl/lnk` are strict Effect v4 packages. Migration requires moving the consumer boundary to v4 first, or introducing an adapter inside the v4 package that is consumed only from v4 code.

The attempted NEX v3→v4 bridge was removed. It mixed `effect` and `effect-v4` in one file and was therefore invalid.

## Strict v4 audit results

| Check | Scope | Result |
|---|---|---|
| Actual `effect` v3 imports | `packages/msh`, `packages/pct`, `packages/lnk` source/test/config | none in source; only false-positive comments/string checks in `packages/lnk/vitest.config.ts` |
| `Effect.Service` usage | `packages/msh/src`, `packages/pct/src`, `packages/lnk/src` | none |
| `Context.Service` usage | `packages/msh/src`, `packages/pct/src`, `packages/lnk/src` | present (35 occurrences across strict-v4 package source) |
| Direct `@tmnl/msh` runtime imports outside `packages/msh` | `packages/**` excluding dist/node_modules | none |
| MSH typecheck | `packages/msh` | `bunx tsc --noEmit` passes |

## Remaining legacy Holonet consumers

These are **not** migrated yet. They remain on the legacy TMNL Effect v3/Holonet side until each owning domain is converted deliberately.

| Domain | Count | Files / imports | Migration route |
|---|---:|---|---|
| `nex/services` | 3 | `client.ts`, `events.ts`, `rpc.ts` import `@/lib/holonet/nats/inner` | Defer. Convert NEX service package to Effect v4 first, then depend on `@tmnl/msh/nats`. No bridge. |
| `agents/tasks` | 11 | task command router, log durability, micro host, layers, subject convention, tests | Later domain migration. Split into subject utilities (`@tmnl/msh/subject`) and transport services (`@tmnl/msh/nats`) only after v4 conversion. |
| `iiot/realtime` | 26 | HolonetBridge, layers, iiot-subjects, distributed tests | Later domain migration. Likely needs `@tmnl/dmn` policy boundary plus `@tmnl/msh` substrate. |
| `iiot/adapters` | 5 | Sparkplug adapter and KV state registry tests | Later v4 adapter migration; use `NatsKVService` after consumer is v4. |
| `tsingou-flow/adapters` | 3 | NATS adapter and Holonet bridge adapter | Later flow runtime migration. |
| `holonet/integration/spike` | 4 | spike bridge and tests | Candidate for deletion or archive, not migration. |
| `components/testbed` | 1 | Holonet durable streams testbed error type | Replace with `@tmnl/lnk` once the LNK NATS adapter exists. |
| `iiot/http` tests | 1 | legacy Holonet auth helper | Replace with MSH auth only after test harness is v4 or isolate as separate package test. |

## Migration sequencing

1. Keep `@tmnl/msh` strict v4 and protocol-neutral.
2. Do not add v3 compatibility shims in TMNL source.
3. For each legacy domain, first choose one of:
   - convert the domain package/module to Effect v4; or
   - leave it on legacy Holonet until its owning domain migrates.
4. Migrate in this order when ready:
   - NEX (smallest direct substrate surface: core request/subscribe/publish),
   - agents/tasks transport,
   - IIOT realtime bridge,
   - tsingou-flow adapters,
   - durable-stream UI/testbed via `@tmnl/lnk` adapter.
5. Delete legacy Holonet only after the import inventory reaches zero.

## Explicit non-plan

Do **not** build a bridge that imports both `effect` and `effect-v4`. That hides the migration problem and creates two runtimes in one service graph. Prime was correct to call this out.
