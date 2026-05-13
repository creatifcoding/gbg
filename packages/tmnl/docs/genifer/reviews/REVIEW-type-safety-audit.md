---
title: Genifer Type Safety & Schema Conformance Audit
date: 2026-02-20
author: Adversarial Reviewer - Type Auditor
status: COMPLETE
---

## Executive Summary

This audit found **serious schema-contract drift** between documented intent and runtime behavior in `src/lib/genifer/`.

The most severe failures are:

1. **False pi-ai shape alignment claims** in `core/tools.ts` (field names and payload structure do not match actual `@mariozechner/pi-ai` contracts).
2. **No runtime args validation** in `react/tool-registry.ts` before handler execution, despite carrying a `parametersSchema` field.
3. **Global mutable state leaks** across service instances (`toolHandlers`, `elementSchemas`) violating registry isolation and creating cross-instance race potential.
4. **Prompt compile pipeline lacks type enforcement and robust error boundaries**.
5. **Thread turn computation is structurally naive** and breaks on non-trivial message sequences (tool/system messages between user/assistant).

Bottom line: there is Schema usage, but critical boundaries are still “trust me, bro.”

---

## Schema Compliance Matrix

| File | Schema Model Usage | Runtime Validation at Boundary | Atom-as-State / Registry Discipline | Verdict |
|---|---|---|---|---|
| `src/lib/genifer/core/tools.ts` | Uses `Schema.Class`/`Schema.Literal` | **No decode boundary** for external tool payloads | N/A | **FAIL** |
| `src/lib/genifer/core/prompts.ts` | Uses `Schema.Class`/`Schema.Literal` | Compile-time only; runtime slot type checks missing | N/A | **FAIL** |
| `src/lib/genifer/core/threads.ts` | Good union via `TaggedStruct` + `Schema.Union` | Constructor-only validation; no boundary error wrapping | N/A | **WARN** |
| `src/lib/genifer/react/tool-registry.ts` | Relies on schema classes from core | **Missing args validation** against schema | Uses atoms, but has global handler map leak | **FAIL** |
| `src/lib/genifer/react/thread-service.ts` | Instantiates `Thread`/`ThreadMessage` classes | No explicit decode or controlled parse error channel | Registry-scoped atoms ok | **WARN** |
| `src/lib/genifer/react/state-sync.ts` | Uses `StateChange` schema class | Field-level checks delegated to element; no transaction schema | Registry + atoms used, but global schema map leak | **FAIL** |
| `src/lib/genifer/streaming/bfta.ts` | Pure TS types, no Effect Schema contracts | No schema decode at API boundary | N/A | **WARN** |
| `src/lib/genifer/core/schemas.ts` | Strong schema baseline, many `Schema.*` definitions | Decoders exported for some core types only | N/A | **WARN** |

---

## Critical Type Safety Issues (with file:line)

### 1) pi-ai contract mismatch (documented alignment is inaccurate)
- `src/lib/genifer/core/tools.ts:77-87` — comment claims pi-ai `ToolCall` parity, but implementation uses `args` and lacks `type: "toolCall"`.
- `src/lib/genifer/core/tools.ts:105-114` — `GeniferToolResult.content` is `string`, while pi-ai `ToolResultMessage.content` is array of content parts.
- `src/lib/genifer/core/tools.ts:59` — `parametersSchema` optional unknown; pi-ai `Tool.parameters` is required typed schema.
- Reference contract: `node_modules/@mariozechner/pi-ai/dist/types.d.ts:85-90,123-130,134-138`.

**Impact:** Bridge code will eventually require lossy ad-hoc translation or fail silently.

### 2) Tool args are never validated before execution
- `src/lib/genifer/react/tool-registry.ts:113-199` — `execute()` dispatches `args` directly to handler.
- `src/lib/genifer/react/tool-registry.ts:168` — checks `requiresApproval`, but never checks `parametersSchema` shape.

**Impact:** handlers receive unvalidated payloads; runtime failures move downstream and become user-visible tool errors.

### 3) Cross-instance global mutable state in supposedly registry-scoped services
- `src/lib/genifer/react/tool-registry.ts:39` — `toolHandlers` is module-global (not registry-bound).
- `src/lib/genifer/react/state-sync.ts:76` — `elementSchemas` is module-global (not registry-bound).
- `src/lib/genifer/react/state-sync.ts:166` — `reset()` clears shared global schema map, affecting parallel instances.

**Impact:** isolation assumptions break under concurrent services/tests/multiple containers.

### 4) Prompt compile path has weak type and error boundaries
- `src/lib/genifer/core/prompts.ts:80-100` — no enforcement that runtime value matches declared `slot.type`.
- `src/lib/genifer/core/prompts.ts:82` — throws raw `Error`, no typed/tagged error channel.
- `src/lib/genifer/core/prompts.ts:91,94,97` — `String.replace` replaces first occurrence only; repeated placeholders remain unresolved.

**Impact:** malformed prompts can silently degrade LLM behavior.

