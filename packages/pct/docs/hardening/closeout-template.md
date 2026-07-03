# PCT/LNK/MSH Hardening Closeout Template

Status: template  
Owner: `#F1167 PCT/LNK/MSH Hardening Documentation and Closeout System`  
Applies to: diagnostics, soak, ACL, chaos, projection runtime, workspace hygiene, and future PCT/LNK/MSH hardening lanes

## How to use this template

Copy the template section into a lane-specific closeout document and fill every
required field before marking an implementation feature closed.

Suggested filename pattern:

```text
packages/pct/docs/hardening/closeouts/<lane-slug>-closeout.md
```

Do not close a lane with “tests pass” as the whole story. A hardening lane closes
when it proves its boundary, evidence, rollback, and remaining risk. Very boring.
Very survivable.

After filling the closeout, add a corresponding evidence entry to
[validation-ledger.md](./validation-ledger.md), review the boundary rules in
[boundary-contracts.md](./boundary-contracts.md), and run the staging hygiene
checks from [staging-hygiene.md](./staging-hygiene.md).

## Required closeout template

```markdown
# <Lane Name> Closeout

Date: <YYYY-MM-DD>
Status: <closed | partial | deferred>
Feature: <#F...>
Owner: <agent/person>
Primary artifacts:
- <paths>

## 1. Verdict

<One paragraph explaining whether the lane is closed, partial, or deferred.>

## 2. Scope and non-goals

### In scope

- <implemented scope>

### Explicit non-goals

- <what this lane deliberately did not claim>

## 3. Boundary review

Reference: [boundary-contracts.md](./boundary-contracts.md)

| Boundary | Verdict | Evidence |
| --- | --- | --- |
| MSH remains substrate-only | <pass/fail/n/a> | <paths/commands> |
| LNK owns durable stream semantics | <pass/fail/n/a> | <paths/commands> |
| PCT owns contracts/control-plane policy | <pass/fail/n/a> | <paths/commands> |
| STX is not used as server stream authority | <pass/fail/n/a> | <paths/commands> |
| Root/shared files are excluded or explicitly owned | <pass/fail> | <staged-file list> |

Required notes:

- If MSH imports PCT/LNK code, explain why this is not boundary drift or mark the
  closeout failed.
- If LNK starts validating PCT registry semantics, explain why this is not policy
  leakage or mark the closeout failed.
- If root `package.json`, `bun.lock`, or `.gitmodules` are included, name the
  owner and rationale.

## 4. Implementation map

| Layer | Files changed | Purpose |
| --- | --- | --- |
| MSH | <paths> | <purpose> |
| LNK | <paths> | <purpose> |
| PCT | <paths> | <purpose> |
| Docs/Ops | <paths> | <purpose> |

## 5. Public API and compatibility notes

- New APIs:
  - <name/path>
- Changed APIs:
  - <name/path>
- Deprecated aliases / compatibility shims:
  - <name/path and sunset plan>
- No public API changes:
  - <state if true>

## 6. Validation commands

### Static/type validation

```bash
<command>
```

Result:

```text
<summary>
```

### Unit/integration validation

```bash
<command>
```

Result:

```text
<summary>
```

### Live/opt-in validation

```bash
<env vars> <command>
```

Result:

```text
<summary or skipped reason>
```

## 7. Operational evidence

Attach the lane-specific evidence:

- diagnostics report / redaction snapshot;
- soak summary / integrity verifier result;
- ACL rendered profile / denied-operation proof;
- chaos report / recovery evidence;
- projection ledger / checkpoint/outbox proof;
- workspace staged-file gate output.

Paths:

- <artifact paths>

## 8. Failure modes and recovery

| Failure mode | Detection | Recovery / rollback |
| --- | --- | --- |
| <failure> | <diagnostic/test/operator signal> | <disable/retry/rollback path> |

## 9. Known gaps and follow-ups

| Gap | Risk | Follow-up task/feature |
| --- | --- | --- |
| <gap> | <risk> | <#... or create one> |

## 10. Workspace hygiene proof

Reference: [staging-hygiene.md](./staging-hygiene.md)

Commands run before staging/closeout:

```bash
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

Optional lane-scoped inspection:

```bash
git status --short -- <exact lane-owned paths>
```

Exact staging command used, if any:

```bash
git add <exact path 1> <exact path 2>
```

Staged files:

```text
<exact staged files or "not staged yet">
```

Root/shared files included?

- `package.json`: <yes/no; owner/rationale if yes>
- `bun.lock`: <yes/no; owner/rationale if yes>
- `.gitmodules`: <yes/no; owner/rationale if yes>

Planning/source mixing decision:

- <planning docs only | implementation only | mixed with explicit rationale>

## 11. Final operator notes

