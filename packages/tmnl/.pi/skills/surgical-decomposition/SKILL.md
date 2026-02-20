---
name: surgical-decomposition
description: Decompose large modules into focused, cycle-free submodules with shell-driven auditing, backward-compatible shims, incremental verification, and efficiency passes. Use when asked to split a large file, code-split a module, decompose a monolith, reduce file size, or apply composition patterns to an oversized source file.
license: MIT
metadata:
  author: Val (TMNL architectural conscience)
  version: "1.0.0"
  origin: "Floating panel system decomposition — 602→7 modules, 391→128 line provider"
---

# Surgical Decomposition

A battle-tested methodology for splitting large modules into focused, cycle-free submodules while maintaining backward compatibility, zero regressions, and incremental verification at every step.

## When to Use

- A file exceeds ~200 lines and mixes multiple concerns
- "Split this into smaller modules"
- "Code-split X" / "Decompose Y"
- "This file is too big" / "Reduce file size"
- "Apply composition patterns to Z"
- Module has high fan-in (many consumers) making naive splits risky
- You need to guarantee zero broken imports after restructuring

## Philosophy

**The scalpel, not the shotgun.** Every cut is preceded by a shell-driven audit. Every new file is verified before the next cut. The old file becomes a re-export shim — no consumer changes needed on day one. Efficiency fixes ride the same PR as the structural split.

## Workflow Overview

```
AUDIT → MAP → PLAN → EXTRACT → SHIM → VERIFY → OPTIMIZE → COMMIT
  │       │      │       │        │       │         │          │
  │       │      │       │        │       │         │          └─ One atomic commit
  │       │      │       │        │       │         └─ Efficiency pass on extracted code
  │       │      │       │        │       └─ tsc + tests after EVERY extraction
  │       │      │       │        └─ Old file → thin re-export barrel
  │       │      │       └─ One module at a time, leaf-first
  │       │      └─ Name modules, draw dependency arrows, check for cycles
  │       └─ Shell scripts map imports, exports, consumers, line counts
  │
  └─ Read the entire file. No shortcuts.
```

## Phase 1: AUDIT — Shell-Driven Analysis

**Read the full source file.** Then run these shell audits. Do NOT skip any.

### 1A. Section Map

Identify natural boundaries by function/const/class declarations:

```bash
grep -n '^export function\|^export const\|^export class\|^export type\|^export interface\|^// ===' TARGET_FILE
```

### 1B. Consumer Map

Who imports from this file, and what symbols do they need?

```bash
# List all consumers
grep -rn "from.*TARGET_MODULE" src/ --include='*.ts' --include='*.tsx' | \
  grep -v 'TARGET_FILE:' | sed 's/:.*from.*//' | sort -u

# Per-consumer symbol audit
for f in $(grep -rln "from.*TARGET_MODULE" src/ --include='*.ts' --include='*.tsx' | grep -v TARGET_FILE); do
  echo "--- $(basename $f):"
  grep -B20 "from.*TARGET_MODULE" "$f" | grep -E '^\s+\w+' | sed 's/,$//' | tr -d ' '
  echo ""
done
```

### 1C. Internal Dependency Map

What does the target file import? Could any of those create a cycle?

```bash
grep "^import" TARGET_FILE

# Check if any dependency imports TARGET back (cycle detection)
for dep in $(grep "^import.*from './" TARGET_FILE | sed "s/.*from '//;s/'.*//"); do
  dep_file="$(dirname TARGET_FILE)/${dep}.ts"
  [ -f "$dep_file" ] && grep -q "TARGET_MODULE" "$dep_file" && echo "CYCLE: $dep"
done
```

### 1D. Line Budget

```bash
wc -l < TARGET_FILE
```

**Write down the number.** You'll compare against it at the end.

## Phase 2: MAP — Module Boundaries

From the section map, identify natural extraction targets. Each module should have:

- **Single responsibility** — one reason to change
- **Minimal coupling** — fewest cross-module function calls
- **Leaf-first ordering** — extract modules with no internal dependencies first

### Naming Convention

