# PCT/LNK/MSH Diagnostics Surface Closeout

Date: 2026-05-26
Status: closed
Feature: `#F1138 PCT/LNK/MSH Production Observability and Diagnostics Surface`
Closeout feature: `#F1145 Audit, reimplementation checkpoint, and diagnostics closeout docs`
Tasks: `#4155`, `#4156`
Owner: HappyEagle

## 1. Verdict

The diagnostics lane is closed as a first production-readiness slice. It delivers
a Schema-backed, safe-to-log diagnostics vocabulary, package-local MSH/LNK/PCT
checks, a JSON rollup path, redaction helpers, targeted tests, and hardening docs
that make later soak/ACL/chaos lanes evidence-driven instead of vibes-driven.

No source reimplementation is required before closeout. The lane is deliberately
not a universal health oracle: live cross-layer report capture, fine-grained ACL
classification, and reconnect/status telemetry are named follow-ups.

## 2. Scope and non-goals

### In scope

- Generic diagnostics vocabulary exported from MSH:
  - `DiagnosticSeverity`
  - `DiagnosticCheckStatus`
  - `DiagnosticFinding`
  - `DiagnosticCheck`
  - `DiagnosticReport`
  - `maxSeverity`
- MSH substrate diagnostics:
  - core flush;
  - JetStream manager access;
  - stream info;
  - KV bucket readability;
  - safe auth metadata.
- LNK MSH bridge diagnostics:
  - metadata bucket readability;
  - bridge data stream info/presence.
- PCT semantic diagnostics:
  - registry snapshot;
  - SchemaResolver fetch;
  - NATS control-plane info/stats;
  - projection scheduler pressure.
- PCT diagnostics rollup script:
  - default PCT-only safe report;
  - `--report <file>` mode for precomputed MSH/LNK/PCT reports.
- Redaction helpers for sensitive strings, objects, and causes.
- Documentation and validation ledger entries.

### Explicit non-goals

- No broad production SLO dashboard.
- No Kubernetes health controller.
- No exact permission-profile proof; that belongs to `#F1160`.
- No disconnect/reconnect status telemetry; that belongs to `#F1161`.
- No destructive repair actions. Diagnostics are read-only.

## 3. Boundary review

Reference: [boundary-contracts.md](./boundary-contracts.md)

| Boundary | Verdict | Evidence |
| --- | --- | --- |
| MSH remains substrate-only | pass | `packages/msh/src/diagnostics/*` imports MSH auth/NATS substrate and generic diagnostics only. MSH PCT/LNK import scan returned no matches. |
| LNK owns durable stream semantics | pass | `packages/lnk/src/services/wire/nats-bridge/MshBridgeDiagnostics.ts` reports bridge substrate health while keeping LNK bridge config/stream identity local to LNK. |
| PCT owns contracts/control-plane policy | pass | `packages/pct/src/diagnostics/PctDiagnostics.ts` checks registry, SchemaResolver, NATS control-plane, and projection scheduler semantics. |
| STX is not used as server stream authority | pass | Diagnostics surface does not use STX. |
| Root/shared files are excluded or explicitly owned | pass | No root dependency or submodule files are part of this closeout. |

Boundary command:

```bash
rg -n "@tmnl/(pct|lnk)|packages/(pct|lnk)|from ['\"].*(pct|lnk)|import\(['\"].*(pct|lnk)" \
  packages/msh/src packages/msh/test || true
```

Observed result:

```text
(no matches)
```

## 4. Implementation map

