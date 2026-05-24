# PCT/LNK/MSH NATS Integration Closeout

Date: 2026-05-24

## Verdict

The NATS integration lane is closed as a layered stack:

- `@tmnl/msh` remains the generic NATS transport/auth/control-plane substrate.
- `@tmnl/lnk` owns durable stream semantics, framing, offsets, and CAS append policy.
- `@tmnl/pct` owns schema registry semantics, typed schema resolution, NATS control-plane endpoints, and projection scheduler contracts.

No root lockfile or unrelated workspace churn belongs to this closeout.

## Commit map by layer

### MSH substrate

| Commit | Role |
|---|---|
| `bef23ed0` `docs(msh): close critical scrutiny remediation` | Records closeout of earlier MSH scrutiny remediation. |
| `c0b8807c` `feat(msh): add schema-backed micro endpoint host` | Adds generic schema-backed NATS micro endpoint host seam. |
| `4369f5da` `feat(msh): expose KV CAS and safe consumer wrappers` | Adds KV revision-aware helpers, revision conflict errors, safe consumer wrappers, and live/mock coverage. |

Boundary: no PCT/LNK domain semantics in MSH source. Micro endpoints are generic request/reply control-plane substrate.

### LNK bridge substrate

| Commit | Role |
|---|---|
| `c9299eb7` `test(lnk): make live NATS harness shell-independent` | Makes live NATS harness reproducible under restricted PATH. |
| `95d192d4` `feat(lnk): add MSH-backed bridge wire substrate` | Adds concrete `MshBridgeWire` over MSH JetStream/KV plus CAS append and conformance tests. |

Boundary: LNK owns stream framing, append semantics, offsets, and bridge conformance. MSH stores/publishes opaque bytes.

### PCT typed proof, control plane, and projection contracts

| Commit | Role |
|---|---|
| `6af61f1b` `test(pct): prove typed LNK binding over MSH bridge` | Proves PCT HTTP schema resolution drives LNK `TypedLnk` over real MSH/NATS. |
| `58b54891` `feat(pct): add NATS schema resolver control plane` | Adds PCT NATS `SchemaResolverLayer` and micro endpoint compatibility proof. |
| `8c876c72` `feat(pct): wire MSH bridge and NATS control config` | Adds config/CLI/server wiring for MSH bridge and NATS control plane. |
| `2cdc4dc4` `docs(pct): document NATS control-plane proof` | Documents proof posture and demo path. |
| `c1a8b152` `feat(pct): add frame projection scheduler contracts` | Adds frame projection specs, compiler, registry, worker contracts, and NATS worker host seam. |
| `7316fa03` `fix(pct): bound projection scheduler retry parking` | Bounds parking/retry behavior and exposes scheduler pressure. |
| `6dd3995b` `docs(pct): add system capability audit` | Records capability posture for registry/control/projection surfaces. |
| `dc30d935` `fix(pct): preserve package boundary typechecking` | Keeps PCT TypeScript from resolving workspace path aliases into MSH source. |
| `016a4884` `feat(pct): expose projection scheduler lookout` | Adds non-destructive scheduler lookout before draining parked work. |

Boundary: PCT owns registry/control-plane semantics. Its NATS resolver consumes MSH substrate through package APIs.

## Boundary review

Observed checks:

```bash
rg -n "@tmnl/(pct|lnk)|packages/(pct|lnk)|from ['\"].*(pct|lnk)|import\(['\"].*(pct|lnk)" \
  packages/msh/src packages/msh/test packages/msh/docs
```

Result interpretation:

- `packages/msh/src` and `packages/msh/test` have no PCT/LNK imports.
- Matches are documentation-only RFC/inventory references explaining the boundary.
- `packages/pct/tsconfig.json` clears inherited workspace `paths` so PCT typecheck resolves workspace dependencies through package boundaries instead of compiling MSH internals.

## Validation commands

Latest closeout run:

- MSH normal suite: 11 files passed / 4 skipped; 104 tests passed / 12 skipped; typecheck passed.
- MSH live suite: 4 files passed; 12 tests passed.
- LNK bridge suite: 8 files passed / 1 skipped; 47 tests passed / 2 skipped; typecheck passed.
- PCT typed/NATS proof suite: 2 files passed; 4 tests passed.
- PCT config/projection suite: 6 files passed; 44 tests passed; typecheck passed.

### MSH

```bash
cd packages/msh && bunx vitest run
cd packages/msh && bunx tsc --noEmit --pretty false
cd packages/msh && MSH_LIVE_NATS=1 bunx vitest run test/live-*.test.ts --reporter verbose
```

### LNK

```bash
cd packages/lnk && bunx vitest run test/services/wire/NatsBridgeWire.test.ts test/services/wire/nats-bridge/*.test.ts --fileParallelism=false
cd packages/lnk && bunx tsc --noEmit --pretty false
```

### PCT

```bash
cd packages/pct && LNK_LIVE_NATS=1 bunx vitest run test/pct-lnk-msh-typed-proof.test.ts test/pct-nats-schema-resolver.test.ts --reporter verbose
cd packages/pct && bunx vitest run test/config.test.ts test/frame-projections.test.ts test/projection-registry.test.ts test/projection-scheduler.test.ts test/projection-worker-contracts.test.ts test/projection-worker-nats-host.test.ts --fileParallelism=false
cd packages/pct && bunx tsc --noEmit --pretty false
```

## Next seams, deliberately not in this lane

- A dedicated operational diagnostics/doctor lane for MSH.
- PCT projection worker runtime integration beyond contracts/host seam.
- Full root/workspace dirty-state triage for unrelated datagrid/TMNL/db/entity churn.
- Any root `bun.lock` reconciliation as its own explicit lockfile review.