```
target-module/
├── constants.ts      ← literals, magic numbers (ALWAYS a leaf)
├── types.ts          ← type aliases specific to this domain (leaf if no runtime)
├── computed.ts       ← pure derived values / selectors (leaf)
├── effects.ts        ← side-effectful operations (leaf or late-bound)
├── actions.ts        ← mutation functions (imports instance)
├── instance.ts       ← singleton / factory (imports everything above)
├── index.ts          ← barrel re-export
```

Adapt names to your domain. The pattern is: **leaves → core → barrel**.

### Dependency Graph Validation

Draw the dependency arrows. Verify **no cycles**:

```
constants ← (leaf)
types     ← (leaf)
computed  ← types
effects   ← types, constants
instance  ← types, computed, effects, constants
actions   ← instance, types, constants
index     ← (re-exports everything)
```

If you find a cycle:
1. **Type-only imports** (`import type { X }`) — OK, erased at compile time
2. **Late-binding** (`require()` inside function body) — OK for effects that need instance
3. **Extract shared code** into a new leaf module — preferred

## Phase 3: EXTRACT — One Module at a Time

**Order: leaves first, then modules that depend on leaves, then the core.**

For each extraction:

1. **Create the new file** with the extracted code
2. **Run `tsc --noEmit`** — must be clean
3. **Run tests** — must pass
4. **Only then** proceed to the next extraction

```bash
# After each extraction:
npx tsc --noEmit && echo "CLEAN" || echo "BROKEN"
npx vitest run path/to/tests/ 2>&1 | tail -3
```

**Never batch extractions.** One file, one verify. If tsc breaks, you fix it before touching anything else.

## Phase 4: SHIM — Backward-Compatible Re-export

Replace the original file with a thin re-export shim:

```typescript
/**
 * [Module Name] — re-export shim
 *
 * Logic decomposed into [subdir]/. This file re-exports
 * everything for backward compatibility. New code should
 * import from './[subdir]' directly.
 *
 * @module
 */
export {
  // ... every public symbol, grouped by source module
} from './[subdir]'
```

**This is non-negotiable.** The shim means zero consumer changes. Every existing import path works. Consumers migrate to direct imports at their own pace.

### Verify the shim:

```bash
# Every consumer must still compile
npx tsc --noEmit

# Grep for any broken import paths
grep -rn "from.*TARGET_MODULE" src/ --include='*.ts' --include='*.tsx' | \
  grep -v node_modules | grep -v '.d.ts'
```

## Phase 5: OPTIMIZE — Efficiency Pass

With the code now split into focused modules, audit each for micro-optimizations:

### 5A. Redundant Reads

```bash
# Multiple .peek() calls on the same observable in one function
grep -n '\.peek()' NEW_MODULE | sort
```

Fix: Cache in a local variable.

### 5B. Loop Patterns

```bash
# forEach where for-loop is faster (hot path)
grep -n '\.forEach(' NEW_MODULE
```

Fix: Replace with indexed `for` loop on hot paths (drag handlers, z-index reassignment).

### 5C. Duplicated Logic

```bash
# Same pattern appearing 2+ times
# (manual review — look for copy-pasted viewport/bounds calculations)
```

Fix: Extract helper function.

### 5D. Unnecessary Allocations

Look for object spreads (`{ ...obj }`) or array copies (`[...arr]`) inside batch/loop bodies that could be avoided.

### 5E. Guard Patterns

```bash
# Verbose if-guard + set that could be optional chain
grep -n 'if.*peek.*\n.*set(' NEW_MODULE
```

Fix: `obs?.field.set(value)` instead of `if (obs?.peek()) { obs.field.set(value) }`.

## Phase 6: VERIFY — Final Gates

Run every gate. All must pass.

```bash
# 1. Type check
npx tsc --noEmit

# 2. Tests
npx vitest run path/to/tests/

# 3. Line budget (new modules should total ≤ 120% of original)
find NEW_DIR -name '*.ts' | xargs wc -l | tail -1

# 4. Cycle check
for f in NEW_DIR/*.ts; do
  imports=$(grep "from './" "$f" | sed "s/.*from '.\///;s/'.*//;s/\.ts$//" | sort)
  for imp in $imports; do
    back=$(grep -l "from '.*$(basename $f .ts)'" "NEW_DIR/$imp.ts" 2>/dev/null)
    [ -n "$back" ] && echo "CYCLE: $(basename $f) <-> $imp"
  done
done

# 5. Consumer compilation (same as tsc but makes intent explicit)
echo "All consumers compile: $(npx tsc --noEmit 2>&1 | wc -l) errors"

# 6. No orphaned exports
# Compare exports in barrel vs exports in shim
diff <(grep 'export' NEW_DIR/index.ts | sort) <(grep 'export' SHIM_FILE | sort)
```

