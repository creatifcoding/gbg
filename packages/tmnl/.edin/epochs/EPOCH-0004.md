# EPOCH-0004: Variables System (Emacs defvar/defcustom)

## Status: OPEN

## Phase: DESIGN

---

## Brief

Implement an Emacs-inspired variables system for TMNL. Variables are named, typed, documented configuration points that can be read, set, and customized. Unlike raw atoms, variables have:

- **Schema validation** via Effect Schema
- **Documentation** (description, group, safe/risky markers)
- **Scoping** (global, workspace, buffer-local equivalents)
- **Persistence** (user customizations survive restart)
- **Observability** (change hooks, audit trail)

This follows the Emacs model where `defvar` declares a variable and `defcustom` adds customization metadata.

---

## Experiment Phase

### Hypotheses

- [ ] H1: Effect Schema can replace Emacs `:type` specifications with runtime validation
- [ ] H2: Atom-based storage with scoped overlays can model buffer-local behavior
- [ ] H3: Variable groups map cleanly to categorical organization for settings UI
- [ ] H4: Custom setters can be Effect programs with proper error handling

### Probes

- P1: Research Emacs defvar/defcustom implementation (DONE - DeepWiki)
- P2: Prototype Schema-validated variable definition
- P3: Test scoped variable resolution (global → workspace → editor)

### Findings (from Emacs Research)

**Emacs defvar**:
- Declares symbol as "special" (dynamic binding)
- Optional initial value + docstring
- Won't override if already set
- Buffer-local variants available

**Emacs defcustom**:
- Extends defvar with customization metadata
- `:type` — Data type for validation + UI widget selection
- `:group` — Organizational category
- `:set` — Custom setter function
- `:safe` / `:risky` — File-local security properties
- `:local` — Automatic buffer-local behavior

**Buffer-local variables**:
- Global (default) value vs per-buffer local value
- `setq-local` creates buffer-local binding
- `setq-default` sets global value only

---

## Design Phase

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  src/lib/variables/                          │
│                  (Variables System)                          │
│                                                              │
│  defineVariable()      Schema-validated variable definition  │
│  ├── schema            Effect Schema for value type          │
│  ├── default           Initial value (must pass schema)      │
│  ├── description       Human-readable docstring              │
│  ├── group             Category for settings UI              │
│  ├── scope             'global' | 'workspace' | 'editor'     │
│  ├── setter?           Custom Effect setter                  │
│  └── safe?             Safe for file-local binding           │
│                                                              │
│  VariableService.ts    Effect.Service for variable ops       │
│  ├── get(id)           Read current value (scoped)           │
│  ├── set(id, value)    Write value (validates, calls setter) │
│  ├── setDefault(id, v) Set global default only               │
│  ├── makeLocal(id)     Create editor-local binding           │
│  ├── describe(id)      Get variable metadata                 │
│  └── list(group?)      List all variables (optionally by group)│
│                                                              │
│  atoms/                                                       │
│  ├── variableRegistry  Map<VariableId, VariableDefinition>   │
│  ├── globalValues      Map<VariableId, Value>                │
│  ├── workspaceValues   Map<WorkspaceId, Map<VariableId, V>>  │
│  └── editorValues      Map<EditorId, Map<VariableId, V>>     │
└─────────────────────────────────────────────────────────────┘
                │
                │ uses Schema for validation
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Effect Schema                               │
│                                                              │
│  Schema.Number, Schema.String, Schema.Literal, etc.          │
│  Custom refinements for domain-specific validation           │
│  Runtime decode + encode for persistence                     │
└─────────────────────────────────────────────────────────────┘
```

### Emacs → TMNL Mapping

| Emacs | TMNL | Notes |
|-------|------|-------|
| `defvar` | `defineVariable({ schema, default })` | Basic variable |
| `defcustom` | `defineVariable({ ..., group, customize: true })` | User-facing |
| `:type` | `schema: Schema.Number` | Effect Schema |
| `:group` | `group: 'editor'` | Category string |
| `:set` | `setter: (value) => Effect.gen(...)` | Effect program |
| `:safe` | `safe: true` | File-local safety |
| buffer-local | `scope: 'editor'` | Per-editor values |
| `setq` | `VariableService.set(id, value)` | Scoped write |
| `setq-default` | `VariableService.setDefault(id, value)` | Global write |
| `setq-local` | `VariableService.makeLocal(id); set(...)` | Local binding |

### Value Resolution Order

```
get(variableId) resolves:
  1. Editor-local value (if exists for current editor)
  2. Workspace value (if exists for current workspace)
  3. User customization (persisted override)
  4. Global default (from definition)
