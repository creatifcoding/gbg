# JSON-Render Effect — Autonomous Evolution PRD

> **For**: ralph-wiggum autonomous loop
> **Status**: Active
> **Last Updated**: 2026-01-15
> **Progress Checkpoint**: Phase 1 - Foundation

---

## Prime Directive

Build a **production-ready, stream-based JSON UI rendering system** using Effect-TS. The system must:
1. Accept JSON component definitions via Effect.Stream
2. Render React components with full lifecycle support
3. Pass all tests (original json-render + new comprehensive suite)
4. Evolve toward deeper, more granular functionality

---

## Research Protocol

### Before ANY Implementation:

1. **Query DeepWiki** for Effect patterns:
   ```
   mcp__deepwiki__ask_question({ repoName: "Effect-TS/effect", question: "..." })
   ```

2. **Check effect-docs MCP** for canonical patterns

3. **Read original json-render** source:
   ```
   ../../submodules/json-render/packages/core/src/
   ../../submodules/json-render/packages/react/src/
   ```

4. **Check submodules** for human-authored docs:
   ```
   ../../submodules/website/content/docs/
   ../../submodules/effect/packages/*/test/
   ```

### Research Checklist (Per Feature):
- [ ] Queried DeepWiki for relevant Effect pattern
- [ ] Checked effect-atom for Atom patterns
- [ ] Read original json-render implementation
- [ ] Identified divergence points
- [ ] Documented rationale

---

## Phase Gates (Sequential)

### PHASE 1: Foundation ✅ COMPLETE
**Goal**: Pass original json-render test suite

**Status**: Complete

**Tasks**:
- [x] Create fork at `src/lib/json-render/core/`
- [x] Implement schemas.ts with Effect Schema
- [x] Implement path.ts with Effect returns
- [x] Implement visibility.ts with Match.exhaustive
- [x] Implement actions.ts with Fiber/Deferred/PubSub/Queue
- [x] Implement validation.ts with Effect returns
- [x] Implement streaming.ts with Effect.Stream
- [x] Implement catalog.ts with Effect Schema
- [x] Run original test suite (126/126 pass)
- [x] Document intentional divergences (DIVERGENCE.md)

**Commands**:
```bash
# Run existing tests
bun test ../../submodules/json-render/packages/core/src/*.test.ts

# Type check
bunx tsc --noEmit --project tsconfig.json 2>&1 | grep json-render
```

**Exit Criteria**: All original tests green OR documented exceptions with superior alternatives.

---

### PHASE 2: Comprehensive Testing Architecture ⬅️ CURRENT
**Goal**: Build test infrastructure that validates the Effect-native implementation

**Status**: Not Started (Next Priority)

**Create test files**:
```
src/lib/json-render/core/__tests__/
├── schemas.test.ts       # Schema encoding/decoding roundtrips
├── path.test.ts          # JSON Pointer operations + errors
├── visibility.test.ts    # Logic expression evaluation + Match exhaustiveness
├── actions.test.ts       # Fiber/Deferred/PubSub behavior + cancellation
├── validation.test.ts    # Validation pipeline + async validators
├── streaming.test.ts     # Stream processing + backpressure + throttling
├── catalog.test.ts       # Component registry + prompt generation
└── integration.test.ts   # End-to-end: stream → render → action → result
```

**Testing Patterns**:
- Use `@effect/vitest` for Effect-native assertions
- Test cancellation via `Fiber.interrupt`
- Test backpressure via `Queue.bounded` with slow consumer
- Test confirmation suspension via `Deferred.await`
- Property-based tests for schema encoding roundtrips (use `fast-check`)

**Exit Criteria**: >90% coverage, all Effect primitives exercised.

---

### PHASE 3: React Integration ✅ COMPLETE
**Goal**: Bridge Effect core to React rendering

**Status**: Complete

**Created**:
```
src/lib/json-render/react/
├── atoms.ts              ✓ Atom-based state (UITree, actions, visibility)
├── hooks.ts              ✓ useUIStream, useAction, useVisibility, useData, useConfirmation
├── renderer.tsx          ✓ <Renderer tree={...} registry={...} />
├── provider.tsx          ✓ <JSONRenderProvider> with confirmation dialogs
└── index.ts              ✓ Barrel exports
```

**Patterns Used**:
- `Atom.make<UITree>()` for reactive tree state ✓
- `Deferred.make<boolean>()` for confirmation suspension ✓
- `useAtomValue()` for subscriptions ✓
- `registry.set()` for synchronous mutations in callbacks ✓
- `Option.match` with spread for optional properties ✓

**Exit Criteria**: ✅ Can render streamed JSON → React components with full interactivity.

---