| Layer | Files changed / relevant files | Purpose |
| --- | --- | --- |
| MSH | `packages/msh/src/diagnostics/schemas.ts` | Generic Schema-backed diagnostics vocabulary. |
| MSH | `packages/msh/src/diagnostics/redaction.ts` | Safe redaction helpers for diagnostics output. |
| MSH | `packages/msh/src/diagnostics/MshDiagnostics.ts` | Read-only substrate diagnostics service. |
| MSH | `packages/msh/test/diagnostics.test.ts`, `packages/msh/test/diagnostics-live.test.ts` | Mock/live diagnostics coverage. |
| LNK | `packages/lnk/src/services/wire/nats-bridge/MshBridgeDiagnostics.ts` | Bridge diagnostics over MSH substrate APIs. |
| LNK | `packages/lnk/test/services/wire/nats-bridge/MshBridgeDiagnostics.test.ts` | Bridge diagnostics coverage. |
| PCT | `packages/pct/src/diagnostics/PctDiagnostics.ts` | PCT semantic diagnostics service. |
| PCT | `packages/pct/src/diagnostics/Rollup.ts` | Cross-report rollup helpers. |
| PCT | `packages/pct/scripts/diagnostics-rollup.ts` | JSON diagnostics rollup script. |
| PCT | `packages/pct/test/pct-diagnostics.test.ts`, `packages/pct/test/diagnostics-rollup.test.ts` | PCT diagnostics and rollup coverage. |
| Docs/Ops | `packages/msh/docs/diagnostics-check-taxonomy.md` | Check vocabulary and layer contracts. |
| Docs/Ops | `packages/msh/docs/observability-diagnostics-feature-plan.md` | Diagnostics feature plan. |
| Docs/Ops | `packages/pct/docs/hardening/diagnostics-audit.md` | Audit and reimplementation checkpoint. |
| Docs/Ops | `packages/pct/docs/hardening/diagnostics-closeout.md` | This closeout. |

## 5. Public API and compatibility notes

New APIs / exports:

- `@tmnl/msh/diagnostics`
  - diagnostic schemas;
  - redaction helpers;
  - `MshDiagnosticsService`.
- LNK bridge diagnostics:
  - `MshBridgeDiagnostics` and `mshBridgeDiagnosticsLayer` on the NATS/MSH bridge surface.
- PCT diagnostics:
  - `PctDiagnosticsService`;
  - `rollupDiagnosticsReports`;
  - `collectPctDiagnosticsRollup`.
- PCT script:
  - `bun run diagnostics:rollup`.

Compatibility notes:

- MSH exports generic diagnostics vocabulary with `layer: string` so it does not
  encode PCT/LNK policy.
- The default PCT rollup is intentionally PCT-only unless precomputed reports are
  supplied via `--report`.
- Check IDs, not timestamped report IDs, are the stable contract.

## 6. Validation commands

### MSH diagnostics

```bash
cd packages/msh
bunx vitest run test/diagnostics.test.ts --reporter verbose
```

Result:

```text
1 file, 5 tests passed.
```

### LNK bridge diagnostics

```bash
cd packages/lnk
bunx vitest run test/services/wire/nats-bridge/MshBridgeDiagnostics.test.ts --reporter verbose
```

Result:

```text
1 file, 2 tests passed.
```

### PCT diagnostics and rollup

```bash
cd packages/pct
bunx vitest run test/pct-diagnostics.test.ts test/diagnostics-rollup.test.ts --reporter verbose
```

Result:

```text
2 files, 5 tests passed.
```

### PCT rollup smoke

```bash
cd packages/pct
bun run diagnostics:rollup --compact >/tmp/pct-diagnostics-rollup.json
```

Observed summary:

```json
{
  "severity": "unknown",
  "reports": 1,
  "findings": 3,
  "checkIds": [
    "pct.registry.snapshot",
    "pct.natsControl.info",
    "pct.projection.scheduler.pressure"
  ]
}
```

### Secret leak scan

```bash
python - <<'PY'
import json,re
raw=open('/tmp/pct-diagnostics-rollup.json').read()
patterns=['token','seed','jwt','Bearer','password','secret','creds','authorization']
print({pat: bool(re.search(pat, raw, re.I)) for pat in patterns})
PY
```

Result:

```text
all patterns false
```

### Boundary scan

