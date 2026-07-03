# Lnk wire implementation findings

**Task:** verify hypothesis that only in-memory + HTTP wires are implemented in `packages/lnk/src`, and NATS bridge is only planned; include `packages/pct/src/cli/serve.ts` impact.

## Hypothesis
`@tmnl/lnk` currently has concrete in-memory and HTTP wire implementations in `src`, while NATS-backed bridge is documented as a future phase and is not implemented.

## Method
Read-only inspection only (`read`, `find`, `rg`, `bash`, `nl`) across:
- `packages/lnk/src/services/wire/*`
- `packages/lnk/test/services/wire/*`
- `packages/pct/src/cli/serve.ts`
- quick filesystem checks for `packages/lnk/docs/src`
- no file edits until final report file.

## Findings (evidence)

### 1) Wire implementations present in `packages/lnk/src`
- `packages/lnk/src/services/wire/Wire.ts:9-13` lists implementations as:
  - `InMemoryWire`, `HttpWire`, and `NatsBridgeWire (Phase 5)`.
  - This comment describes NATS as future-only (`Phase 5`).
- `packages/lnk/src/services/wire/index.ts:7-15` documents `./in-memory`, `./http`, and `./nats-bridge` (planned).
- `packages/lnk/src/services/wire/index.ts:64-65` actually re-exports only:
  - `InMemory`
  - `Http`
- `packages/lnk/src/services/wire/in-memory/index.ts:10-11` defines/exports `InMemoryWire` and inner.
- `packages/lnk/src/services/wire/http/index.ts:15-16` defines/exports `HttpWire`, `HttpInner`, `Routes`.
- `packages/lnk/src/index.ts:50-54` states Phase 5 (NATS-bridge) is **not started**.

### 2) Package surface confirms only current concrete wire subpaths
- `packages/lnk/package.json:30-40` exports `./services/wire/in-memory` and `./services/wire/http`; no `./services/wire/nats-bridge` export path.

### 3) `packages/lnk/docs/src/tests` does not exist
- Filesystem check output captured at `/tmp/spark/lnk-wire/lnk-tree.txt:1-12`:
  - `src-dirs` show only `packages/lnk/src/services/wire/http` and `.../in-memory`.
  - `docs-dir-find` section reports missing:
    - `missing: packages/lnk/docs`
    - `missing: packages/lnk/docs/src`
- (So tests/docs location appears to be `packages/lnk/test`, not `packages/lnk/docs/src/tests`.)

### 4) PCT serve composition context
- `packages/pct/src/cli/serve.ts:170-178` composes:
  - `PactRoutes`
  - `LnkServices.Wire.Http.Routes`
  - provides `LnkServices.Wire.InMemory.InMemoryWire.layer`.
- This shows the serve path currently binds the shared HTTP routes to the Lnk HTTP surface, but wires to **InMemory** transport by default.

### 5) Additional corroboration of NATS bridge status
- `rg` scan of `packages/lnk/src` only finds `NatsBridgeWire` mentions in comments at:
  - `packages/lnk/src/services/wire/Wire.ts:12`
  - `packages/lnk/src/services/wire/index.ts:11`
  - no implementation references.

## Verdict
**PARTIAL/WORKING for hypothesis.**

Observed implementation status matches the hypothesis at a high level:
- ✅ In-memory and HTTP wires are concretely implemented.
- ✅ NATS bridge is still planned (phase docs/comments) and not materialized in `src`.
- ⚠ Requested path `packages/lnk/docs/src/tests` is absent; relevant tests are in `packages/lnk/test`.

## Next required work
1. Implement `packages/lnk/src/services/wire/nats-bridge/*` (`NatsBridgeWire` + inner adapter + transport mapping over NATS/JetStream).
2. Add it to `packages/lnk/src/services/wire/index.ts` and `packages/lnk/package.json` exports.
3. Add/extend tests (currently only `packages/lnk/test/services/wire/http` and `.../in-memory`).
4. Decide if `packages/pct/src/cli/serve.ts` should allow runtime selection of wire impl (currently hard-pinned to `InMemoryWire.layer`).