### PHASE 4: Continuous Evolution
**Goal**: Deepen functionality, add capabilities

**Status**: Not Started

**Evolution Vectors** (prioritize by impact):

| Vector | Description | Effect Primitives |
|--------|-------------|-------------------|
| Schema Inference | Auto-generate TS types from runtime schemas | Schema.to, AST |
| Streaming Enhancements | Delta compression, optimistic updates, multi-stream merge | Stream.merge, Stream.changes |
| Advanced Actions | Middleware, sagas, undo/redo | Layer, Fiber, Ref |
| Validation Evolution | Async validators, cross-field graphs | Effect.all, Schedule |
| Developer Experience | DevTools, HMR, error boundaries | PubSub, Stream.tap |
| Performance | Virtualization, selective hydration, workers | Stream.buffer, Fiber.fork |

**Per Vector**:
1. Research via DeepWiki
2. Check if effect ecosystem has solution
3. Implement with tests
4. Document in this PRD

---

## Execution Rules

### Per Iteration:
1. **Read this PRD** — Understand current phase and progress
2. **Research** — Query DeepWiki, check effect-docs, read json-render source
3. **Assess** — Run tests, identify gaps or opportunities
4. **Plan** — Pick ONE improvement, add to Progress Log below
5. **Implement** — Make changes, run tests incrementally
6. **Verify** — All tests pass, no regressions
7. **Document** — Update this PRD with progress
8. **Commit** — Atomic commit with clear message

### Constraints:
- **ALL functions return Effects** — No sync shortcuts
- **Schema.decode at boundaries** — Never trust raw JSON
- **Immutable state** — Schema.Class methods return new instances
- **No React useState for shared state** — Use Atom
- **Test before merge** — Green CI or no commit
- **Research before implement** — DeepWiki first

### Quality Gates:
- TypeScript strict mode passes
- No `any` casts (use `Schema.decode`)
- No `throw` (use `Data.TaggedError`)
- No callback nesting (use `Deferred`)
- No Effect anti-patterns (see below)

---

## Effect Anti-Patterns (AVOID)

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `throw new Error()` | `Effect.fail(new MyError())` |
| `await` inside `Effect.gen` | `yield*` |
| `as any` casts | `Schema.decode()` |
| Global mutable state | `Layer` + `Ref` |
| `new Promise()` | `Effect.promise()` |
| Non-exhaustive switch | `Match.exhaustive` |
| `try/catch` | `Effect.catchTag()` |

---

## File Structure