## Phase 7: COMMIT — One Atomic Commit

Single commit with a structured message:

```
refactor(domain): decompose [file] into [subdir]/ modules

Split [N]-line monolith into [M] focused modules:

[subdir]/constants.ts  ([N] lines) — [description]
[subdir]/types.ts      ([N] lines) — [description]
...

[file].ts              ([N] lines) — backward-compat re-export shim

Cycle audit: CLEAN
- [leaf modules listed]
- [dependency direction noted]

Efficiency fixes:
- [fix 1]
- [fix 2]

[N]/[N] tests pass, tsc clean
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Extract 5 files at once, then check tsc | Extract one, verify, repeat |
| Delete the old file | Replace with re-export shim |
| Move consumers to new paths in the same PR | Shim first, migrate consumers later |
| Skip the consumer audit | `grep -rn` is your first command |
| Guess at cycle safety | Draw the dependency graph |
| "I'll optimize later" | Efficiency pass rides the same commit |
| Batch rename imports across 15 files | Shim handles this automatically |

## Composition Pattern Integration

When the decomposition target is a **React component or provider**, layer in [Vercel composition patterns](references/composition-patterns.md):

1. **Context redesign** — `{ state, actions, meta }` shape
2. **Per-scope context** — system-level for orchestration, item-level for compound children
3. **Compound namespace** — `Component.Header`, `Component.Content`, etc.
4. **Zero-prop atoms** — sub-components read from context, not props
5. **Default + custom children** — auto-detect compound vs passthrough composition

See [references/composition-patterns.md](references/composition-patterns.md) for the full pattern library.

## Questionnaire: Decomposition Scope

When the target and scope aren't obvious, use the questionnaire tool:

```json
{
  "id": "decomp-scope",
  "title": "Decomposition Scope",
  "startId": "q1",
  "tags": ["architecture", "decomposition"],
  "questions": [
    {
      "id": "q1",
      "prompt": "What's the decomposition target?",
      "type": "select",
      "options": [
        { "value": "monolith", "label": "Single large file (>300 lines)" },
        { "value": "provider", "label": "React provider/component" },
        { "value": "service", "label": "Service/state module" },
        { "value": "mixed", "label": "Mixed concerns (UI + state + effects)" }
      ],
      "next": { "monolith": "q2", "provider": "q3", "service": "q2", "mixed": "q3" }
    },
    {
      "id": "q2",
      "prompt": "Primary concern to split on?",
      "type": "select",
      "options": [
        { "value": "responsibility", "label": "By responsibility (CRUD, queries, effects)" },
        { "value": "consumer", "label": "By consumer (who needs what)" },
        { "value": "lifecycle", "label": "By lifecycle (init, runtime, cleanup)" }
      ]
    },
    {
      "id": "q3",
      "prompt": "Composition pattern needed?",
      "type": "multi-select",
      "options": [
        { "value": "context-sam", "label": "state/actions/meta context" },
        { "value": "compound", "label": "Compound component namespace" },
        { "value": "hook-extract", "label": "Extract hooks from provider" },
        { "value": "atom-split", "label": "Split atomic sub-components" }
      ]
    }
  ]
}
```

## Real-World Results

This methodology was developed during the TMNL floating panel decomposition:

| Metric | Before | After |
|--------|--------|-------|
| `floating-stx.ts` | 602 lines | 7 modules (662 total, shim = 53) |
| `FloatingPanelProvider.tsx` | 391 lines | 128 lines + 4 extracted hooks |
| `PanelHeader.tsx` | 146 lines | 49 lines + 8 atomic compounds |
| Consumer import changes | — | Zero (shim) |
| Test regressions | — | Zero (43/43) |
| Circular dependencies | — | Zero (verified) |
| Commits | — | 3 atomic commits |