```bash
rg -n "@tmnl/(pct|lnk)|packages/(pct|lnk)|from ['\"].*(pct|lnk)|import\(['\"].*(pct|lnk)" \
  packages/msh/src packages/msh/test || true
```

Result:

```text
(no matches)
```

### Feature gate validation

The Tasker command resolver failed prematurely after emitting Vitest start banners
for the MSH/LNK gates, so the same commands were rerun manually and the gates
were resolved with explicit evidence.

```bash
cd packages/msh
bunx vitest run
bunx tsc --noEmit --pretty false
```

Result:

```text
12 files passed, 5 skipped; 109 tests passed, 13 skipped.
Typecheck passed.
```

```bash
cd packages/lnk
bunx vitest run test/services/wire/NatsBridgeWire.test.ts test/services/wire/nats-bridge/*.test.ts --fileParallelism=false
bunx tsc --noEmit --pretty false
```

Result:

```text
9 files passed, 1 skipped; 49 tests passed, 2 skipped.
Typecheck passed.
```

```bash
cd packages/pct
bunx vitest run test/config.test.ts test/projection-scheduler.test.ts test/projection-worker-contracts.test.ts test/projection-worker-nats-host.test.ts --fileParallelism=false
bunx tsc --noEmit --pretty false
```

Result:

```text
4 files passed; 38 tests passed.
Typecheck passed.
```

## 7. Operational evidence

Artifacts:

- [diagnostics-audit.md](./diagnostics-audit.md)
- [validation-ledger.md](./validation-ledger.md)
- [diagnostics-check-taxonomy.md](../../../msh/docs/diagnostics-check-taxonomy.md)
- [observability-diagnostics-feature-plan.md](../../../msh/docs/observability-diagnostics-feature-plan.md)
- `/tmp/pct-diagnostics-rollup.json` — ephemeral local smoke sample, not a source artifact.

## 8. Failure modes and recovery

| Failure mode | Detection | Recovery / rollback |
| --- | --- | --- |
| Diagnostic report leaks secret-shaped value | Redaction tests or leak scan fail | Fix `redaction.ts`, add sentinel regression, do not publish report artifacts. |
| MSH diagnostics imports PCT/LNK semantics | Boundary scan finds source/test import | Move semantics to PCT/LNK, keep MSH generic. |
| Permission failure appears as generic critical failure | Diagnostic finding safeCause/remediation too coarse | Follow `#F1160/#4214` permission-aware diagnostics lane. |
| NATS reconnect/disconnect invisible | No status event in report | Follow `#F1161/#4218` connection status telemetry lane. |
| Rollup command fails in default dev shell | `bun run diagnostics:rollup` fails | Validate Registry memory layer composition and script args. |

## 9. Known gaps and follow-ups

| Gap | Risk | Follow-up |
| --- | --- | --- |
| Fine-grained permission-denied classification | ACL failures may be actionable only by safe cause/remediation text. | `#F1160/#4214` |
| NATS status telemetry missing from diagnostics | Reconnect/disconnect evidence unavailable for chaos/soak. | `#F1161/#4218` |
| Default rollup is PCT-only | Operators may expect live cross-layer checks by default. | Add runbook/report-file workflow in docs or future CLI. |
| Automated docs closeout gate missing | Manual checklist can drift. | `#F1167/#4249` |

## 10. Workspace hygiene proof

No files are staged by this closeout at the time of writing.

Required pre-commit checks:

```bash
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

Root/shared files included?

- `package.json`: no
- `bun.lock`: no
- `.gitmodules`: no

## 11. Final operator notes

The diagnostics surface is now good enough to be the first evidence spine for the
hardening portfolio. Use it before starting soak, ACL live denial, or chaos runs.
Do not expand it into a repair tool without a new feature plan. A diagnostic that
fixes things is not a diagnostic; it is a tiny unattended operator with a wrench.
We have enough trouble already.
