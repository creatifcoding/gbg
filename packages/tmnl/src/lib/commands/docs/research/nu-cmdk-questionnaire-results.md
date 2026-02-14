# NuCmdk Questionnaire Results

**Status:** Captured  
**Date:** 2026-02-13  
**Source:** Interactive questionnaire sessions

---

## Session A — Architecture Gates (`nu-cmdk-gates-v1`)

### Responses

1. **Host strategy:** `minibuffer-first`
   - Note: modal version of minibuffer expected; custom modal library acceptable.

2. **Ranking authority:** `hybrid`
   - Provider contributes baseline ranking.
   - Shell applies contextual boosts and mode-aware adjustments.
   - Explicit ask for deeper search-scope alignment (captured in Session B).
   - Raycast recommended as reference interaction benchmark.

3. **Kind-tab semantics:** `hybrid`
   - Concurrent provider aggregation/streaming expected.
   - Must not block on all providers before showing useful results.

4. **Rollout:** `direct-cutover once parity tests pass`

---

## Session B — Search Capability Alignment (`nu-cmdk-search-alignment-v1`)

### Required searchable surfaces at launch

- Commands
- Entities
- Context actions
- Navigation targets/routes
- Documentation/help
- Terminal ops/history
- Recents/history
- Pipelines/workflows
- Agent tools/tasks

### Required query modes

- Fuzzy
- Prefix
- Exact
- Keyword aliases/synonyms
- Semantic/vector
- Regex

### Delivery model

- **Streaming per provider**

### Required ranking signals

- Text relevance
- Current context/mode
- Recency
- Usage frequency
- Scope fit
- Provider priority

### Non-negotiable UX features

- Kind tabs
- Group headings
- Inline preview/details
- Row badges/status
- Keyboard-only full flow
- Instant open (warm cache)
- Graceful empty/error states

---

## ALIGNED MODEL (30-second synthesis)

- **Shape:** `NuCmdkShell` compound with cmdk primitives + band slots.
- **Composition:** Hybrid provider streaming + shell contextual ranking.
- **API:** Minibuffer-first host, direct cutover after parity.
- **Scope:** Broad multi-surface search from day 1 (commands → agents/workflows/docs/terminal).
- **UX bar:** Raycast-grade responsiveness with keyboard-first full flow.

---

## Session C — Schema + Service Alignment (`nu-cmdk-schema-service-alignment-v1`)

### Locked selections

- Canonical row kinds: command/entity/action/navigation/documentation/terminal/workflow/agent/history/file
- Schema model: **pluggable variant registry with dynamic schema modules**
- Versioning: **per-variant**
- Invalid payload policy: **drop + telemetry**
- Orchestration boundary: **dedicated search broker service**
- State placement: **atoms + service-side cache**
- Ranking composition: provider base + relevance + context/scope + recency/frequency + confidence penalty
- Preview contract: **hybrid** (polymorphic summary + lazy deep details)

## Session D — Transport + IO Alignment (`nu-cmdk-transport-search-alignment-v1`)

### Locked selections

- Transport channels: in-process, RPC, HTTP, filesystem, vector, database
- RPC direction: mixed adapters, **Effect RPC-first protocol design**
- HTTP behavior: **timeout + partial lane results**
- File-search features: path/text/regex/symbol/git-aware
- File indexing: **hybrid warm index + on-demand fallback**
- Merge ordering: mode-dependent lane-ranked scoring
- Failure isolation: lane isolated, with row-level granularity emphasized
- Security: token auth + per-provider credentials + scoped queries + audit logs + redaction

## Post-questionnaire lock confirmations (live chat)

- Provider envelope: **Variant C (manifest + stream hybrid)**
- Renderer safety: every row variant must register a valid renderer (or fallback)
- Execution model: **data resolvers**
- Persisted warm cache: **SQLite approved**
- Semantic fallback chain: accepted as proposed
- Ranking/categorization recompute on row updates: explicitly required and accepted

## Immediate implications for spec/plan

1. Architecture must formalize **provider-concurrent streaming** and non-blocking merge behavior.
2. Schema model should include row variants for all launch surfaces.
3. Ranking engine must support pluggable multi-signal scoring.
4. Implementation plan should include parity tests before direct cutover.
5. Variant C manifest validation gates are mandatory before chunk ingestion.