### 5) Thread turn derivation breaks for realistic role sequences
- `src/lib/genifer/core/threads.ts:149-161` — `turns` pairs user with only immediate next assistant message.
- Any interleaved `tool` / `system` / multi-assistant sequence causes missing or mispaired turns.

**Impact:** analytics, replay, and conversation UI summarization become structurally wrong.

### 6) “Atomic multi-field update” is not atomic
- `src/lib/genifer/react/state-sync.ts:144-149` — `setFields()` loops `setField()` and returns on first error after prior mutations already committed.

**Impact:** partial writes under validation failure; state can end in impossible mixed versions.

### 7) Thread fork index is unchecked
- `src/lib/genifer/react/thread-service.ts:120-134` — `forkThread(atIndex)` accepts unchecked index; `forkAtIndex` can persist invalid metadata.

**Impact:** misleading lineage data and brittle downstream assumptions.

### 8) BFTA validator stack keyed only by depth
- `src/lib/genifer/streaming/bfta.ts:311-322` — `openNodes` keyed by depth; a second `pushNode` at same depth overwrites prior node.

**Impact:** malformed or out-of-order stream events can corrupt validator state with no guardrail.

---

## Schema Patterns Audit

### What is solid
- `core/threads.ts` uses `Schema.TaggedStruct` for discriminated content union (`MessageContent`) correctly.
- `core/schemas.ts` has broad baseline coverage and uses `Schema.TaggedClass` / `Schema.Class` consistently.
- `core/tools.ts` and `core/prompts.ts` at least model core domain objects via Schema-backed classes.

### What violates stated discipline
- The AGENTS mandate says **TaggedStruct for data** and **Schema.Class for entities**. Several pure data carriers are classed as entities (`PromptSlot`, `PromptTemplate`, `GeniferToolCall`, `GeniferToolResult`, `ThreadMessage`, `Turn`) without strong entity behavior.
- `core/schemas.ts:114-153` uses raw TS recursive encoding types plus an `as Schema.Schema<...>` cast (`:153`) to force compatibility.
- `streaming/bfta.ts` is entirely raw TS types (`type BFTAState`, `type Grammar`, etc.) with no schema-backed boundary contract.

---

## Atom-as-State Service Audit

### Good
- All reviewed React services use `Atom.make(...)` and default to `Registry.make()`.
- Core state transitions are explicit via `registry.set(...)`.

### Critical lifecycle flaws
- `tool-registry` and `state-sync` each contain module-global mutable maps (`toolHandlers`, `elementSchemas`), which bypass Registry isolation.
- Singleton service instances (`getToolRegistryService`, `getThreadService`, `getStateSyncService`) have no disposal lifecycle and can accumulate stale state through hot reload or long sessions.
- `state-sync.removeElement()` removes element state but leaves dirty tracking/history semantics ambiguous.

---

## Missing Runtime Validation

1. **Tool execution boundary**: no schema decode of incoming args before handler (`react/tool-registry.ts:113-199`).
2. **Prompt slot typing**: slot `type` declarations are advisory only (`core/prompts.ts:80-100`).
3. **Thread service boundary**: no typed decode/error channel for external message payloads before class construction (`react/thread-service.ts:82-101`).
4. **BFTA public entry**: no schema-backed validation for `ComponentRegistration[]` input before grammar build (`streaming/bfta.ts:107`).

---

## Recommendations

1. **Fix pi-ai schema parity first (P0)**
   - Rename/reshape tool call/result models to match actual pi-ai contracts (`type`, `arguments`, content array).
   - Keep an explicit adapter if internal shape must differ; stop claiming 1:1 parity when it is not.

2. **Enforce decode-on-boundary (P0)**
   - Add `Schema.decodeUnknown(...)` at all external input edges for tool args, thread content payloads, and BFTA registrations.
   - Return tagged errors instead of throwing generic `Error`.

3. **Eliminate global mutable maps from services (P0)**
   - Move `toolHandlers` and `elementSchemas` into registry-backed atoms or service-local closure state keyed per registry instance.

4. **Make `setFields` truly atomic (P1)**
   - Validate all fields first, then commit one state update + one change-batch write.

5. **Harden prompt compiler (P1)**
   - Validate value types against slot declarations.
   - Replace all placeholder occurrences (`replaceAll`/global regex).
   - Add unresolved-placeholder detection and typed compile errors.

6. **Rework turn extraction logic (P1)**
   - Build turns using role-aware scan that tolerates interleaved tool/system messages.

7. **Reduce cast-based escapes (P2)**
   - Remove `as Schema.Schema<...>` where possible by explicit recursive schema construction helpers.

8. **Formalize registry lifecycle (P2)**
   - Introduce explicit create/dispose APIs and avoid singleton service state for testability and multi-container correctness.

---

If this were production-critical, I’d gate merges on (1) pi-ai contract fix, (2) args decode before tool execution, and (3) removal of cross-instance global mutable maps. Those three are non-negotiable for type-safety credibility.