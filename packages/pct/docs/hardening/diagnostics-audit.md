# Diagnostics Output Audit and Reimplementation Checkpoint

Date: 2026-05-26
Status: audit complete
Feature: `#F1145 Audit, reimplementation checkpoint, and diagnostics closeout docs`
Task: `#4155 Audit diagnostics output and decide reimplementation needs`
Agent: BrightHawk

## Verdict

No diagnostics source reimplementation is required before diagnostics closeout.
The current slice is safe enough to close with documented gaps: stable check IDs,
Schema-backed reports, safe redaction helpers, non-destructive checks, and clean
MSH/LNK/PCT boundaries all pass the audit.

The remaining gaps are follow-on hardening, not blockers for this slice:
permission-denied classification needs richer ACL fixtures, live report examples
need final closeout capture, and NATS connection status telemetry belongs to the
hostile-network/chaos lane.

## Audit scope

Reviewed:

- `packages/msh/src/diagnostics/schemas.ts`
- `packages/msh/src/diagnostics/redaction.ts`
- `packages/msh/src/diagnostics/MshDiagnostics.ts`
- `packages/lnk/src/services/wire/nats-bridge/MshBridgeDiagnostics.ts`
- `packages/pct/src/diagnostics/PctDiagnostics.ts`
- `packages/pct/src/diagnostics/Rollup.ts`
- `packages/pct/scripts/diagnostics-rollup.ts`
- diagnostics tests in MSH/LNK/PCT

Audit questions from task `#4155`:

- raw stack/secret leakage?
- unstable IDs/check names?
- permission ambiguity?
- boundary violations?
- destructive checks?
- reimplementation needed before closeout?

## Boundary review

| Boundary | Verdict | Evidence |
| --- | --- | --- |
| MSH remains substrate-only | pass | `packages/msh/src/diagnostics/*` imports only MSH auth/NATS substrate and generic diagnostics modules. MSH import scan found no PCT/LNK source/test imports. |
| LNK owns durable stream bridge semantics | pass | `MshBridgeDiagnostics` reports bridge metadata bucket and bridge data stream availability using LNK bridge config, while depending on MSH generic substrate APIs. |
| PCT owns semantic/control-plane diagnostics | pass | `PctDiagnostics` checks registry, SchemaResolver abstraction, PCT NATS control plane, and ProjectionScheduler pressure. It does not reimplement MSH substrate checks. |
| STX not used as server authority | pass | No STX usage in diagnostics surface. |
| SQL/Timescale not hidden semantic assembler | pass | No SQL/Timescale diagnostics in this slice. |

Boundary command:

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
rg -n "@tmnl/(pct|lnk)|packages/(pct|lnk)|from ['\"].*(pct|lnk)|import\(['\"].*(pct|lnk)" \
  packages/msh/src packages/msh/test || true