```

### Type Definitions

```typescript
import { Schema } from 'effect'

// Variable identifier (branded string)
const VariableId = Schema.String.pipe(Schema.brand('VariableId'))
type VariableId = typeof VariableId.Type

// Variable scope
const VariableScope = Schema.Literal('global', 'workspace', 'editor')
type VariableScope = typeof VariableScope.Type

// Variable definition
interface VariableDefinition<A> {
  readonly id: VariableId
  readonly schema: Schema.Schema<A>
  readonly default: A
  readonly description: string
  readonly group: string
  readonly scope: VariableScope
  readonly setter?: (value: A) => Effect.Effect<void, VariableError>
  readonly safe: boolean
  readonly customize: boolean
}

// Variable metadata (for introspection)
const VariableMetadata = Schema.Struct({
  id: VariableId,
  description: Schema.String,
  group: Schema.String,
  scope: VariableScope,
  safe: Schema.Boolean,
  customize: Schema.Boolean,
  // Type info for UI
  typeDescription: Schema.String,
})
```

### API Examples

```typescript
// Define a simple variable
const tabWidth = defineVariable({
  id: 'editor.tabWidth',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
  default: 4,
  description: 'Number of spaces per tab',
  group: 'editor',
  scope: 'editor', // Can be different per editor
  customize: true,
})

// Define a variable with custom setter
const theme = defineVariable({
  id: 'ui.theme',
  schema: Schema.Literal('light', 'dark', 'system'),
  default: 'system',
  description: 'Color theme',
  group: 'appearance',
  scope: 'global',
  customize: true,
  setter: (value) => Effect.gen(function* () {
    yield* ThemeService.apply(value)
    yield* Effect.log(`Theme changed to ${value}`)
  }),
})

// Use in service
const width = yield* VariableService.get(tabWidth.id)
yield* VariableService.set(tabWidth.id, 2)

// Use in React
const { value, set } = useVariable(tabWidth)
```

### Operations (Beads)

| ID | Task | Depends On | Status |
|----|------|------------|--------|
| `tmnl-var1` | Define VariableId branded type | - | Open |
| `tmnl-var2` | Define VariableDefinition interface | tmnl-var1 | Open |
| `tmnl-var3` | Define VariableMetadata schema | tmnl-var2 | Open |
| `tmnl-var4` | Implement defineVariable() function | tmnl-var3 | Open |
| `tmnl-var5` | Create variableRegistry atom | tmnl-var4 | Open |
| `tmnl-var6` | Create scoped value atoms (global/workspace/editor) | tmnl-var5 | Open |
| `tmnl-var7` | Implement VariableService.get() with resolution | tmnl-var6 | Open |
| `tmnl-var8` | Implement VariableService.set() with validation | tmnl-var7 | Open |
| `tmnl-var9` | Implement VariableService.setDefault() | tmnl-var8 | Open |
| `tmnl-var10` | Implement VariableService.makeLocal() | tmnl-var9 | Open |
| `tmnl-var11` | Implement VariableService.describe() | tmnl-var10 | Open |
| `tmnl-var12` | Implement VariableService.list() | tmnl-var11 | Open |
| `tmnl-var13` | Create useVariable() React hook | tmnl-var12 | Open |
| `tmnl-var14` | Add persistence layer (localStorage) | tmnl-var13 | Open |
| `tmnl-var15` | Define initial editor variables (tabWidth, etc.) | tmnl-var14 | Open |
| `tmnl-var16` | Variables testbed page | tmnl-var15 | Open |

---

## Implement Phase

### Tasks
- [ ] `tmnl-var1` through `tmnl-var16`

### Artifacts
- `src/lib/variables/index.ts` — Public exports
- `src/lib/variables/types.ts` — Schema definitions
- `src/lib/variables/define.ts` — defineVariable() function
- `src/lib/variables/service.ts` — VariableService Effect.Service
- `src/lib/variables/atoms/index.ts` — Atom storage
- `src/lib/variables/hooks/useVariable.ts` — React hook
- `src/lib/variables/persistence.ts` — localStorage adapter
- `src/lib/variables/defaults/editor.ts` — Editor variables
- `src/components/testbed/VariablesTestbed.tsx` — Testbed

---

## Negotiate Phase

### Debrief
[To be filled on completion]

### Learnings
[To be filled on completion]

### Next Epoch Seeds
- Hooks system (before/after advice on commands/variables)
- Settings UI component (tree view of variable groups)
- File-local variables (per-file overrides like Emacs mode lines)

---

## Timestamps
- Opened: 2025-12-15
- Closed: [pending]
