# RFC: PCT/LNK/MSH Hardening Closeout and Documentation System

Date: 2026-05-25
Status: feature plan
Parent: `#F1129 Feature-plan closeout and documentation system after recon`
Research task: `#4105`
Design task: `#4106`

## Intent

Define the documentation and closeout system for the PCT/LNK/MSH hardening
portfolio after the recon/planning lanes. The portfolio now has enough moving
parts that “there is probably an RFC somewhere” is not a retrieval strategy;
it is a trapdoor with Markdown wallpaper.

This RFC specifies where knowledge lives, which artifacts close a lane, and how
future implementation features prove they stayed inside the PCT/LNK/MSH
boundaries.

## Current documentation surfaces

### Cross-stack / PCT-owned surfaces

Current PCT top-level docs:

- `packages/pct/NATS-INTEGRATION-CLOSEOUT.md`
  - Existing layered closeout for MSH/LNK/PCT NATS integration.
  - Strong precedent for commit map, boundary review, validation commands, and
    explicit non-goals.
- `packages/pct/PCT-LNK-MSH-HARDENING-RECON.md`
  - Research baseline for hardening portfolio.
  - Inventories MSH/LNK/PCT tests, harnesses, gaps, docs, and sequencing.
- `packages/pct/RFC-SYSTEM-CAPABILITY-AUDIT.md`
  - Capability audit and anti-bloat rubric.
  - Defines package ownership thesis: PCT contracts/control, LNK durable streams,
    MSH substrate, STX local state, SQL read models/analytics.
- `packages/pct/RFC-NATS-CONTROL-PLANE.md`
  - PCT NATS schema resolver/control-plane plan and proof posture.
- `packages/pct/RFC-FRAME-PROJECTIONS.md`
  - Frame projection concepts and source-frame/read-model boundaries.
- `packages/pct/RFC-PROJECTION-SCHEDULER-SEDA.md`
  - Scheduler SEDA stage-boundary design and diagnostic look-surface decision.
- `packages/pct/RFC-PROJECTION-RUNTIME-HARDENING.md`
  - ProjectionWorker durable runtime hardening plan and evidence.
- `packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md`
  - Soak harness research/design and follow-on `#F1159`.
- `packages/pct/RFC-PERMISSION-ACL-MATRIX.md`
  - Permission/ACL matrix research/design and follow-on `#F1160`.
- `packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md`
  - Chaos/failure research/design and follow-on `#F1161`.
- `packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md`
  - Workspace/root lockfile hygiene research/design and follow-on `#F1166`.

### MSH surfaces

Current MSH docs relevant to portfolio:

- `packages/msh/README.md`
- `packages/msh/docs/system-atlas.md`
- `packages/msh/docs/pct-lnk-composition-rfc.md`
- `packages/msh/docs/critical-scrutiny-2026-05-18.md`
- `packages/msh/docs/consumer-migration-inventory.md`
- `packages/msh/docs/observability-diagnostics-feature-plan.md`
- `packages/msh/docs/diagnostics-check-taxonomy.md`

Important observation: the observability/diagnostics plan is cross-stack in
content but currently lives under MSH docs. That is acceptable as historical
origin, but the portfolio closeout should index it from PCT and avoid burying
cross-stack governance in the substrate package. MSH remains substrate-only; its
docs can host substrate diagnostics, not PCT policy.

### LNK surfaces

Current LNK docs relevant to portfolio:

- `packages/lnk/README.md`
- `packages/lnk/ARCHITECTURE.md`
- `packages/lnk/CONFORMANCE.md`
- `packages/lnk/NATS-BRIDGE.md`
- `packages/lnk/PCT.md`

LNK docs are strong on protocol/bridge semantics. They need operational pages
for soak/chaos/ACL outcomes only after those lanes land; do not prefill LNK docs
with unimplemented promises.

## Documentation ownership decision

### Cross-stack portfolio docs

PCT owns the hardening portfolio index because PCT owns contracts, registry,
control-plane semantics, feature planning, and cross-layer governance.

Recommended target:

```text
packages/pct/docs/hardening/
  README.md                         # portfolio index and current status
  execution-order.md                # sequencing matrix from #F1130
  validation-ledger.md              # latest commands/evidence by lane
  closeout-template.md              # required closeout sections
  boundary-contracts.md             # MSH/LNK/PCT/STX ownership matrix
  staging-hygiene.md                # exact pathspec and lockfile policy
  runbooks/
    diagnostics.md
    soak.md
    acl.md
    chaos.md
    projection-runtime.md
```

Alternative if adding a docs tree is too much for the first pass: create a
single top-level `packages/pct/PCT-LNK-MSH-HARDENING-PORTFOLIO.md` index and
migrate to `docs/hardening/` later. The index must still be explicit about which
files are historical RFCs versus operational runbooks.

### Layer-local docs

- MSH docs own substrate diagnostics, auth substrate, JetStream/KV/micro host,
  subject rules, and redaction details.
- LNK docs own durable stream conformance, bridge semantics, producer fencing,
  CAS append, close/retention behavior, and read/offset semantics.
- PCT docs own schema resolver/control-plane, registry/federation,
  ProjectionWorker contracts, frame projections, and portfolio sequencing.

### Generated artifacts

- Soak/chaos run output goes under `packages/pct/.soak-runs/<run-id>/` or a
  future `.hardening-runs/<run-id>/` directory and should be ignored unless a
  summarized artifact is intentionally committed.
- Visual explainers under `/home/getbygenius/.agent/diagrams` are not source;
  if needed, copy a selected artifact into a declared docs path.
- Tasker artifact records remain Tasker SQL truth, not Markdown truth.

## Closeout artifact contract

