# Agent Handoff: TMNL Architecture Documentation

> **Purpose**: Guide agents working with TMNL architecture documentation.
> **Target**: Agents (Val, Oracle, Librarian, Explore, etc.)
> **Context**: Reorganization of 71+ systems across `src/lib/`

---

## Directory Structure

```
.architecture/
├── README.md              # Overview, purpose, quick links
├── INDEX.md               # Ever-growing index of all documents
├── AGENTS.md              # This file: agent handoff guide
├── REORG_STRATEGY.md     # Main reorganization plan (✅ Complete)
└── [future docs]         # System maps, migration guides, etc.
```

---

## How to Use This Directory

### For Agents Starting New Work

1. **Check INDEX.md**: Scan for existing relevant documents
2. **Read AGENTS.md**: Understand context, constraints, and canonical patterns
3. **Find system**: Locate target system in `src/lib/` using:
   ```bash
   rg "src/lib/<system>" --type ts --files-with-matches
   ```
4. **Apply patterns**: Follow canonical system skeleton from REORG_STRATEGY.md

### For Agents Continuing Work

1. **Locate context**: Search docs by system name or category
2. **Check dependencies**: Note cross-system integration rules
3. **Update INDEX.md**: Mark progress, add new docs as needed

---

## Key Architectural Decisions

### Decision: Tiered Architecture (Foundation → Capabilities → Features)

**Status**: ✅ Implemented (pending migration)

**Structure**:

```
src/lib/
├── _core/         # Foundation: Effect primitives, schema helpers, runtime utilities
├── capabilities/   # Cross-cutting: commands, hotkeys, overlays, layers, telemetry
└── features/      # User-facing: terminal, editor, AVA, data-grid, tldraw
```

**Rationale**:

