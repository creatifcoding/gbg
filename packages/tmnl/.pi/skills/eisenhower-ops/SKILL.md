---
name: eisenhower-ops
description: Decision OS operator playbook. Use Eisenhower strict lifecycle plus tool-routing decision trees across coding, planning, research, and validation.
---

# Eisenhower Ops

Use this skill when you need **high-accountability decisions** and a repeatable way to route across the full tool surface (code, tasks, subagents, research, and runtime verification).

## When to Use

- “Should we do A or B?” with architectural, reliability, or policy impact
- Disputed implementation claims (performance, correctness, scalability)
- Multi-phase work requiring auditable rationale and replay
- Any workflow where you want **Experiment → Design → Implement → Negotiate** discipline

---

## Non-Negotiable Defaults

1. **Start with questionnaire scoping** for ambiguous asks.
2. **Run strict Eisenhower** for consequential decisions.
3. **Record evidence before verdict** (benchmarks, docs, code paths).
4. **Treat override as exceptional** and explicit.
5. **Close loop with replay + task notes**.

---

## Decision Tree 1 — Should I run Eisenhower?

```text
Is this decision reversible and low impact?
├─ Yes → Skip strict run; use direct execution + short note.
└─ No  → Run eisenhower_run_strict.

Is there disagreement or uncertain evidence?
├─ Yes → Run strict with explicit assumptions and conflict acknowledgement.
└─ No  → Still run strict if this affects architecture, reliability, or user trust.
```

---

## Decision Tree 2 — Tool Routing (full breadth)

```text
What is the primary need right now?
├─ Clarify requirements      → questionnaire
├─ Inspect local code        → bash (rg/find/ls) + read
├─ Edit implementation       → edit (surgical) / write (new or rewrite)
├─ Plan and dependency graph → task_create/task_batch/task_graph/feature_plan
├─ Parallel deep work        → subagent (specialist agents)
├─ Library API truth         → effect-docs, context7
├─ Canonical repo patterns   → deepwiki (Effect-TS/effect)
├─ Web/current research      → exa / firecrawl / nia research
├─ TUI or long-running agent → interactive_shell
└─ Decision ratification     → eisenhower_* lifecycle tools
```

---

## Core Eisenhower Lifecycle (strict)

### 1) Create full strict run

Use when stakes are medium/high:

- `eisenhower_run_strict`
  - Include `actor`, `context`, `hypothesisAStatement`, `hypothesisBStatement`
  - Include assumptions for both tracks
  - Keep `acknowledgeConflict=true`, `dualRunConsistent=true`, `humanSignoff=true`

### 2) Snapshot state

- `eisenhower_status` with `includeAuditTail`

### 3) If replay fails

- First preference: gather missing evidence and rerun strict
- Only if required: `eisenhower_override_finalize` with explicit confirm phrase

### 4) Final audit trail

- `eisenhower_replay`
- Add notes into tasks (`task_note`) with runId/winner/drift

---

## Playbook A — Architecture Choice

1. Scope with `questionnaire` (constraints, ownership, rollout risk).
2. Research:
   - `deepwiki_get-deepwiki-index` owner=`Effect-TS` repo=`effect`
   - `deepwiki_get-deepwiki-page` on relevant pages
   - `effect-docs_effect_docs_search` + `effect-docs_get_effect_doc`
3. Draft alternatives (A/B).
4. Run `eisenhower_run_strict`.
5. Record winner + replay in tasks (`task_note`).

---

## Playbook B — Performance Claim Challenge (e.g., 10k events/sec)

1. Locate path under test (`bash` + `read`).
2. Separate **synthetic path** vs **end-to-end path**.
3. Build reproducible benchmark harness (headless if possible).
4. Capture: target eps, observed eps, p95/p99, payload profile/tier, run duration.
5. Run strict Eisenhower to scope claim language (qualified vs broad).
6. Store final claim with caveats and next benchmark task.

---

## Playbook C — Implementation With Governance

1. Design with tasks first (`task_create` / `task_batch`).
2. Delegate specialist implementation via `subagent`.
3. Apply edits with `edit`/`write`; validate with `bash` test/typecheck.
4. If design shifts materially, rerun `eisenhower_run_strict`.
5. Close with `eisenhower_status` + `task_update done`.

---

## Tool-by-Phase Matrix (EDIN)

### Experiment
- `questionnaire`
- `read`, `bash`
- `deepwiki_*`, `effect-docs_*`, `context7_*`
- `exa_*`, `firecrawl_*`, `nia_*`

### Design
- `task_create`, `task_batch`, `task_graph`, `feature_plan`
- `component_breakdown_templates` (UI/system decomposition)
- `schema_drift` (schema/model/DDL alignment)

### Implement
- `edit`, `write`, `bash`
- `subagent`
- `interactive_shell` for supervised long-running sessions

### Negotiate
- `eisenhower_status`, `eisenhower_replay`, `eisenhower_run_strict`
- `eisenhower_override_finalize` (exception path)
- `task_note`, `task_update`

---

## References (local canonical)

### Eisenhower + Decision OS
- `.pi/extensions/eisenhower/index.ts`
- `.pi/extensions/hypothesis-lab/index.ts` (compat)
- `src/lib/hypothesis-lab/v1/atoms/ops.ts`
- `src/lib/hypothesis-lab/v1/services/DecisionMatrixService.ts`
- `src/lib/hypothesis-lab/v1/services/ReplayService.ts`
- `src/lib/hypothesis-lab/v1/services/ReplayDriftClassifier.ts`

### Logging + observability integration
- `.pi/extensions/shared/logging/service.ts`
- `.pi/extensions/log-viewer/index.ts`

### Streams benchmark context
- `src/lib/streams/playground/EmissionEngine.ts`
- `src/components/playground/streams/StreamsPlayground.tsx`
- `src/components/playground/streams/panels/TopologyPanel.tsx`

### External pattern authority
- DeepWiki canonical query target: `Effect-TS/effect`

---

## Anti-Patterns

- Treating static UI demo topology as measured pipeline performance.
- Using override before attempting evidence completion/rerun.
- Skipping questionnaire on ambiguous high-impact decisions.
- Mixing “claim language” (broad) with “measured scope” (narrow).

---

## Minimal Command Template (copy/paste)

1. **Scope**: run `questionnaire`.
2. **Strict decision**: run `eisenhower_run_strict` with A/B + assumptions.
3. **Verify**: run `eisenhower_status` and `eisenhower_replay`.
4. **If needed**: run `eisenhower_override_finalize` explicitly.
5. **Persist**: `task_note` with runId, winner, replay, drift, and next actions.