Every hardening implementation lane should close with a Markdown closeout that
contains:

1. **Verdict**
   - `closed`, `partial`, or `deferred`, with one paragraph explaining why.
2. **Boundary review**
   - Explicit MSH/LNK/PCT/STX ownership check.
   - Evidence that MSH did not import PCT/LNK semantics.
   - Evidence that LNK did not absorb PCT registry policy.
3. **Implementation map**
   - Files changed grouped by layer.
   - Public API changes and compatibility/deprecation notes.
4. **Validation commands**
   - Exact `bunx vitest` / `bunx tsc` commands.
   - Live opt-in variables when applicable.
   - Which tests are mock-only vs live.
5. **Operational evidence**
   - Diagnostics output, soak summary, chaos report, ACL denial proof, or
     projection ledger proof depending on lane.
6. **Known gaps and follow-ups**
   - Named, not hand-waved.
   - Include task/feature IDs when created.
7. **Workspace hygiene proof**
   - `git diff --cached --name-status` at commit time or equivalent staged-file
     list.
   - Explicit statement if root `package.json`, `bun.lock`, or `.gitmodules` are
     included; otherwise assert they are excluded.
8. **Rollback/downgrade path**
   - How to disable the feature or fall back if it is operationally risky.

## Lane-specific closeout requirements

### Observability / diagnostics (`#F1138`)

Required closeout additions:

- Diagnostics taxonomy version and check IDs.
- Redaction snapshot evidence.
- Permission-aware failure examples.
- Which checks are safe in CI vs live/operator-only.
- Whether generic diagnostic schemas live in MSH and how PCT/LNK consume them.

### Long-running soak (`#F1159`)

Required closeout additions:

- Soak run artifact schema and sample summary.
- Tier 0/Tier 1/Tier 2 support matrix.
- Deterministic workload description.
- Integrity verifier output.
- Resource/fiber/memory leak assertion method.
- Live/Kubernetes opt-in policy.

### Permission and ACL hardening (`#F1160`)

Required closeout additions:

- Persona/operation/subject permission matrix.
- Rendered NATS config examples.
- Negative permission test matrix.
- HTTP auth policy and EventLogRemote peer policy summary.
- Private inbox prefix decision.

### Hostile network and failure chaos (`#F1161`)

Required closeout additions:

- Fault vocabulary/schema version.
- Deterministic mock fault coverage.
- Local live NATS bounce evidence.
- Expected typed error mapping.
- Recovery proof and non-recovery cases.
- Kubernetes chaos limitations if any.

### Projection runtime hardening (`#F1137` / follow-ons)

Required closeout additions:

- Durable runtime lane state model.
- Lease/fence/checkpoint/outbox invariants.
- Timescale/LNK boundary proof.
- Explicit stale-lease/heartbeat status: implemented or not claimed.
- Projection DDL/migration preview evidence.

### Workspace hygiene (`#F1166`)

Required closeout additions:

- Dirty-baseline report output.
- Ignore-policy changes and exceptions.
- Root lockfile ownership checklist.
- Closeout gate output proving forbidden staged files are absent.

## Portfolio index shape

The portfolio index should expose a quick operator map:

| Lane | Planning artifact | Implementation feature | Closeout | Operational command |
| --- | --- | --- | --- | --- |
| Recon | `PCT-LNK-MSH-HARDENING-RECON.md` | n/a | n/a | n/a |
| Diagnostics | `packages/msh/docs/observability-diagnostics-feature-plan.md` | `#F1138` | TBD | `pct/msh diagnostics` TBD |
| Soak | `RFC-LONG-RUNNING-MULTI-NODE-SOAK.md` | `#F1159` | TBD | `bun run soak:*` TBD |
| ACL | `RFC-PERMISSION-ACL-MATRIX.md` | `#F1160` | TBD | ACL renderer TBD |
| Chaos | `RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md` | `#F1161` | TBD | chaos runner TBD |
| Projection runtime | `RFC-PROJECTION-RUNTIME-HARDENING.md` | `#F1137` + follow-ups | TBD | projection runner TBD |
| Workspace hygiene | `RFC-WORKSPACE-LOCKFILE-HYGIENE.md` | `#F1166` | TBD | staged-file gate TBD |
| Sequencing | `execution-order.md` / `#F1130` | n/a | portfolio handoff | n/a |

## Documentation anti-patterns

- Do not put PCT semantic policy into MSH docs because “the file already exists.”
  That is how substrate packages become policy junk drawers.
- Do not let tests be the only documentation for live opt-in behavior.
- Do not publish operator commands without stating destructive scope.
- Do not mix planning RFCs and implementation closeouts in one undifferentiated
  top-level pile forever.
- Do not claim Kubernetes chaos support just because a pod delete hook exists.
- Do not stage root lockfile or package deletion cleanup with docs closeout.

## Proposed follow-on implementation feature

Create under `#F1121`:

- Feature: `PCT/LNK/MSH Hardening Documentation and Closeout System`
  - A: Create hardening docs index / portfolio map.
  - B: Add closeout template and lane-specific checklists.
  - C: Add validation ledger format and initial entries from current closeouts.
  - D: Add boundary contract matrix and anti-bloat rubric links.
  - E: Add staging hygiene/runbook linkback to workspace hygiene RFC.
  - F: Add docs closeout gate that checks required sections for each lane.

## Recommendation

Build the documentation system before executing the new soak/ACL/chaos lanes,
but after `#F1130` writes the execution order. The first implementation can be a
single portfolio index plus closeout template; the fancy docs tree can wait until
the second closeout proves the structure is useful.

The point is not more Markdown. The point is retrieval, evidence, and not making
future-you spelunk twelve RFCs while a NATS cluster is on fire.
