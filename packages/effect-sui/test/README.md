# Effect-Sui Test Tiers

Effect-Sui uses fast tests for contract feedback, but **localnet is the primary confidence surface** for Sui semantics.

Prime directive: if behavior depends on real Sui rules — object refs, PTB build/dry-run, gas/payment, signing, execution, effects, events, checkpoints, GraphQL/indexer visibility, package publish/upgrade, or Move fixture behavior — the feature does not close until a localnet proof exists.

## Tier matrix

| Tier | Directory | Runtime | Purpose | Close-gate authority |
|---|---|---|---|---|
| Unit | `src/**/*.test.ts`, `test/unit/**/*.test.ts` | No network | Type-level and small behavior checks | Supplemental only |
| Property | `test/property/**/*.test.ts` | No network | Normalization, serialization, invariant fuzzing | Supplemental only |
| Integration | `test/integration/**/*.test.ts` | Fake client / local process only | Service contracts and failure classification without chain I/O | Supplemental only |
| E2E / localnet | `test/e2e/**/*.test.ts` | Docker Sui localnet + Postgres/indexer | Real Sui semantics over Mysten SDK, gas, refs, execution, GraphQL | Required for chain-facing features |

## Localnet-required feature surfaces

A localnet proof is required before closing any slice that touches:

- `SuiPTB` compile/build/dry-run behavior.
- `SuiObjectResolver` object refs, ownership, shared/receiving args, or content decode.
- `SuiBcsBridge` behavior against real object content or Move-call pure inputs.
- `SuiGasPlanner` / `SuiPaymentService` gas coins, budgets, address-balance gas, gas smashing, or sponsor data.
- `SuiAuthService` signing, wallet/offline payloads, or sponsored signatures.
- `SuiExecutionService` / `SuiFinalityService` transaction submission, `waitForTransaction`, effects, events, object changes, or checkpoint/indexer visibility.
- `SuiPackageRegistry` / `SuiModule` generated factories, publish/upgrade, or fixture package integration.

Unit/fake tests are useful for keeping service seams honest. They are not evidence that the Sui integration works.

## Harness modes

```bash
# Fast config/compile smoke; intentionally does not prove Sui semantics.
EFFECT_SUI_E2E_MODE=skip bun run test:e2e

# Primary proof path: starts Docker localnet unless testcontainers are unavailable.
bun run test:e2e

# Reuse an externally managed localnet.
EFFECT_SUI_E2E_MODE=external \
  SUI_FULLNODE_URL=http://127.0.0.1:9000 \
  SUI_FAUCET_URL=http://127.0.0.1:9123 \
  SUI_GRAPHQL_URL=http://127.0.0.1:9125/graphql \
  bun run test:e2e
```

NX equivalent:

```bash
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false \
  EFFECT_SUI_E2E_MODE=skip \
  bunx nx run @tmnl/effect-sui:test:e2e

NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false \
  bunx nx run @tmnl/effect-sui:test:e2e
```

## Harness implementation

The e2e harness follows Mysten's own TS SDK pattern in:

- `../../submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts`
- `../../submodules/ts-sdks/packages/sui/test/e2e/utils/setupEnv.ts`

Effect-Sui's local harness lives in:

- `test/e2e/utils/globalSetup.ts`
- `test/e2e/utils/setupEnv.ts`
- `test/e2e/utils/prepublish.ts`
- `test/e2e/localnet.smoke.test.ts`

The default Docker path uses:

- `mysten/sui-tools:${SUI_TOOLS_TAG}`
- `postgres:16`
- `sui start --with-faucet --force-regenesis --with-graphql --with-indexer=postgres://...`

Do not mutate `~/.sui`; package-local config/data belong under `.direnv/sui`.

## Commit policy

For slices that require localnet proof:

1. Run fast gates first: `bun run typecheck`, `bun run test:run`, targeted property/integration tests.
2. Run skip-mode e2e only as harness smoke.
3. Run real localnet e2e before closing the feature.
4. If Docker/localnet is unavailable, leave the feature open or explicitly blocked; do not call it done based on fake tests.
5. Stage explicit paths only. Never `git add -A`.
