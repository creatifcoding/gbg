# Effect-Sui Effect Boundary Audit

Status: active audit before further mainline implementation.

Prime directive: production code should expose failures as typed Effect values at service boundaries. Throwing helpers are allowed only when they are deliberately unsafe/sync APIs or inside third-party library boundaries captured by `Effect.try` / `Effect.tryPromise`.

## Commit strategy

Do not commit the working tree as one blob unless we intentionally choose a single hardening cut. Preferred split:

1. **Namespace API cut** — `SuiPTB.make`, `SuiPTB.makeBuilder`, `SuiFlow.makeGasPlanner`, `SuiQuery.makeObjectResolver`; remove long `makeSui*` exports and update docs/tests.
2. **Effect boundary hardening** — query/BCS, flow/payment/auth, PTB analyzer/compiler, effectable package lookup, and fake registry all return typed `Effect` failures instead of throwing plain errors.

Because the namespace cut and Effect-boundary edits are now interleaved in `ptb`, `flow`, and `query`, clean split requires patch-level staging. If we do not need surgical history, commit them together as: `Refine Effect-Sui namespace API and Effect boundaries`.

## Audit result

### Mechanical grep

Current production source result:

```text
rg -n "throw new|throw error|Promise\.reject|new Promise|async function" src -g'*.ts'
# no matches
```

Remaining `try` / `catch` sites are either:

- `Effect.try` / `Effect.tryPromise` boundaries around SDK calls, sync schema decodes, BigInt parsing, and transaction mutation.
- Schema filter internals that convert third-party parser/base58 failures into boolean validation results.

### Query / BCS bridge

Files: `src/query/index.ts`

Before:

- BCS `serializeWithCodec` was a normal function that threw.
- Codec parse/serialize errors were normalized outside the real failure site.
- Object resolver mixed typed errors with imperative helper control flow.

Current working tree:

- BCS codec parse/serialize return `Effect` via `Effect.tryPromise`.
- Missing codec operations fail via `Effect.fail(new SuiSchemaDecodeError(...))`.
- Object resolution uses `Effect.gen` with typed `Effect.fail` branches.
- Query tests use `Effect.runPromise` where async boundaries are now real.

### Flow / payment / auth

Files: `src/flow/index.ts`

Before:

- `makeGasPlanner.plan` wrapped an async helper in `Effect.tryPromise`.
- `makePaymentService.plan` wrapped throwy sync validation in `Effect.try`.
- `authorizeWithPolicy` was an async helper that threw for missing auth policy, invalid artifact, invalid signer, unsupported policy.

Current working tree:

- Gas price and budget parsing return `Effect<SuiGasPlan, SuiInvariantViolation>` paths.
- Payment overlap detection returns `Effect.fail(new SuiInvariantViolation(...))`.
- Auth policy handling is an `Effect.gen` program.
- Transaction build/signing are the exact `Effect.tryPromise` SDK boundaries.

### PTB analyzer/compiler

Files: `src/ptb/index.ts`

Before:

- `makeAnalyzer` and `makeCompiler` wrapped broad pure helpers with `Effect.try`.
- `validateArgument`, `rejectGasCoin`, `compileArg`, and unsupported command branches threw plain `Error`.

Current working tree:

- `analyzePtb(...)` returns `Effect<SuiPtbAnalysis, SuiInvariantViolation>`.
- `compilePtb(...)` returns `Effect<SuiPtbBuildArtifact<Transaction>, SuiInvariantViolation>`.
- Analyzer validation returns typed `Effect.fail` values.
- Compiler mutation around Mysten `Transaction` is localized behind `Effect.try`.

### Effectable facade methods

Files: `src/effectable/index.ts`

Before:

- `SuiPackage.module(name)` threw when a module was not declared.

Current working tree:

- `SuiPackage.module(name)` returns `Effect<SuiModule, SuiInvariantViolation>`.

### Schema helpers

Files: `src/schema/index.ts`

Before:

- `normalizeSuiTypeTag` threw on invalid vector/struct syntax.

Current working tree:

- Type-tag normalization uses `normalizeSuiTypeTagOption` internally.
- Invalid type tags are rejected through Schema validation instead of package-authored throws.
- Existing sync decode helpers remain intentionally sync; if we want stricter API clarity, follow up by adding Effect-returning decode helpers and/or renaming sync helpers to `unsafeDecode*`.

### Testing utilities

Files: `src/testing/index.ts`

Before:

- Fake package registry threw inside an `Effect.sync` body.

Current working tree:

- Fake package registry misses fail with `SuiInvariantViolation`.

## Validation so far

```text
bun run typecheck
vitest run src/effectable/index.test.ts src/testing/index.test.ts src/ptb/index.test.ts src/flow/index.test.ts src/query/index.test.ts src/index.test.ts src/services/index.test.ts
```

Both pass in the current working tree.

## Remaining before commit

1. Run full direct package gates.
2. Run e2e skip gate.
3. Optionally run real localnet e2e after deciding this hardening cut is ready.
4. Decide whether to patch-stage two commits or commit one coherent hardening/API cut.
