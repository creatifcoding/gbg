# GEOINT Registry + Ingest Operator Runbook

Status: active
Audience: operators + developers validating registry, migrations, and ingest stability

## 0) Preconditions

- Postgres reachable (`POSTGRES_HOST/PORT/DB/USER/PASSWORD`)
- From `packages/tmnl`
- Bun toolchain available

## 1) Fast path (default)

```bash
bun run geoint:rapid
```

What this now guarantees:
1. Runs `geoint:migrate` once.
2. Runs `geoint:migrate` a second time (idempotency/reproducibility).
3. Runs strict registry drift check (`geoint:registry:diff --strict`) including taxonomy + sources + aliases.
4. Runs GEOINT contract/parity tests (registry, planner, tools, sdk, provenance, entities).

If this command is green, registry + planner parity is green for local operator workflows.

---

## 2) Migrations only

```bash
bun run geoint:migrate
```

Expected output includes:
- `Migrations tracked (5)`
- taxonomy/source/STAC counts

If migration count regresses or jumps unexpectedly, stop and inspect `_migrations.ts` + `_registry.ddl.ts`.

---

## 3) Strict drift check only

```bash
bun run geoint:registry:diff --strict
```

Strict mode fails on any drift in:
- taxonomy rows
- source rows
- canonical source mapping
- alias rows
- STAC source set parity

Non-zero exit means runtime seed and DB are no longer in lockstep.

---

## 4) Optional live ingest smoke

```bash
RUN_GEOINT_INGEST_SMOKE=1 bun run geoint:rapid
# or
bun run geoint:rapid --with-ingest
```

This runs:
- `src/lib/geoint/ingestion/__tests__/IngestionPipeline.e2e.test.ts`

Use when validating real API + persistence path end-to-end.

---

## 5) CI gate behavior

Workflow: `.github/workflows/tmnl-geoint-ci.yml`

CI provisions Postgres and executes `bun run geoint:rapid` in `packages/tmnl`.

A CI failure means at least one of:
- migration reproducibility broke,
- registry drift exists,
- planner/tool/sdk parity regressed,
- provenance/entity contract tests regressed.

---

## 6) Incident triage quick map

### A) Migration fails
- Check DB credentials and container health.
- Re-run `bun run geoint:migrate`.
- Inspect `src/lib/geoint/migrations/_migrations.ts` ordering.

### B) Strict drift fails
- Run `bun run geoint:registry:diff --strict` and inspect JSON summary.
- Reconcile seed definitions in `src/lib/geoint/migrations/_registry.ddl.ts`.
- Re-run `bun run geoint:migrate` twice.

### C) Tool/SDK parity fails
- Run targeted tests:
```bash
bunx vitest run \
  src/lib/geoint/harness/__tests__/tools.test.ts \
  src/lib/geoint/harness/__tests__/code-mode-geoint-sdk.test.ts
```

### D) Provenance digest regression
- Run:
```bash
bunx vitest run \
  src/lib/geoint/registry/__tests__/provenance.test.ts \
  src/lib/geoint/entities/__tests__/geoint-entity.test.ts
```

---

## 7) Operator exit criteria

You are done when all are true:
- `bun run geoint:rapid` passes
- (if requested) ingest smoke passes
- no strict drift
- migration second pass remains clean

No green, no claim.