<What should the next agent/operator know before building on this lane?>
```

## Universal closeout checklist

Use this checklist for every lane.

### Evidence

- [ ] Closeout verdict is explicit: `closed`, `partial`, or `deferred`.
- [ ] Scope and non-goals are stated.
- [ ] Implementation map groups changes by MSH/LNK/PCT/docs/ops.
- [ ] Static/type validation command is recorded with result.
- [ ] Unit/integration validation command is recorded with result.
- [ ] Live validation is recorded or explicitly skipped with reason.
- [ ] Operational evidence path(s) are listed.
- [ ] Matching entry is added to [validation-ledger.md](./validation-ledger.md).
- [ ] Known gaps have follow-up task/feature IDs or are explicitly accepted.

### Boundary hygiene

- [ ] Boundary rules were checked against [boundary-contracts.md](./boundary-contracts.md).
- [ ] MSH does not import PCT/LNK domain code.
- [ ] LNK does not absorb PCT registry/federation policy.
- [ ] PCT does not own raw NATS substrate lifecycle beyond composing MSH layers.
- [ ] STX is not used as server stream authority.
- [ ] SQL/Timescale use is framed as facts/ledgers/read models/analytics, not hidden semantics.

### Commit hygiene

- [ ] [staging-hygiene.md](./staging-hygiene.md) was followed.
- [ ] `git diff --cached --name-status` was reviewed.
- [ ] No broad staging was used.
- [ ] Exact pathspec staging command is recorded when files are staged.
- [ ] Root `package.json`, `bun.lock`, and `.gitmodules` are excluded unless explicitly owned.
- [ ] Planning docs and implementation source/test changes are not mixed accidentally.
- [ ] Generated runtime state is excluded.

## Lane-specific checklists

### Diagnostics / doctor lane (`#F1138`)

Required artifacts:

- diagnostics feature plan / taxonomy references;
- diagnostics report sample;
- redaction snapshot or sentinel proof;
- check ID list and status/severity vocabulary;
- mock/live boundary list.

Checklist:

- [ ] Generic diagnostic schemas are Schema-backed.
- [ ] Diagnostic output contains no raw tokens, seeds, JWTs, creds, or arbitrary auth payloads.
- [ ] Check IDs follow `<layer>.<component>.<check>` or documented equivalent.
- [ ] Rollup severity semantics are documented.
- [ ] Permission failures are distinguishable from unavailable/not-found where possible.
- [ ] MSH diagnostics remain substrate-only.
- [ ] PCT diagnostics consume/report higher-layer semantics without probing raw NATS policy directly unless explicitly justified.
- [ ] CLI/script command is documented and bounded.

Validation examples:

```bash
cd packages/pct
bun run diagnostics:rollup

cd packages/msh
bunx vitest run test/diagnostics*.test.ts --reporter verbose
```

### Long-running soak lane (`#F1159`)

Required artifacts:

- soak run schema version;
- JSONL event sample;
- summary artifact sample;
- workload definition;
- integrity verifier output;
- tier support matrix.

Checklist:

- [ ] Soak artifacts are Schema-backed.
- [ ] Run output path is under `packages/pct/.soak-runs/<run-id>/` or documented equivalent.
- [ ] Workload is deterministic enough for integrity verification.
- [ ] Tier 0 local process run is bounded and CI-safe if included in CI.
- [ ] Tier 1 external/local NATS run is opt-in and bounded.
- [ ] Tier 2 Kubernetes support is clearly marked opt-in.
- [ ] Integrity verifier detects loss, duplication, ordering/offset drift, and schema mismatch.
- [ ] Resource/fiber/memory leak checks are described or explicitly deferred.

Validation examples:

```bash
cd packages/pct
bun run soak:smoke

cd packages/pct
LNK_LIVE_NATS=1 bun run soak:nats
```

### Permission / ACL lane (`#F1160`)

Required artifacts:

- persona-to-operation permission matrix;
- rendered NATS config/profile examples;
- negative permission test matrix;
- private inbox prefix decision;
- HTTP auth policy summary;
- EventLogRemote peer policy summary.

Checklist:

- [ ] MSH auth config is threaded through PCT/LNK runtime construction where required.
- [ ] Private inbox support is implemented or explicitly deferred with risk.
- [ ] NATS permission profiles are rendered from Schema-backed contracts.
- [ ] Negative permission tests prove denied `$JS.API`, stream, KV, micro, and inbox operations where applicable.
- [ ] HTTP publish/admin routes have explicit auth policy.
- [ ] EventLogRemote distinguishes peer identity/trust failures from transport failures.
- [ ] Diagnostics explain permission-denied symptoms without leaking secrets.

Validation examples:

```bash
cd packages/msh
MSH_LIVE_NATS=1 bunx vitest run test/live-*-auth.test.ts --reporter verbose

cd packages/pct
bunx vitest run test/*acl*.test.ts test/*auth*.test.ts --reporter verbose
```

### Hostile network / failure chaos lane (`#F1161`)

Required artifacts:

- fault vocabulary/schema version;
- deterministic mock fault coverage report;
- local live NATS bounce/restart evidence;
- typed error mapping;
- recovery and non-recovery cases;
- Kubernetes limitations/opt-in policy.

Checklist:

- [ ] Mock fault DSL covers core request, JetStream publish, KV get/update, consumer fetch/next, delayed ack, duplicate ack, closed iterator, and timeout cases or documents gaps.
- [ ] MSH records redacted connection status events: disconnect, reconnect, update, lame duck, error, stale/reconnecting where available.
- [ ] LNK crash-window tests cover post-publish/pre-metadata commit behavior.
- [ ] PCT federation/EventLogRemote restart drill proves convergence or records a bounded gap.
- [ ] Projection worker failure drills prove failed snapshots, checkpoint monotonicity, lease conflicts, and lost-lease behavior.
- [ ] Outbox chaos proves fail-N-then-succeed, poison, and duplicate-safe replay behavior.
- [ ] Kubernetes hooks are bounded and do not claim network partition support unless a controller exists.

Validation examples:

```bash
cd packages/msh
bunx vitest run test/*fault*.test.ts test/*diagnostics*.test.ts --reporter verbose

cd packages/lnk
bunx vitest run test/services/wire/nats-bridge/*chaos*.test.ts --reporter verbose
```

### Projection runtime lane (`#F1137` and follow-ups)

Required artifacts:

- runtime state model;
- lease/fence/checkpoint/outbox invariant table;
- migration/DDL preview evidence;
- LNK adapter boundary proof;
- stale-lease/heartbeat status.

Checklist:

- [ ] Durable runtime records lease, checkpoint, outbox, and worker state transitions explicitly.
- [ ] Local admission controls are not claimed as durable authority.
- [ ] Durable lease/fence authority is separated from local scheduler pressure control.
- [ ] Checkpoints never move backward.
- [ ] Outbox records carry idempotency key, producer id, epoch, and sequence.
- [ ] LNK owns duplicate suppression and durable stream semantics.
- [ ] Stale lease takeover is either implemented/tested or explicitly not claimed.
- [ ] Timescale migrations are previewable and included in projection plan statements.

Validation examples:

```bash
cd packages/pct
bunx vitest run \
  test/projection-outbox-publisher.test.ts \
  test/projection-lnk-adapters.test.ts \
  test/projection-durable-runtime-memory.test.ts \
  test/projection-durable-runtime-contracts.test.ts \
  test/projection-runtime.test.ts \
  test/projection-assembly.test.ts \
  test/projection-cagg.test.ts \
  test/projection-migrations.test.ts \
  test/projection-scheduler.test.ts \
  test/projection-worker-nats-host.test.ts \
  test/projection-worker-contracts.test.ts \
  test/projection-registry.test.ts \
  test/frame-projections.test.ts \
  --reporter verbose

bunx tsc --noEmit --pretty false
```

### Workspace hygiene lane (`#F1166`)

Required artifacts:

- dirty-baseline report;
- lane-scoped staging checklist or [staging-hygiene.md](./staging-hygiene.md) reference;
- ignore policy or local-ignore guidance;
- root dependency ownership checklist;
- staged-file gate output.

Checklist:

- [ ] Dirty classifier groups paths by package/status/risk.
- [ ] Planning artifacts can be staged with exact pathspecs.
- [ ] Root `package.json`, `bun.lock`, and `.gitmodules` are forbidden unless explicitly owned.
- [ ] Runtime state (`.pi` cache/feed/db-shm/db-wal, soak runs, autoresearch output) is ignored or documented.
- [ ] Package deletions are isolated to dedicated lanes.
- [ ] Submodule drift is quarantined.
- [ ] Planning docs and implementation source/test changes are not bundled accidentally.

Validation examples:

```bash
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

### Documentation / closeout lane (`#F1167`)

Required artifacts:

- portfolio index;
- closeout template;
- validation ledger format;
- boundary contract matrix;
- [staging hygiene runbook](./staging-hygiene.md) and linkbacks;
- [docs closeout gate/checklist](./docs-closeout-gate.md);
- `bun run hardening:docs:check` script.

Checklist:

- [ ] Every hardening lane appears in the portfolio index.
- [ ] Every hardening lane has a planning artifact link.
- [ ] Every implementation feature has a feature ID and status.
- [ ] Every lane has a closeout expectation.
- [ ] Relative links in docs are validated.
- [ ] Template includes boundary review, validation commands, operational evidence, known gaps, workspace hygiene proof, and rollback path.
- [ ] Portfolio index and template link [staging-hygiene.md](./staging-hygiene.md).
- [ ] Portfolio index links [docs-closeout-gate.md](./docs-closeout-gate.md).
- [ ] `bun run hardening:docs:check` passes.
- [ ] Docs do not move PCT policy into MSH substrate docs.

Validation examples:

```bash
cd packages/pct
bun run hardening:docs:check
```

## Minimal manual closeout gate

After the automated docs gate passes, use this manual gate:

1. Open the lane closeout.
2. Verify all template sections 1–11 exist.
3. Run the validation commands recorded in the closeout or verify the recorded
   output from the responsible agent.
4. Run staged-file hygiene commands.
5. Confirm every known gap has a follow-up ID.
6. Only then mark the implementation feature closed.

Yes, it is a checklist. That is the point. The machine cannot save us from an
operator who “just remembers” where the evidence is. We do not employ that
operator here.