```
src/lib/json-render/
├── core/
│   ├── schemas.ts        ✓ Effect Schema definitions
│   ├── path.ts           ✓ JSON Pointer utilities
│   ├── visibility.ts     ✓ Match.exhaustive evaluation
│   ├── actions.ts        ✓ Fiber/Deferred/PubSub/Queue
│   ├── validation.ts     ✓ Validation pipeline
│   ├── streaming.ts      ✓ Effect.Stream processing
│   ├── catalog.ts        ✓ Component registry
│   ├── index.ts          ✓ Barrel export
│   └── __tests__/        ○ Not started
├── react/                 ✓ Complete
│   ├── atoms.ts           ✓ Module-level state atoms
│   ├── hooks.ts           ✓ Effect-native React hooks
│   ├── renderer.tsx       ✓ Recursive element rendering
│   ├── provider.tsx       ✓ Context providers
│   └── index.ts           ✓ Barrel exports
├── index.ts               ✓ Main entry point
├── PRD.md                 ✓ Product requirements
├── RALPH_PRD.md           ✓ This file (autonomous loop guide)
├── ARCHITECTURE.md        ✓ System diagrams
└── DIVERGENCE.md          ✓ Original vs fork comparison
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Original test suite | 100% pass | ✓ 126/126 |
| New test coverage | >90% | 0% |
| TypeScript errors | 0 | 0 |
| Effect primitives used | All | Schema, Stream, Fiber, Ref, Deferred, PubSub, Queue, Match |
| React integration | Functional | ✓ Complete |
| Documentation | Current | ✓ |

---

## Progress Log

### 2026-01-15 - Initial Fork
- Created core module with Effect Schema
- Implemented all core files
- Created ARCHITECTURE.md and DIVERGENCE.md
- **Next**: Run original tests, create adapter if needed

### 2026-01-15 - Gap Analysis & React Layer Planning
- **Ran original test suite**: 126 tests PASS
- **TypeScript check**: 0 errors in json-render fork
- **Analyzed original React layer patterns**:
  - `hooks.ts`: useUIStream (fetch → parse → apply patches → update tree)
  - `contexts/actions.tsx`: ActionProvider with Promise-based confirmations
  - `contexts/visibility.tsx`: VisibilityProvider with evaluateVisibility
  - `renderer.tsx`: ElementRenderer (recursive) + Renderer (entry point)
- **Identified core vs React gap**:
  - Core streaming.ts is solid (applyPatch, processPatches, makeUIStream, flatToTree)
  - Missing: React integration layer with Atoms
- **Key pattern translations needed**:
  | Original | Effect-native |
  |----------|---------------|
  | `useState<UITree>` | `Atom.make<UITree>()` |
  | `AbortController` | `Fiber.interrupt()` |
  | `new Promise(resolve, reject)` | `Deferred.make<boolean>()` |
  | `React.createContext` | `Atom + Registry.make()` |
  | `useCallback` | `runtimeAtom.fn()` |
- **Next**: Create React layer (atoms.ts, hooks.ts, renderer.tsx, provider.tsx)

### 2026-01-15 - React Layer Implementation
- **Created atoms.ts**: Module-level atoms for all state
  - `treeAtom`, `isStreamingAtom`, `errorAtom` - core stream state
  - `dataModelAtom`, `authStateAtom` - context state
  - `actionHandlersAtom`, `loadingActionsAtom`, `pendingConfirmationAtom` - action state
  - `streamFiberAtom` - fiber tracking for cancellation
  - Derived atoms: `visibilityContextAtom`, `hasErrorAtom`, `hasPendingConfirmationAtom`
- **Created hooks.ts**: Effect-native React hooks
  - `useUIStream` - Stream JSON patches with Fiber cancellation
  - `useIsVisible`, `useVisibility` - Visibility evaluation
  - `useData` - Data model access/mutation
  - `useActions` - Register action handlers
  - `useAction` - Execute actions with Deferred confirmation
  - `useConfirmation` - Handle confirmation dialogs
- **Created renderer.tsx**: Recursive rendering
  - `ElementRenderer` - Recursive component with visibility checks
  - `Renderer` - Entry point component
  - `DefaultFallback`, `LoadingSkeleton` - Fallback components
- **Created provider.tsx**: Context providers
  - `JSONRenderProvider` - Wraps with Registry context
  - `DefaultConfirmationDialog` - Default confirmation UI
  - Supports custom registry injection for testing
- **ResolvedAction Schema Migration**:
  - Added `ResolvedAction` as Schema.Class in schemas.ts
  - Used idiomatic `Option.match` with spread for optional properties
  - Fixed all callsites to use `new ResolvedAction({...})`
- **DeepWiki research**: Confirmed `Option.match` spread pattern is canonical Effect idiom
- **Tests**: 126 original tests PASS, 0 TypeScript errors
- **Next**: Create comprehensive test suite for React layer

### 2026-01-15 - JSONRenderTestbed Created
- **Created JSONRenderTestbed.tsx** with TMNL components:
  - Component registry mapping json-render types to TMNL UI (Button, Card, Input, Badge, etc.)
  - Demo tree with Cards, Buttons, Inputs, Visibility conditions
  - Action handlers registered with Effect.sync
  - TMNLConfirmationDialog using useConfirmation hook with Deferred
  - DataModelPanel with reactive Switch/Input for testing visibility
  - ActionLog panel showing executed actions
- **Fixed TypeScript issues**:
  - Index signature access (`data['isAdmin']` vs `data.isAdmin`)
  - Proper `EqCondition` and `PathRef` for visibility conditions
  - Cleaned up unused imports
- **Tests**: 126 original tests PASS, 0 TypeScript errors
- **Next**: Phase 2 - Comprehensive Testing Architecture (create test suite for Effect-native implementation)

### [DATE] - [DESCRIPTION]
- Tasks completed
- Issues encountered
- **Next**: What to do next

---

## Quick Reference Commands

```bash
# Type check
bunx tsc --noEmit --project tsconfig.json 2>&1 | grep json-render

# Run original tests
bun test ../../submodules/json-render/packages/core/src/*.test.ts

# Run our tests (when created)
bun test src/lib/json-render/core/__tests__/

# Query DeepWiki
# Use mcp__deepwiki__ask_question tool

# Check effect-atom patterns
cat ../../submodules/effect-atom/packages/atom/test/Atom.test.ts
```

---

## External Resources

| Resource | How to Access |
|----------|---------------|
| DeepWiki | `mcp__deepwiki__ask_question({ repoName: "Effect-TS/effect", question: "..." })` |
| effect-docs MCP | Available in tool list |
| Original json-render | `../../submodules/json-render/` |
| Effect website docs | `../../submodules/website/content/docs/` |
| effect-atom source | `../../submodules/effect-atom/` |
| Effect source | `../../submodules/effect/` |