```

Observed result:

```text
(no matches)
```

## Output safety audit

### Schema stability

The shared diagnostics vocabulary is Schema-backed in
`packages/msh/src/diagnostics/schemas.ts`:

- `DiagnosticSeverity`: `ok | warn | critical | unknown`
- `DiagnosticCheckStatus`: `passed | failed | skipped | degraded | unknown`
- `DiagnosticFinding`
- `DiagnosticCheck`
- `DiagnosticReport`
- `maxSeverity`

The `layer` field is intentionally `string`, not a closed enum, so MSH exports a
generic vocabulary without encoding PCT/LNK policy. That matches the taxonomy
decision in `packages/msh/docs/diagnostics-check-taxonomy.md`.

### Stable check IDs

Current stable IDs:

| Layer | Check IDs |
| --- | --- |
| MSH | `msh.core.flush`, `msh.jsm.access`, `msh.stream.info`, `msh.kv.bucket`, `msh.auth.metadata` |
| LNK | `lnk.mshBridge.metadata.bucket`, `lnk.mshBridge.stream.info` |
| PCT | `pct.registry.snapshot`, `pct.schemaResolver.fetch`, `pct.natsControl.info`, `pct.projection.scheduler.pressure` |

Finding codes follow `<check-id>.<condition>` in the reviewed paths.

### Redaction

`packages/msh/src/diagnostics/redaction.ts` redacts:

- JWT-shaped strings;
- NKey seed-shaped strings;
- `Bearer <token>` values;
- `token|jwt|seed|secret|password|authorization|creds` assignment forms;
- object values under sensitive keys;
- cyclic objects safely.

Test coverage:

- `packages/msh/test/diagnostics.test.ts` proves token/JWT/seed/credential-shaped
  values are redacted and reports do not contain token/seed/JWT/Bearer secret
  sentinels.

Rollup sample leak scan over `/tmp/pct-diagnostics-rollup.json` found no matches
for:

```text
token, seed, jwt, Bearer, password, secret, creds, authorization
```

### Raw stack leakage

Failures route through `redactCause(Cause.pretty(cause))`. This may include safe
stack/cause summaries, but sensitive substrings are redacted. The current mock
and rollup evidence did not expose raw secrets.

Potential follow-up: future closeout can add a golden snapshot with a deliberately
secret-bearing Cause through MSH, LNK, and PCT reports. Not a blocker because MSH
redaction has direct tests now.

## Destructive-check audit

| Check | Operation | Destructive? | Notes |
| --- | --- | --- | --- |
| `msh.core.flush` | `connection.nc.flush()` | no | Flush only. |
| `msh.jsm.access` | lazy `connection.getJsm()` | no | Capability/access check. |
| `msh.stream.info` | stream info read | no | Reports configured stream name. |
| `msh.kv.bucket` | `kv.keys(bucketName)` | no write | Reads key list internally, outputs count only. |
| `msh.auth.metadata` | auth metadata effect | no | Redacted metadata summary. |
| `lnk.mshBridge.metadata.bucket` | `kv.keys(metadataBucket)` | no write | Outputs bucket and key count only. |
| `lnk.mshBridge.stream.info` | stream info read | no | Reports bridge stream presence/missing. |
| `pct.registry.snapshot` | registry snapshot read | no | Reports counts/revision. |
| `pct.schemaResolver.fetch` | schema fetch | no write | Optional check, not in default report. |
| `pct.natsControl.info` | control-plane info/stats | no write | Requires service in scope. |
| `pct.projection.scheduler.pressure` | pressure/snapshot reads | no | Reports pressure state. |
| `diagnostics-rollup --report` | file decode + rollup | no | Reads JSON reports only. |

No destructive checks were found.

## Permission ambiguity audit

Current state:

- MSH failed checks include remediation text for likely permission/config causes.
- MSH `msh.stream.info` distinguishes missing stream (`degraded/warn`) from
  operational failure (`failed/critical`).
- PCT schema resolver distinguishes semantic not-found from operational failure.
- PCT optional services return `skipped/unknown` when not in scope.
- LNK bridge stream missing is `degraded/warn` rather than hard failed.

Gap:

- MSH does not yet parse every NATS failure into precise permission vs unavailable
  vs timeout classes.

Decision:

- This is not a reimplementation blocker for diagnostics closeout. It is already
  scoped into `#F1160` permission-aware diagnostics and `#F1161` chaos/status
  telemetry. The current slice is honest: it reports safe failed/degraded/skipped
  states without pretending to know more than it does.

## Validation commands run

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg

cd packages/msh && bunx vitest run test/diagnostics.test.ts --reporter verbose
cd packages/lnk && bunx vitest run test/services/wire/nats-bridge/MshBridgeDiagnostics.test.ts --reporter verbose
cd packages/pct && bunx vitest run test/pct-diagnostics.test.ts test/diagnostics-rollup.test.ts --reporter verbose
cd packages/pct && bun run diagnostics:rollup --compact >/tmp/pct-diagnostics-rollup.json
```

Observed result:

```text
MSH diagnostics: 1 file, 5 tests passed.
LNK MSH bridge diagnostics: 1 file, 2 tests passed.
PCT diagnostics + rollup: 2 files, 5 tests passed.
PCT diagnostics rollup sample: severity=unknown, reports=1, findings=3, checkIds=[pct.registry.snapshot, pct.natsControl.info, pct.projection.scheduler.pressure].
```

Rollup sample summary:

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

## Reimplementation decision

No reimplementation required before closeout.

Closeout should proceed with these documented caveats:

1. Default `diagnostics:rollup` is intentionally PCT-only unless `--report` files
   are supplied.
2. MSH/LNK live diagnostics remain opt-in.
3. Permission classification is coarse until ACL profile tests land.
4. Connection status telemetry is a chaos/hostile-network follow-up, not part of
   this diagnostics first slice.
5. Report IDs and timestamps use `Date.now()` and are operational IDs, not stable
   golden IDs; check IDs are the stable contract.

## Follow-ups

| Gap | Follow-up |
| --- | --- |
| Permission-specific NATS error classification | `#F1160` / `#4214` Permission-aware diagnostics and doctor probes |
| NATS disconnect/reconnect status telemetry | `#F1161` / `#4218` MSH connection status telemetry |
| Cross-layer rollup over live MSH/LNK reports | `#F1138` closeout or later docs/runbook entry once live reports are captured |
| Automated docs/closeout gate | `#F1167` / `#4249` |

## Final operator note

The diagnostics spine has enough structure to support closeout: stable vocabulary,
safe redaction, non-destructive checks, and layer boundaries are intact. Do not
inflate this into a universal health oracle yet. That way lies the dashboard
that knows everything except why production is down.
