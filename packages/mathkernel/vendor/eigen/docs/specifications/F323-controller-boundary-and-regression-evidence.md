# F323 Controller Boundary + Regression Evidence

Date: 2026-02-17  
Owner: Val

## Scope

Finalize the `InlineTaskLogView` controller extraction and prove behavior/scalability contracts remain intact.

## Canonical seam (locked)

### 1) Controller orchestration hook

- File: `src/lib/agents/tasks/views/use-inline-task-log-controller.ts`
- Owns:
  - atom-surface readiness gating
  - stream trigger lifecycle per `taskId`
  - tail/inspect state transitions
  - unread accumulation/reset policy
  - reduced-motion-aware scroll scheduling

### 2) Explicit context boundary

- File: `src/lib/agents/tasks/views/inline-task-log-view-context.tsx`
- Exposes:
  - `InlineTaskLogViewProvider`
  - `useInlineTaskLogViewContext`
  - `InlineTaskLogViewContextValue`

### 3) View composition remains slot-first

- File: `src/lib/agents/tasks/views/inline-task-log-view.tsx`
- Root now consumes controller + context seam while preserving the existing compound slot API and default layout.

## Regression envelope (guardrail contract)

- File: `src/lib/agents/tasks/views/__tests__/inline-task-log-view.controller.test.tsx`

Covered behaviors:
1. **Task-switch reset semantics**
   - switching `taskId` resets inspect/unread state to LIVE baseline.
2. **Remount continuity**
   - remount on same task/runtime boundary remains clean and stable.
3. **High-volume bounded retention visibility envelope**
   - sustained stream remains bounded to tail window envelope (`<= 1000`, observed envelope asserted `900..1000` under test pacing).

## Supporting integration continuity

- `src/lib/agents/tasks/views/__tests__/inline-task-log-view.integration.test.tsx`
- `src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx`
- `src/lib/agents/tasks/views/__tests__/inline-task-log-view.compound.test.tsx`

These continue to validate stream/filter/expand pipeline and tail/inspect UX semantics after seam extraction.

## Validation snapshot

Targeted suite:
- controller + inline view + filter/dork + atoms retention/querydsl + mock transport
- **26/26 passing**

Typecheck:
- `bunx tsc --noEmit --pretty false` ✅

## Decision

F323 controller/context seam is the canonical downstream contract.
Drift against this seam should be escalated immediately and fixed at source.