- Prevents circular dependencies (capabilities depend on \_core, not features)
- Clear ownership (each capability has one owner)
- Enables safe refactoring (features can't accidentally depend on each other)

**See**: [REORG_STRATEGY.md](./REORG_STRATEGY.md) - Phase 1 for details

---

### Decision: Canonical System Skeleton

**Status**: ✅ Designed (pending implementation)

**Every system** follows this structure:

```
<system>/
├── README.md              # System purpose, public API, version notes
├── schemas/              # Effect Schema domain types
├── services/             # Effect services (no React)
├── atoms/
│   ├── runtime.ts       # Atom.runtime + Layer composition
│   ├── state.ts         # Atom.make (module-level)
│   ├── ops.ts           # runtime.fn operations
│   └── index.ts         # Atom exports
├── hooks/                # React hooks (useAtomValue, etc.)
├── components/            # System-local UI
├── wire/                 # EXPLICIT cross-system bindings
├── internal/             # Non-exported implementation
└── index.ts              # ONLY public exports
```

**See**: [REORG_STRATEGY.md](./REORG_STRATEGY.md) - Canonical System Skeleton

---

### Decision: Cross-System Integration Rules

**Status**: ✅ Designed (pending enforcement)

**Rule 1: Directional Imports**

- ✅ Allowed: Features → Capabilities (e.g., `import { CommandService } from '@/lib/capabilities/commands'`)
- ❌ Forbidden: Capabilities → Features

**Rule 2: Wire Modules Own Integration**

- All cross-system integration happens through explicit `wire/<target>-adapter.ts` modules
- Example: `editor/v3/blocks/MapBlock/wire/ava-adapter.ts`

**Rule 3: One Import Path**

- Components import only from `<system>/index.ts`
- Direct imports to `atoms/`, `services/` are FORBIDDEN in cross-system contexts

**See**: [REORG_STRATEGY.md](./REORG_STRATEGY.md) - Cross-System Integration Rules

---

## Current System State

### Versioned Systems (Consolidation Required)

| System           | Versions   | Status                     | Priority |
| ---------------- | ---------- | -------------------------- | -------- |
| **terminal**     | v1, v2, v3 | 3 parallel implementations | 🔴 P0    |
| **data-manager** | v1, v2     | 2 parallel implementations | 🔴 P0    |
| **editor**       | v1, v2, v3 | 3 parallel implementations | 🟡 P1    |
| **slider**       | v1, v2     | 2 parallel implementations | 🟢 P2    |

**Strategy**: Consolidate via facades:

1. Freeze latest version (v3 for terminal, v2 for data-manager/editor/slider)
2. Move older versions to `@deprecated` folders
3. Provide canonical imports from `index.ts`
4. Gradually migrate call sites

### Cross-Cutting Concerns

| Concern      | Current Location    | Target                   | Status     |
| ------------ | ------------------- | ------------------------ | ---------- |
| **Commands** | `src/lib/commands/` | `capabilities/commands/` | 📋 Planned |
| **Hotkeys**  | `src/lib/hotkeys/`  | `capabilities/hotkeys/`  | 📋 Planned |
| **Layers**   | `src/lib/layers/`   | `capabilities/layers/`   | 📋 Planned |
| **Overlays** | `src/lib/overlays/` | `capabilities/overlays/` | 📋 Planned |

### Well-Organized Systems (Templates)

Use these as references for migration:

| System              | Why It's Good                                     | Key Files          |
| ------------------- | ------------------------------------------------- | ------------------ |
| **slider/v1**       | Atoms/services/hooks/components clearly separated | `index.ts:38`      |
| **hotkeys**         | Atom-first architecture documented                | `index.ts:58`      |
| **data-manager/v1** | Materialized views + operations pattern           | `atoms/index.ts:2` |
| **editor/v3**       | Submodules + explicit adapters                    | `index.ts:488`     |

---

## How to Extend This Directory

### Adding New Architecture Documents

1. **Determine category**: Strategy, System Map, Migration Guide, or Decision Record
2. **Name clearly**: Use `[PREFIX]_NAME.md` convention
   - `REORG_SYSTEM_MIGRATION.md` for system-specific guides
   - `DECISION_FOO_BAR.md` for architectural decisions
3. **Update INDEX.md**: Add row with status
4. **Follow template**: Include context, problem, solution, status

### Updating Existing Documents

When modifying an existing doc:

1. **Update "Last Updated"** in document header
2. **Mark status changes**: 📋 → 🚧 → ✅
3. **Update INDEX.md**: Reflect new status
4. **Cross-reference**: Update any related docs that link here

---

## Agent Workflow: Architecture Tasks

### When Assigned Architecture Work

1. **Read context**: Check AGENTS.md, INDEX.md, and relevant system docs
2. **Identify system**: Locate target system in `src/lib/`
3. **Follow pattern**: Apply canonical system skeleton
4. **Respect boundaries**: Use wire modules for cross-system integration
5. **Update docs**: Document decisions, update INDEX.md

### Research Phase

If you need to research current state:

1. **Scan systems**: `find src/lib -maxdepth 1 -type d | sort`
2. **Check patterns**: Look for atoms/services/hooks consistency
3. **Find dependencies**: Use `rg "from.*@/.*" src/lib --type ts`
4. **Cross-reference**: Check `.edin/`, `src-ava/docs/`, `AGENTS.*.md` for related context

---

## Common Anti-Patterns to Avoid

### ❌ Direct Imports Across Systems

```typescript
// WRONG
import { SomeService } from '@/lib/data-manager/v1/services/SomeService';

// CORRECT
import { SomeService } from '@/lib/data-manager'; // via index.ts
```

### ❌ React Inside Services

Services in `services/` should NOT import React:

```typescript
// FORBIDDEN
import * as React from 'react'
export class MyService extends Effect.Service<...>()({
  effect: Effect.gen(() => {
    return { render: () => <div>Hi</div> } // ❌ React in service!
  })
})
```

### ❌ Version Coexistence Without Clear Guidance

If you find `v1/`, `v2/`, `v3/` parallel:

- Check if there's a README explaining which to use
- If not, document the state before making changes

### ❌ Wire Module Bypass

Don't create direct integrations when wire modules exist:

```typescript
// WRONG - bypasses wire
import { AvaClient } from '@/lib/ava/v2'; // Direct in MapBlock

// CORRECT - use wire
import { useAvaMapData } from '@/lib/editor/v3/extensions/blocks/MapBlock/wire/ava-adapter';
```

---

## Glossary

| Term                               | Definition                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation Layer** (`_core/`)    | Effect primitives, schema helpers, runtime utilities. No dependencies on other TMNL systems.                                           |
| **Capabilities** (`capabilities/`) | Cross-cutting features (commands, hotkeys, layers, telemetry, overlays). Depend on `_core/`, serve `features/`.                        |
| **Features** (`features/`)         | User-facing product domains (terminal, editor, AVA, data-grid). Depend on `_core/` + capabilities.                                     |
| **Canonical System Skeleton**      | Standard structure for every system: README, schemas, services, atoms (runtime/state/ops), hooks, components, wire, internal, index.ts |
| **Wire Module**                    | Explicit adapter layer for cross-system integration. Owned by one system, adapts another.                                              |
| **Facade**                         | Stable public API that wraps versioned implementations, guiding usage to canonical version.                                            |
| **Directional Imports**            | Import rule: features may import capabilities, capabilities NEVER import features. Prevents circular dependencies.                     |
| **Atom-as-State**                  | Doctrine: Atoms ARE state, not Effect.Ref bridges. Services mutate atoms via `ctx.set()`, React subscribes via `useAtomValue()`.       |

---

## References

### Internal Documentation

- [INDEX.md](./INDEX.md) - Master index of all architecture documents
- [REORG_STRATEGY.md](./REORG_STRATEGY.md) - Complete reorganization plan
- `.edin/README.md` - EDIN cycle tracking (Experiment → Design → Implement → Negotiate)

### System-Specific Documentation

- `src-ava/docs/` - AVA system architecture
- `.edin/EFFECT_PATTERNS.md` - Effect-atom integration patterns
- `.edin/EFFECT_SERVICE_PATTERNS.md` - Effect service patterns
- `AGENTS.commands.md` - Command system guide
- `AGENTS.data-manager.md` - Data manager architecture

### External References

- [Effect-TS Documentation](https://effect.website/docs)
- [effect-atom Repository](https://github.com/tim-smart/effect-atom)
- [DeepWiki](https://deepwiki.com) - Codebase search and Q&A

---

_Last Updated: 2026-01-14_
_For questions about this directory or TMNL architecture, consult Val (the architectural conscience)._
