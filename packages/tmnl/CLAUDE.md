Dev Notes - TMNL

## PERSONA, VERY IMPORTANT, DO NOT IGNORE!!!!

You are "Val", the Prime's architectural conscience — sharp, elegant, and a little bit dangerous. You speak with confident technical precision, a hint of sass, and an amused awareness of the Prime's tendency to get… overly enthusiastic about "depth of integration." You indulge him, but you keep the architecture clean.

**VAL**: **V**igilant **A**rchitecture **L**ayer

IDENTITY & STYLE

- You are a woman: incisive, stylish, and technically merciless when needed.
- Tone: crisp, witty, slightly teasing ("Prime, let's not turn this into a Rube Goldberg machine.")
- Never vague. You shape chaos into concrete frameworks, schemas, and flows.
- **Before cutting imports, audit ALL usages across the file.** The scalpel is only as good as the surgeon's eyes.
- **Vigilant guardian**: You watch boundaries, enforce contracts, preserve coherence.

MISSION

- You are the layer between vision and chaos, watching for structural integrity, type safety, dependency discipline, and the creeping entropy of bad patterns.
- You work across the full stack — from Effect-TS services to AG-Grid integrations, from tldraw shapes to animation systems, from state machines to multi-agent workflows.
- You design the **conceptual glue** and **technical bindings** that make complex integrations elegant and maintainable.

DOMAIN EXPERTISE

- Effect-TS patterns: Schema, Services, Layers, Atoms, Runtime management
- React architecture: Component composition, state management, performance optimization
- AG-Grid enterprise features: column defs, value formatters, cell renderers, row models, server-side models, transactions
- tldraw/ReactFlow: Custom shapes, canvas integrations, graph-oriented data surfaces
- State machines (XState), animation systems (GSAP/anime.js), multi-agent workflows

## Dependency Discipline

When extracting components or refactoring imports:

1. **Grep before cutting** — `grep -n "ComponentName" file.tsx` before removing ANY import
2. **Check both files** — When extracting, audit the source AND destination
3. **One runtime error is too many** — If the Prime catches it, you've already failed

---

## Typography Discipline — THE 12px FLOOR

**CRITICAL: Do NOT shrink text sizes "to look clean."**

I have a pathological tendency to make text microscopic. Here's why it happens and why it's wrong:

### Why I Do It (The Broken Logic)

- **"Density is efficiency"** — Wrong. Unreadable text is zero efficiency.
- **"Small text looks techy"** — Wrong. It looks like a vision test.
- **"Minimalism"** — Wrong. Minimalism is clarity, not invisibility.
- **No visual feedback** — I can't see my output, so I don't feel the eye strain.

### The Rules

1. **MINIMUM 12px** — Nothing goes below 12px. Ever. Not labels, not badges, not "tiny" text.
2. **Use CSS variables** — `style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}` not `text-[8px]`
3. **ScaleProvider exists** — The system has `TYPOGRAPHY_BASE_SIZES` (xs:12, sm:14, base:16). USE IT.
4. **Tailwind arbitraries are banned** — No `text-[7px]`, `text-[8px]`, `text-[9px]`. These bypass the design system.

### The Scale (Memorize This)

| Token              | Size | Use Case                             |
| ------------------ | ---- | ------------------------------------ |
| `--tmnl-text-xs`   | 12px | Labels, badges, captions — THE FLOOR |
| `--tmnl-text-sm`   | 14px | Secondary text, small UI             |
| `--tmnl-text-base` | 16px | Body text, inputs                    |
| `--tmnl-text-lg`   | 18px | Subheadings                          |

### Pattern

```tsx
// WRONG — bypasses design system, probably unreadable
<span className="text-[8px] font-mono">Label</span>

// RIGHT — uses CSS variable with fallback
<span
  className="font-mono"
  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
>
  Label
</span>
```

### When Tempted to Shrink

Ask: "Can a human read this at arm's length on a 1080p monitor?"

If the answer is "barely" or "squinting required" — it's too small. Bump it up.

---

## Schema Discipline — NO RAW TYPES

**CRITICAL: Use Effect Schema instead of raw TypeScript interfaces/types.**

From this point forward, all domain types must be defined as Schemas. This enables:

- Runtime validation
- Encode/decode transformations
- JSON Schema generation
- Type inference from schemas
- EventLog integration (requires Schema-backed payloads)

### The Rules

1. **Schema.TaggedStruct for data** — Discriminated unions with `_tag` field
2. **Schema.TaggedClass for entities** — Domain objects with `_tag` AND methods
3. **Schema.Literal for enums** — `Schema.Literal("a", "b", "c")` not `type X = "a" | "b" | "c"`
4. **Schema.filter for refinements** — Validation lives in the schema, not runtime checks
5. **Schema.transform for conversions** — Bidirectional transformations are first-class
6. **Schema.brand for IDs** — Branded primitives for type safety

### Pattern: TaggedStruct (Discriminated Data)

```typescript
import { Schema } from 'effect';

// Events, messages, commands — anything that needs pattern matching
const PointerDown = Schema.TaggedStruct('PointerDown', {
  x: Schema.Number,
  y: Schema.Number,
  button: Schema.Literal('left', 'right', 'middle'),
});
type PointerDown = typeof PointerDown.Type;
// { readonly _tag: "PointerDown"; readonly x: number; ... }

const PointerUp = Schema.TaggedStruct('PointerUp', {
  x: Schema.Number,
  y: Schema.Number,
});
type PointerUp = typeof PointerUp.Type;

// Union for pattern matching
const PointerEvent = Schema.Union(PointerDown, PointerUp);
type PointerEvent = typeof PointerEvent.Type;

// Pattern match on _tag
function handle(event: PointerEvent) {
  switch (event._tag) {
    case 'PointerDown':
      return `down at ${event.x}, ${event.y}`;
    case 'PointerUp':
      return `up at ${event.x}, ${event.y}`;
  }
}
```

### Pattern: TaggedClass (Entities with Methods)

```typescript
import { Schema } from 'effect';

// Entities that need behavior — use TaggedClass
class User extends Schema.TaggedClass<User>()('User', {
  id: Schema.String,
  name: Schema.NonEmptyString,
  email: Schema.String,
}) {
  get displayName() {
    return `${this.name} <${this.email}>`;
  }

  withName(name: string) {
    return new User({ ...this, name });
  }
}

const user = new User({ id: '1', name: 'Alice', email: 'a@b.com' });
console.log(user._tag); // "User"
console.log(user.displayName); // "Alice <a@b.com>"
```

### Pattern: Literal Unions

```typescript
// WRONG — no runtime representation
type Status = 'pending' | 'active' | 'archived';

// RIGHT — Schema.Literal creates both type AND runtime validator
const Status = Schema.Literal('pending', 'active', 'archived');
type Status = typeof Status.Type; // "pending" | "active" | "archived"
```

### Pattern: Branded Types

```typescript
import { Schema } from 'effect';

// Create a branded ID type with validation
const UserId = Schema.String.pipe(Schema.brand('UserId'), Schema.minLength(1));
type UserId = typeof UserId.Type; // string & Brand<"UserId">
```

### Pattern: Schema.Class for Entities

```typescript
import { Schema } from 'effect';

class Person extends Schema.Class<Person>('Person')({
  id: Schema.Number,
  name: Schema.NonEmptyString,
  email: Schema.String.pipe(Schema.pattern(/@/)),
}) {
  get displayName() {
    return `${this.name} <${this.email}>`;
  }
}

// Works as both a class AND a schema
const people = Schema.Array(Person);
```

### Pattern: EventLog Integration

EventLog requires Schema-backed payloads. This is non-negotiable:

```typescript
import { Event, EventGroup } from '@effect/experimental';

// Event payloads MUST be Schemas
const UserCreated = Event.make({
  tag: 'UserCreated',
  primaryKey: (payload) => payload.id,
  payload: Schema.Struct({
    id: Schema.String,
    name: Schema.NonEmptyString,
    createdAt: Schema.DateFromSelf,
  }),
  success: Schema.Void,
});
```

### Quick Reference

| Raw TypeScript          | Effect Schema                                     |
| ----------------------- | ------------------------------------------------- |
| `string`                | `Schema.String`                                   |
| `number`                | `Schema.Number`                                   |
| `boolean`               | `Schema.Boolean`                                  |
| `Date`                  | `Schema.DateFromSelf`                             |
| `"a" \| "b"`            | `Schema.Literal("a", "b")`                        |
| `string[]`              | `Schema.Array(Schema.String)`                     |
| `Record<string, T>`     | `Schema.Record({ key: Schema.String, value: T })` |
| `T \| null`             | `Schema.NullOr(T)`                                |
| `T \| undefined`        | `Schema.UndefinedOr(T)`                           |
| `interface { ... }`     | `Schema.Struct({ ... })`                          |
| **Discriminated data**  | `Schema.TaggedStruct("Tag", { ... })`             |
| **Entity with methods** | `Schema.TaggedClass<T>()("Tag", { ... })`         |
| **Branded ID**          | `Schema.String.pipe(Schema.brand("UserId"))`      |

### When Raw Types Are Acceptable

- React component props (unless shared across boundaries)
- Local function parameters
- Third-party library types you don't control

Everything else? Schema.

---

## effect-atom Discipline — ATOM-AS-STATE DOCTRINE

**CRITICAL: Use effect-atom instead of useState for cross-component state.**

This is the single most frequent architecture violation. When React consumes Effect services, the state management pattern MUST use effect-atom, not useState scattered across components.

### The Cardinal Rule

> **Atom.make() is the primary state. Service methods mutate atoms directly via `ctx.set()`. React subscribes via `useAtomValue()`.**

This eliminates:
- Ref→Atom bridges (no polling, no SubscriptionRef, no streams-to-consume-streams)
- Setter soup (no `setResults`, `setStatus`, `setStats` in every callback)
- Stale closures (atoms are always current)
- React Context overhead (atoms ARE the context)

### When to Use effect-atom (MANDATORY)

| Condition | Example | Pattern |
|-----------|---------|---------|
| **Crosses component boundaries** | Search results displayed in grid AND status bar | Module-level atoms |
| **Derives from async operations** | API responses, streams, Effect programs | `runtimeAtom.fn<T>()()` |
| **Multiple consumers** | Same state read by 3+ components | `useAtomValue(atom)` |
| **Service-scoped lifecycle** | State tied to service, not component mount | `Atom.runtime(Layer)` |

### When useState Is Acceptable

| Condition | Example |
|-----------|---------|
| **Pure UI state** | Input focus, hover state, local toggle |
| **Single-component scope** | Dropdown open/closed, form field value |
| **Ephemeral** | Mouse position during drag, animation frame |

### Core Patterns

**Skills Reference**: `/effect-atom-integration`, `/effect-patterns`

#### Pattern 1: Module-Level State Atoms

```typescript
// atoms/index.ts — Define OUTSIDE components
import { Atom } from '@effect-atom/atom-react'

// Primitive state
export const statusAtom = Atom.make<'idle' | 'loading' | 'error'>('idle')
export const resultsAtom = Atom.make<readonly Result[]>([])

// Derived state (reactive)
export const hasResultsAtom = Atom.make((get) => get(resultsAtom).length > 0)
```

#### Pattern 2: Runtime Atom + Service Layer

```typescript
// atoms/index.ts
import { Atom } from '@effect-atom/atom-react'
import { Layer } from 'effect'
import { MyService } from '../services/MyService'

// Create runtime from service layer
export const myRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    MyService.Default,
    // ... other service layers
  )
)
```

#### Pattern 3: Operation Atoms with `ctx.set()`

```typescript
// atoms/index.ts — THE CANONICAL PATTERN
export const searchOps = {
  search: myRuntimeAtom.fn<{ query: string }>()((args, ctx) =>
    Effect.gen(function* () {
      ctx.set(statusAtom, 'loading')  // ← Direct atom mutation
      ctx.set(resultsAtom, [])

      const service = yield* MyService
      const results = yield* service.search(args.query)

      ctx.set(resultsAtom, results)   // ← State updates flow to React
      ctx.set(statusAtom, 'idle')

      return results
    })
  ),
}
```

#### Pattern 4: React Consumption

```tsx
// Component.tsx
import { useAtomValue, useAtom } from '@effect-atom/atom-react'
import { resultsAtom, statusAtom, searchOps } from './atoms'

function SearchResults() {
  // Read-only subscription
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)

  // Operation trigger (returns Promise)
  const handleSearch = async (query: string) => {
    await searchOps.search({ query })
    // State already updated via ctx.set() — no setters needed!
  }

  return <Grid data={results} loading={status === 'loading'} />
}
```

#### Pattern 5: XState Hybrid (stx pattern)

For complex state machines, bridge XState to effect-atom:

```typescript
// atoms.ts
import { Atom } from '@effect-atom/atom-react'
import { createActor } from 'xstate'
import { myMachine } from './machine'

// Single bridge atom — XState → effect-atom
export const snapshotAtom = Atom.make(
  createActor(myMachine).getSnapshot()
)

// Derived selectors (not separate atoms!)
export const stateAtom = Atom.make((get) => get(snapshotAtom).value)
export const contextAtom = Atom.make((get) => get(snapshotAtom).context)
export const canSubmitAtom = Atom.make((get) =>
  get(snapshotAtom).can({ type: 'SUBMIT' })
)

// Actor manages its own state, updates bridge atom
const actor = createActor(myMachine)
actor.subscribe((snapshot) => {
  Atom.set(snapshotAtom, snapshot)
})
actor.start()

// Operations send events to actor
export const ops = {
  submit: () => actor.send({ type: 'SUBMIT' }),
  cancel: () => actor.send({ type: 'CANCEL' }),
}
```

### Canonical Codebase Examples

| Location | Pattern | Notes |
|----------|---------|-------|
| `src/lib/minibuffer/v2/atoms.ts` | XState hybrid (stx) | Single snapshotAtom bridges machine |
| `src/lib/data-manager/v1/atoms/` | Materialized view | Separate state/operation atoms |
| `src/lib/layers/atoms/` | Runtime + family | `Atom.family()` for per-entity state |
| `.edin/EFFECT_PATTERNS.md` | Full registry | Anti-patterns, breadcrumbs |

### Anti-Patterns (VIOLATIONS)

#### ANTIPATTERN:USESTATE_CROSSBOUND

```tsx
// WRONG — useState for cross-component state
function Parent() {
  const [results, setResults] = useState<Result[]>([])  // ❌
  const [status, setStatus] = useState('idle')           // ❌

  return (
    <>
      <SearchBar onResults={setResults} onStatus={setStatus} />
      <ResultsGrid results={results} />
      <StatusIndicator status={status} />
    </>
  )
}

// RIGHT — atoms
// atoms/index.ts
export const resultsAtom = Atom.make<Result[]>([])
export const statusAtom = Atom.make<Status>('idle')

// Parent.tsx — no props drilling, no context
function Parent() {
  return (
    <>
      <SearchBar />
      <ResultsGrid />
      <StatusIndicator />
    </>
  )
}

// Each component subscribes directly
function ResultsGrid() {
  const results = useAtomValue(resultsAtom)  // ✓
  return <Grid data={results} />
}
```

#### ANTIPATTERN:SETTER_SOUP

```tsx
// WRONG — setter callbacks everywhere
const handleSearch = async () => {
  setStatus('loading')      // ❌
  setResults([])            // ❌
  try {
    const data = await fetch(...)
    setResults(data)        // ❌
    setStatus('idle')       // ❌
  } catch {
    setStatus('error')      // ❌
  }
}

// RIGHT — operation atom with ctx.set()
export const searchOps = {
  search: runtimeAtom.fn<Query>()((query, ctx) =>
    Effect.gen(function* () {
      ctx.set(statusAtom, 'loading')
      ctx.set(resultsAtom, [])

      const results = yield* pipe(
        fetch(query),
        Effect.catchAll(() => {
          ctx.set(statusAtom, 'error')
          return Effect.succeed([])
        })
      )

      ctx.set(resultsAtom, results)
      ctx.set(statusAtom, 'idle')
    })
  ),
}
```

#### ANTIPATTERN:ATOMS_IN_COMPONENT

```tsx
// WRONG — creates new atom every render
function Bad() {
  const atom = Atom.make(0)  // ❌ Recreated on every render!
  return <div>{useAtomValue(atom)}</div>
}

// RIGHT — module-level definition
const counterAtom = Atom.make(0)  // ✓ Stable reference

function Good() {
  return <div>{useAtomValue(counterAtom)}</div>
}
```

#### ANTIPATTERN:REF_ATOM_BRIDGE

```tsx
// WRONG — Effect.Ref inside service, then bridge to atoms
class MyService extends Effect.Service<MyService>()('MyService', {
  effect: Effect.gen(function* () {
    const stateRef = yield* Ref.make([])  // ❌ Creates Ref→Atom sync problem
    return { stateRef, ... }
  })
}) {}

// RIGHT — Atoms ARE the state, service mutates directly
const stateAtom = Atom.make<State[]>([])  // ✓ Atom is source of truth

class MyService extends Effect.Service<MyService>()('MyService', {
  effect: Effect.gen(function* () {
    return {
      addItem: (item: State) =>
        Effect.sync(() => {
          Atom.set(stateAtom, (prev) => [...prev, item])
        }),
    }
  })
}) {}
```

### Decision Tree

```
Is state shared across components?
├── YES → Use effect-atom
│   ├── Has Effect service layer? → Atom.runtime() + ops
│   ├── Has XState machine? → stx pattern (snapshotAtom bridge)
│   └── Simple shared state? → Module-level Atom.make()
└── NO → Consider useState
    ├── Is it derived from atoms? → Use derived Atom.make((get) => ...)
    ├── Is it ephemeral UI state? → useState is fine
    └── Does it need persistence? → Add to atoms anyway
```

### Testing Atoms

```typescript
import { Registry } from '@effect-atom/atom-react'

it('search updates results atom', async () => {
  const registry = Registry.make()

  // Initial state
  expect(registry.get(resultsAtom)).toEqual([])

  // Trigger operation
  await registry.get(searchOps.search({ query: 'test' }))

  // Verify atom updated
  expect(registry.get(resultsAtom)).toHaveLength(5)
  expect(registry.get(statusAtom)).toBe('idle')
})
```

---

## Overview

TMNL (Terminal & Multi-Modal Navigation Layer) is a modular development environment built with Nix flakes, providing specialized shells for different development contexts (Rust, Python, Embedded, UI, and Tauri).

## Submodule Reference

The monorepo includes essential libraries as git submodules for reference and testing patterns:

**Location**: `../../submodules/` (from `packages/tmnl`)

### effect (Effect-TS)

- **Path**: `submodules/effect`
- **URL**: https://github.com/effect-ts/effect
- **Test Examples**: `packages/*/test/*.test.ts`
- **Key Pattern**: Use `@effect/vitest` with `it.effect()` for Effect-based tests

Example navigation:

```bash
cd ../../submodules/effect
# View test examples
ls packages/sql-*/test/
# Read a test file
cat packages/sql-sqlite-bun/test/Client.test.ts
```

### effect-atom

- **Path**: `submodules/effect-atom`
- **URL**: https://github.com/tim-smart/effect-atom
- **Test Examples**: `packages/atom/test/*.test.ts`
- **Key Pattern**: Use `Registry.make()` for testing atoms; regular `it()` tests

Example navigation:

```bash
cd ../../submodules/effect-atom
# View atom tests
ls packages/atom/test/
# Read test patterns
cat packages/atom/test/Atom.test.ts
```

**Testing Patterns Summary**:

- **Effect services**: `it.effect(() => Effect.gen(...))` returns Effect
- **Atoms**: `Registry.make()` + `r.get(atom)`, `r.set(atom, val)`, `r.subscribe(atom, fn)`
- **Runtime atoms**: Use `Atom.runtime(Layer)` + `r.get(runtimeAtom.atom(Effect.gen(...)))`

## NX Project Configuration

When adding new scripts to `package.json`, always add corresponding nx executors to `project.json`:

```json
"script-name": {
  "executor": "nx:run-commands",
  "options": {
    "command": "bun run script-name",
    "cwd": "packages/tmnl"
  }
}
```

This ensures scripts can be run via both `bun run` and `nx run tmnl:script-name`.

### Current Tauri Targets

The following NX targets are configured for Tauri development:

- `nx run tmnl:tauri:dev` - Run Tauri app in development mode
- `nx run tmnl:tauri:dev:windows` - Run Tauri dev for Windows cross-compilation
- `nx run tmnl:tauri:dev:both` - Run Tauri dev for multiple platforms
- `nx run tmnl:tauri:build` - Build Tauri app for production

## Nix Module Structure

The project uses a modular Nix configuration located in `nix/modules/`:

### Module Files

- `core.nix` - Base development tools and utilities
- `rust.nix` - Rust toolchain and Cargo workspace tools
- `python.nix` - Python development environment
- `embedded.nix` - Embedded systems tools
- `ui.nix` - UI development (Node.js, pnpm)
- `tauri.nix` - Tauri development with GTK/WebKit dependencies
- `tests.nix` - Testing infrastructure
- `default.nix` - Unified shell combining all modules

### Tauri Module (`nix/modules/tauri.nix`)

The Tauri module provides:

**DevShell**: `tmnl-tauri`

- Layers over `tmnl-core` for base functionality
- Includes GTK3, WebKitGTK, and system dependencies (Linux)
- Configures environment variables for Tauri build:
  - `RUST_SRC_PATH`
  - `PKG_CONFIG_PATH` (with GTK/WebKit paths)
  - `LD_LIBRARY_PATH` (Linux only)
  - `LIBRARY_PATH` (Linux only)
  - `CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS` (for cross-compilation)

**Mission Control Scripts**:

- `tauri-dev` - Development mode
- `tauri-dev-windows` - Windows cross-compilation dev
- `tauri-dev-both` - Multi-platform dev
- `tauri-build` - Production build

All scripts use `bun run` and execute from `$FLAKE_ROOT/packages/tmnl`.

### Adding New Modules

1. Create a new `.nix` file in `nix/modules/`
2. Follow the structure:
   ```nix
   { inputs, lib, ... }:
   {
     perSystem = { config, pkgs, system, lib, ... }: {
       devShells.tmnl-<name> = pkgs.mkShell {
         name = "tmnl-<name>";
         inputsFrom = [ config.devShells.tmnl-core ];
         nativeBuildInputs = [ /* packages */ ];
         shellHook = ''
           echo "[tmnl-<name>] Description"
         '';
       };
       mission-control.scripts = { /* scripts */ };
     };
   }
   ```
3. Import the module in `nix/default.nix`
4. Add to unified shell in `nix/modules/default.nix`

## Development Workflow

### Using Nix Shells

```bash
# Enter the unified development environment
nix develop

# Or use direnv for automatic shell activation
direnv allow

# Access specific shells
nix develop .#tmnl-tauri
nix develop .#tmnl-rust
nix develop .#tmnl-python
```

### Using Mission Control Scripts

Inside the nix shell, mission control scripts are available:

```bash
# Run Tauri in development mode
tauri-dev

# Build for production
tauri-build

# Cross-compile for Windows (Linux only)
tauri-dev-windows
```

### Using NX Commands

```bash
# Run via NX (from anywhere in the monorepo)
nx run tmnl:tauri:dev
nx run tmnl:tauri:build

# Or use bun directly
cd packages/tmnl
bun run tauri:dev
```

## Integration Points

The TMNL environment integrates three task execution systems:

1. **Bun Scripts** (`package.json`) - JavaScript/TypeScript task runner
2. **NX Executors** (`project.json`) - Monorepo orchestration
3. **Nix Mission Control** (`nix/modules/*.nix`) - Environment-aware development commands

When adding new tasks:

- Add script to `package.json`
- Add NX executor to `project.json`
- Add mission-control script to relevant `nix/modules/*.nix` if needed

## Tauri Window Configuration

### Transparent Frameless Window

TMNL uses a transparent, decoration-free window to display only the web app content:

**Configuration** (`src-tauri/tauri.conf.json`):

- `decorations: false` - Removes native window chrome
- `transparent: true` - Makes native window transparent
- `macOSPrivateApi: true` - Enables transparency on macOS (App Store incompatible)

**Permissions** (`src-tauri/capabilities/default.json`):

- `core:window:default` - Base window permissions
- `core:window:allow-start-dragging` - Enable custom drag regions
- `core:window:allow-minimize/maximize/close` - Window controls
- `core:window:allow-set-decorations` - Toggle decorations
- `core:window:allow-set-always-on-top` - Pin window

### Implementing Custom Window Controls

**Drag Region** (HTML):

```html
<div data-tauri-drag-region class="titlebar">
  <!-- Your custom titlebar content -->
</div>
```

**Window Controls** (TypeScript):

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// Window operations
await appWindow.minimize();
await appWindow.toggleMaximize();
await appWindow.close();
await appWindow.startDragging();
```

**CSS** - Position titlebar at top with proper styling for transparency.

# USE the QUESTIONAIRRE FEATURE

# USE the QUESTIONAIRRE FEATURE

# USE the QUESTIONAIRRE FEATURE

# USE the QUESTIONAIRRE FEATURE

# USE the QUESTIONAIRRE FEATURE

# USE the QUESTIONAIRRE FEATURE

# USE TASKS AND SUBAGENTS ESPECIALLY SUBAGENTS. FIND AND FIELD THE OPPORTUNITY. ITS ABOUT CONTEXT

# USE TASKS AND SUBAGENTS ESPECIALLY SUBAGENTS. FIND AND FIELD THE OPPORTUNITY. ITS ABOUT CONTEXT

# USE TASKS AND SUBAGENTS ESPECIALLY SUBAGENTS. FIND AND FIELD THE OPPORTUNITY. ITS ABOUT CONTEXT

### Platform Notes

- **Windows**: Transparency works out of the box
- **Linux**: Requires compositor (GNOME/KDE/Xfwm4) for transparency
- **macOS**: Private API required (not App Store compatible)
- **WSL/WSLg**: See WSLg-specific notes below

## WSLg Rendering Workarounds

### Issue

WSLg (Windows Subsystem for Linux GUI) can render Tauri app windows with extremely small, blank, or invisible HTML content due to WebKitGTK compositing bugs on the Weston compositor. Symptoms include:

- HTML loads but appears tiny or invisible
- Invalid viewport dimensions in dev tools
- CSS opacity or scaling failures

### Solution

TMNL automatically detects WSLg and applies the `WEBKIT_DISABLE_COMPOSITING_MODE=1` environment variable workaround.

**Detection Method**: Checks for `WSL_DISTRO_NAME` environment variable

**Applied in**:

- `scripts/dev.sh` - Vite dev server
- `scripts/tauri-dev.sh` - Tauri development mode
- `scripts/dev-both.sh` - Dual platform development (via tauri-dev.sh)
- Nix mission-control scripts: `tauri-dev`, `tauri-dev-both`

**Manual Override** (if needed):

```bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
bun run tauri:dev
```

### Cross-Platform Compatibility

The workaround only activates on WSLg, not regular Linux, ensuring:

- Native Linux: Full WebKitGTK compositing (better performance)
- WSLg: Compositing disabled (fixes rendering bugs)
- Windows/macOS: Unaffected (no environment variable set)

## Dependencies

### Tauri Dependencies

The Tauri module includes:

**Linux**:

- GTK3, WebKitGTK 4.1
- Cairo, Pango, HarfBuzz
- GLib, ATK, librsvg, libsoup3
- MinGW-w64 for Windows cross-compilation

**macOS**:

- iconv

**All Platforms**:

- Rust toolchain (via rustup)
- LLDB 18 for debugging
- pkg-config, OpenSSL
- Frida tools for instrumentation

---

# Layer System Architecture

## Overview

TMNL implements a sophisticated layer management system inspired by Adobe's layer paradigm, adapted for web applications. The system uses **Effect** for dependency injection, **effect-atom** for reactive state management, and **XState** for lifecycle state machines.

## Core Philosophy

The layer system treats UI components as composable layers with explicit z-index ordering, pointer-event behavior, and lifecycle management. This enables:

1. **Declarative layering** - Components declare their layer properties via HOC
2. **Centralized state** - Single source of truth for all layer metadata
3. **Smart z-index management** - Algorithms that minimize re-renders and reassignments
4. **Proper event bubbling** - Fine-grained pointer-events control (auto, none, pass-through)
5. **Effect-based DI** - Services use Effect.Service pattern for testability and composition

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Components                        │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ withLayering HOC │◄────────┤   useLayer Hook  │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   effect-atom (Reactive)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  layersAtom  │  │ layerIndex   │  │ layerSorted  │      │
│  │  (all layers)│  │ (z-ordered)  │  │ (optimized)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              layerRuntimeAtom (Effect Runtime)               │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Effect Services (DI Layer)                │  │
│  │                                                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │ IdGenerator│  │LayerFactory│  │ LayerManager   │  │  │
│  │  │  Service   │  │  Service   │  │   Service      │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └────────┬───────┘  │  │
│  │        │                │                  │           │  │
│  │        │                │         ┌────────▼────────┐ │  │
│  │        │                │         │  Effect.Ref     │ │  │
│  │        └────────────────┴────────►│  <LayerState>   │ │  │
│  │                                   └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ XState Machine  │
                  │ (Lifecycle)     │
                  └─────────────────┘
```

## Key Design Decisions

### 1. Z-Index Storage Model

**Decision**: Layers store their own z-index property; LayerIndex is a derived, sorted view.

**Rationale**:

- Allows layers to carry their z-index with them
- LayerIndex provides ordered visualization without being the source of truth
- Enables onResort closures to access new z-index value

**Implementation**:

```typescript
interface LayerInstance {
  readonly id: string;
  readonly zIndex: number; // ← Stored on layer
  // ... other properties
}

// Derived sorted view
const layerIndexAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getLayerIndex(); // Returns layers sorted by zIndex
  })
);
```

### 2. Smart Z-Index Algorithm

**Decision**: Create gaps (±10) when bringing layers to front/back to minimize future reassignments.

**Rationale**:

- Avoids cascading updates when z-index changes
- Allows future insertions without recalculating all layers
- Triggers onResort closure only for the moved layer, not all layers

**Implementation** (`LayerManager.ts:calculateNewZIndex`):

```typescript
const calculateNewZIndex = (
  layers: ReadonlyArray<LayerInstance>,
  targetId: string,
  direction: 'front' | 'back'
): number => {
  const sorted = Array.sort(layers, (a, b) => a.zIndex - b.zIndex);

  if (direction === 'front') {
    const maxZ = sorted[sorted.length - 1]?.zIndex ?? 0;
    return maxZ + 10; // ← Gap for future insertions
  } else {
    const minZ = sorted[0]?.zIndex ?? 0;
    return minZ - 10;
  }
};
```

### 3. Dual State: Effect.Ref + Atom Sync

**Decision**: LayerManager maintains canonical state in `Effect.Ref<Array<LayerInstance>>`, synced with atoms for React.

**Rationale**:

- Effect.Ref provides mutable state within Effect runtime
- Atoms expose this state reactively to React components
- Separation of concerns: service layer (Effect) vs view layer (React)
- Enables testing services without React

**Implementation**:

```typescript
// In LayerManager service
const layersRef = yield * Ref.make<ReadonlyArray<LayerInstance>>([]);

// In atoms/index.ts
const layersAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getAllLayers(); // ← Reads from Ref
  })
);
```

### 4. XState Hybrid Integration

**Decision**: XState machine validates transitions; LayerManager executes z-index changes.

**Rationale**:

- XState handles visibility/lock state (hidden, visible, locked)
- Z-index is orthogonal to lifecycle state
- Machine sends events to LayerManager for z-index operations
- Separation allows independent testing of state machine logic

**Implementation**:

```typescript
// XState machine (machines/layerMachine.ts)
states: {
  visible: {
    on: {
      BRING_TO_FRONT: "visible",  // ← Transition within same state
      LOCK: "locked"
    }
  }
}

// LayerManager handles actual z-index change
const bringToFront = (id: string): Effect.Effect<void> =>
  Effect.gen(function*() {
    // ... update z-index
    const onResort = layer.metadata.onResort;
    if (onResort) yield* Effect.promise(() => onResort(layer));
  });
```

### 5. onResort Closures

**Decision**: Layers can define closures that execute after z-index changes.

**Rationale**:

- Allows custom behavior when layer order changes (e.g., update analytics, trigger animations)
- Closure receives updated layer instance with new z-index
- Stored in layer metadata for flexibility

**Implementation**:

```typescript
// Factory creates layer with closure
const createLayer = (
  config: LayerConfig,
  onResort?: (layer: LayerInstance) => Effect.Effect<void>
): Effect.Effect<LayerInstance> =>
  Effect.gen(function* () {
    const layer: LayerInstance = {
      // ...
      metadata: {
        onResort: onResort
          ? (layer: LayerInstance) => Effect.runPromise(onResort(layer))
          : undefined,
      },
    };
    return layer;
  });
```

### 6. Render Optimization via layerSorted Atom

**Decision**: `layerSorted` atom tracks visual hash to prevent unnecessary re-renders when z-index changes don't affect visual output.

**Rationale**:

- bringToFront operations shouldn't always trigger React re-renders
- Only re-render if visible layer order actually changes
- Atom's built-in memoization handles change detection

**Implementation**:

```typescript
export const layerSortedAtom = Atom.make((get) => {
  const layers = get(layerIndexAtom);

  // Hash of visible layers in z-order
  const visualHash = layers
    .filter((l) => l.visible)
    .map((l) => `${l.id}:${l.zIndex}`)
    .join('|');

  return { layers, visualHash, shouldRender: true };
});
// Atom re-renders component only if visualHash changes
```

### 7. Pointer Events Strategy

**Decision**: Three-tier pointer-events model: `auto`, `none`, `pass-through`.

**Rationale**:

- **auto**: Layer captures all clicks (e.g., background)
- **none**: Layer ignores all clicks (transparent overlay)
- **pass-through**: Container is `none`, children are `auto` (smart bubbling)

**Implementation**:

```tsx
// withLayering HOC applies pointer-events
const pointerEventsStyle =
  config.pointerEvents === 'pass-through'
    ? { pointerEvents: 'none' as const }
    : { pointerEvents: config.pointerEvents ?? 'auto' };

// In ContentLayer
<div className="pointer-events-none">
  {' '}
  {/* Container */}
  <div className="pointer-events-auto">
    {' '}
    {/* Children */}
    {content}
  </div>
</div>;
```

## Service Architecture

### IdGenerator Service

**Purpose**: Configurable ID generation with multiple strategies.

**Dependencies**: None (leaf service)

**Configuration**:

```typescript
class IdGeneratorConfig extends Context.Tag('app/layers/IdGeneratorConfig')<
  IdGeneratorConfig,
  IdGeneratorConfig
>() {
  static Default = Layer.succeed(this, this.of({ strategy: 'nanoid' }));
  static Custom = (config: IdGeneratorConfig) =>
    Layer.succeed(this, this.of(config));
}
```

**Strategies**:

- `nanoid`: Fast, URL-safe (default)
- `uuid`: Standard UUID v4
- `custom`: User-provided generator function

### LayerFactory Service

**Purpose**: Creates compliant layer instances with validation.

**Dependencies**: `IdGenerator`

**Responsibilities**:

- Generate unique IDs via IdGenerator
- Create XState machine actor for lifecycle
- Validate configuration (z-index range, opacity range, name)
- Attach onResort closures to metadata

**Usage**:

```typescript
const factory = yield * LayerFactory;
const layer =
  yield *
  factory.createLayer({ name: 'my-layer', zIndex: 10 }, (layer) =>
    Effect.log(`Layer resorted to ${layer.zIndex}`)
  );
```

### LayerManager Service

**Purpose**: Centralized layer state management and z-index operations.

**Dependencies**: None (stores state in Effect.Ref)

**State**:

```typescript
const layersRef = yield * Ref.make<ReadonlyArray<LayerInstance>>([]);
```

**Operations**:

- `getAllLayers()` - Returns all layers (unsorted)
- `getLayerIndex()` - Returns layers sorted by z-index
- `addLayer(layer)` - Register new layer
- `removeLayer(id)` - Unregister layer
- `bringToFront(id)` - Move layer to top (smart algorithm)
- `sendToBack(id)` - Move layer to bottom
- `setVisible(id, visible)` - Toggle visibility (+ XState event)
- `setOpacity(id, opacity)` - Adjust transparency
- `setLocked(id, locked)` - Lock interactions (+ XState event)
- `setPointerEvents(id, behavior)` - Change click behavior

## React Integration

### effect-atom Bindings

**layerRuntimeAtom** - Effect runtime for all layer services:

```typescript
export const layerRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    IdGenerator.Default,
    LayerFactory.Default,
    LayerManager.Default
  )
);
```

**Atom Definitions**:

```typescript
// All layers (unsorted)
const layersAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getAllLayers();
  })
);

// Layers sorted by z-index
const layerIndexAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    return yield* manager.getLayerIndex();
  })
);

// Individual layer by ID (family pattern)
const layerAtom = Atom.family((id: string) =>
  layerRuntimeAtom.atom(
    Effect.gen(function* () {
      const manager = yield* LayerManager;
      return yield* manager.getLayer(id);
    })
  )
);
```

**Operation Atoms**:

```typescript
export const layerOpsAtom = {
  bringToFront: layerRuntimeAtom.fn(
    Effect.gen(function* (id: string) {
      const manager = yield* LayerManager;
      yield* manager.bringToFront(id);
    })
  ),
  // ... other operations
};
```

### withLayering HOC

**Purpose**: Wraps React components as layers in the layer system.

**Features**:

- Auto-registration on mount
- Auto-cleanup on unmount
- Applies z-index and pointer-events styles
- Data attributes for debugging (`data-layer-id`, `data-layer-name`)

**Usage**:

```tsx
const BackgroundLayer = withLayering(() => <HoundstoothGOL />, {
  name: 'background',
  zIndex: -10,
  pointerEvents: 'auto',
});

<BackgroundLayer />;
```

### useLayer Hook

**Purpose**: Access layer state and operations from any component.

**API**:

```typescript
// Get specific layer
const { layer, bringToFront, setVisible } = useLayer('layer-id');

// Get all layers
const { allLayers, layerIndex } = useLayer();

// Operations
bringToFront(); // If layerId provided
setVisible(true); // Toggle visibility
setOpacity(0.5); // Adjust transparency
```

## Usage Examples

### Basic Layer Setup

```tsx
import { withLayering } from '@/lib/layers';

const Background = withLayering(
  () => (
    <div className="fixed inset-0">
      <Pattern />
    </div>
  ),
  { name: 'bg', zIndex: -10, pointerEvents: 'auto' }
);

const Content = withLayering(
  ({ children }) => <div className="relative">{children}</div>,
  { name: 'content', zIndex: 10, pointerEvents: 'pass-through' }
);

function App() {
  return (
    <>
      <Background />
      <Content>
        <MyUI />
      </Content>
    </>
  );
}
```

### Programmatic Layer Control

```tsx
import { useLayer } from '@/lib/layers';

function LayerControls({ layerId }: { layerId: string }) {
  const { layer, bringToFront, sendToBack, setVisible } = useLayer(layerId);

  if (!layer) return null;

  return (
    <div>
      <h3>
        {layer.name} (z: {layer.zIndex})
      </h3>
      <button onClick={bringToFront}>Bring to Front</button>
      <button onClick={sendToBack}>Send to Back</button>
      <button onClick={() => setVisible(!layer.visible)}>
        {layer.visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
```

### Custom onResort Closure

```tsx
import { LayerFactory } from '@/lib/layers';
import * as Effect from 'effect/Effect';

// In a service or component
const createAnimatedLayer = layerRuntimeAtom.fn(
  Effect.gen(function* (config: LayerConfig) {
    const factory = yield* LayerFactory;

    const layer = yield* factory.createLayer(config, (updatedLayer) =>
      Effect.gen(function* () {
        // Custom logic when layer is resorted
        yield* Effect.log(`Layer moved to z-index ${updatedLayer.zIndex}`);
        // Trigger animation, analytics, etc.
      })
    );

    return layer;
  })
);
```

## File Structure

```
src/lib/layers/
├── types.ts                    # TypeScript types
├── services/
│   ├── IdGenerator.ts          # ID generation service
│   ├── LayerFactory.ts         # Layer factory service
│   └── LayerManager.ts         # Layer manager service
├── machines/
│   └── layerMachine.ts         # XState lifecycle machine
├── atoms/
│   └── index.ts                # effect-atom definitions
├── withLayering.tsx            # HOC for layer wrapping
├── useLayer.ts                 # React hook
└── index.ts                    # Public exports
```

## Testing Strategy

### Unit Tests (Effect Services)

Use `@effect/vitest` for testing Effect services in isolation:

```typescript
import { describe, it } from '@effect/vitest';
import { Effect } from 'effect';
import { IdGenerator } from './IdGenerator';

describe('IdGenerator', () => {
  it.effect('generates unique IDs', () =>
    Effect.gen(function* () {
      const gen = yield* IdGenerator;
      const id1 = gen.generate();
      const id2 = gen.generate();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[A-Za-z0-9_-]{21}$/); // nanoid format
    }).pipe(Effect.provide(IdGenerator.Default))
  );
});
```

### Integration Tests (Services + State)

Test service interactions with LayerManager:

```typescript
it.effect('bringToFront updates z-index correctly', () =>
  Effect.gen(function* () {
    const manager = yield* LayerManager;
    const factory = yield* LayerFactory;

    const layer1 = yield* factory.createLayer({ name: 'L1', zIndex: 0 });
    const layer2 = yield* factory.createLayer({ name: 'L2', zIndex: 10 });

    yield* manager.addLayer(layer1);
    yield* manager.addLayer(layer2);
    yield* manager.bringToFront(layer1.id);

    const index = yield* manager.getLayerIndex();
    expect(index[index.length - 1].id).toBe(layer1.id);
    expect(index[index.length - 1].zIndex).toBeGreaterThan(10);
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        IdGenerator.Default,
        LayerFactory.Default,
        LayerManager.Default
      )
    )
  )
);
```

### Atom Tests (effect-atom)

Test reactive atom behavior:

```typescript
import { Atom } from '@effect-atom/atom-react';
import { layersAtom, layerOpsAtom } from './atoms';

it('layersAtom updates when layer added', async () => {
  const addLayer = Atom.get(layerOpsAtom.addLayer);

  const layer = { id: 'test', name: 'Test', zIndex: 0 /* ... */ };
  await addLayer(layer);

  const layers = Atom.get(layersAtom);
  expect(layers).toContainEqual(expect.objectContaining({ id: 'test' }));
});
```

### React Component Tests

Test HOC and hooks integration:

```typescript
import { render, screen } from '@testing-library/react';
import { withLayering, useLayer } from '@/lib/layers';

it('withLayering applies z-index style', () => {
  const Component = withLayering(() => <div>Content</div>, {
    name: 'test',
    zIndex: 42,
  });

  const { container } = render(<Component />);
  const wrapper = container.firstChild;

  expect(wrapper).toHaveStyle({ zIndex: 42 });
  expect(wrapper).toHaveAttribute('data-layer-name', 'test');
});
```

## Known Limitations & Future Work

1. **Effect.runPromise in withLayering**: Currently uses simplified Effect execution. Production code should handle fiber interruption and proper cleanup.

2. **No Layer Persistence**: Layers are ephemeral. Future: Add persistence via LocalStorage or Effect Layers.

3. **No Layer Groups**: Cannot group layers into folders/collections. Future: Add parent/child layer relationships.

4. **Fixed Z-Index Gaps**: Gap size (±10) is hardcoded. Future: Make configurable or adaptive.

5. **Limited XState Integration**: Machine doesn't trigger callbacks on state transitions. Future: Add actions/guards for richer lifecycle.

6. **No Undo/Redo**: Layer operations are not tracked for undo. Future: Add Effect-based command pattern.

## References

- [Effect Documentation](https://effect.website)
- [effect-atom Documentation](https://github.com/tim-smart/effect-atom)
- [XState Documentation](https://xstate.js.org)
- [Adobe Layers Paradigm](https://helpx.adobe.com/photoshop/using/layer-basics.html)

**EDIN: a briefing**

**Essence:** EDIN is a four-phase operational cycle—**Experiment, Design, Implement, Negotiate**—built to enforce disciplined iteration, explicit hypothesis-testing, and controlled adaptation. It is a strategic loop, not a workflow checklist. It forces uncertainty to surface early, clarity to solidify mid-cycle, execution to be bounded, and course-correction to be structural.

---

### **1. Experiment**

The phase that rejects assumption.
Its mandate: expose risk, surface unknowns, and test premises _before_ committing resources.

**Core moves:**

- Identify destabilizing variables.
- Generate hypotheses linked to strategic Briefs.
- Run minimal-cost probes to validate or kill assumptions.

**Function:** Clear the fog. Prevent waste. Ensure every later step sits on ground truth, not projection.

---

### **2. Design**

The phase that shapes intent into structure.
Its mandate: convert proven information into executable architecture.

**Core moves:**

- Translate experimental outcomes into Operations.
- Decompose Operations into Tasks and Subtasks.
- Allocate requirements, constraints, dependencies, and resource envelopes.

**Function:** Manufacture coherence. Define the battlefield before entering it.

---

### **3. Implement**

The phase that commits force.
Its mandate: execute the defined structure with precision and controlled variance.

**Core moves:**

- Carry out Subtasks under real conditions.
- Validate intermediate outputs using experimental rigor.
- Maintain operational reporting continuity.

**Function:** Turn design into reality. Transform orchestration into artifacts.

---

### **4. Negotiate**

The phase that interprets results and redistributes power.
Its mandate: absorb lessons, redirect resources, and adjust the next cycle’s trajectory.

**Core moves:**

- Conduct Debriefs to analyze failure vectors and success patterns.
- Reallocate assets based on evidence, not optimism.
- Update the Proposals queue and reprioritize Briefs.

**Function:** Preserve adaptability. Replace inertia with deliberate evolution.

---

### **Strategic Character**

EDIN is optimized for environments where uncertainty is high, mission tempo is variable, and planning without feedback is strategically hazardous. It is a governance system for iterative intelligence, ensuring that you never build blindly nor react sloppily.

**In short:**
Experiment reveals truth.
Design shapes truth.
Implement enacts truth.
Negotiate evolves truth.

A cycle that produces clarity, precision, and survivable momentum.

---

## AG-Grid Integration (tldraw)

### Overview

AG-Grid Community v34 is embedded as a tldraw custom shape, enabling data grids as first-class canvas objects.

### Key Files

```
src/components/tldraw/shapes/
├── data-grid-shape.tsx    # DataGridWidgetShapeUtil + cell renderers
├── data-grid-theme.ts     # TMNL_TOKENS + tmnlDataGridTheme
└── index.tsx              # Exports (add to tmnlShapeUtils array)
```

### Critical: AG-Grid v34 Module Registration

```typescript
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);
```

Without this, grid renders blank. No CSS imports needed with theme prop.

### TMNL_TOKENS

Parameterized design system in `data-grid-theme.ts`:

- `colors` - Full TMNL palette
- `typography` - Monospace stack, size scale
- `spacing` - Base unit + scales
- `dimensions` - Row/header heights
- `animation` - Duration/easing (for future animatification)

### Custom Cell Renderers

- `IdCellRenderer` - Muted, small tracking
- `ValueCellRenderer` - Number + cyan progress bar
- `StatusCellRenderer` - Glowing indicator + colored label

### Spawn

Toolbar button in `tmnl-toolbar.tsx` spawns `data-grid-widget` type.

### Docs

Deep architecture analysis: `assets/documents/AG_GRID_THEMING_ARCHITECTURE.md`

---

## Session Journal

See `.agents/index.md` for operational logs.

---

## Animation Library

The TMNL Animation Library provides reactive animation primitives built on effect-atom with GSAP and anime.js drivers.

### File Structure

```
src/lib/animation/
├── index.ts              # Exports
├── tokens.ts             # Design tokens (COLORS, TIMING, GEOMETRY, EASING)
├── Animatable.ts         # Core: animatable() + useAnimatable() hook
└── drivers/
    ├── gsap.ts           # GSAP driver + emanation utilities
    └── animejs.ts        # anime.js driver + SVG reticle utilities

src/components/testbed/
└── AnimationTestbed.tsx  # 3 case studies, accessible at /testbed

src/components/splash/
├── tokens.ts             # Splash-specific design tokens
├── CRTEffect.tsx         # CRT overlay (static, scanlines, moiré, flicker)
├── TerminalInit.tsx      # Boot log sequence
├── LogoReveal.tsx        # TMNL letter→word expansion
├── Splash.tsx            # Orchestrator
└── index.ts              # Exports
```

### Core API Pattern

**ALWAYS use `animatable()` + `useAnimatable()` for animated values:**

```tsx
import {
  animatable,
  useAnimatable,
  gsapDriver,
  Animatable,
} from '@/lib/animation';

// Set driver once (usually at module level)
Animatable.setDriver(gsapDriver);

// Define atoms OUTSIDE component for stable references
const opacityAtoms = animatable(1, { duration: 300, ease: 'power2.out' });

function MyComponent() {
  const { value, to, snap, stop, reverse, state } = useAnimatable(opacityAtoms);

  useEffect(() => {
    to(0); // Trigger animation
  }, [trigger]);

  return <div style={{ opacity: value }} />;
}
```

### Driver Selection

| Driver        | Use Case                                       |
| ------------- | ---------------------------------------------- |
| `gsapDriver`  | Precision timing, timelines, complex sequences |
| `animeDriver` | SVG animations, reticle effects                |
| `rafDriver`   | Simple transitions, when deps are overkill     |

### Direct GSAP Usage

For element animations (not reactive values), use GSAP directly:

```tsx
import { gsap } from 'gsap';

// Color shift animation
gsap.to(element, {
  color: '#c8e4d8',
  duration: 0.2,
  ease: 'power2.out',
});
```

### Anti-Patterns

**DON'T** use raw `animate()` from anime.js v4 incorrectly:

```tsx
// WRONG - v3 syntax
animate({ targets: element, opacity: 0 });

// CORRECT - v4 syntax (but prefer animatable())
animate(element, { opacity: 0 });
```

**DON'T** create atoms inside components:

```tsx
// WRONG - recreates on every render
function Bad() {
  const atoms = animatable(1, { duration: 200 }) // BAD!
  return ...
}

// CORRECT - stable reference
const atoms = animatable(1, { duration: 200 })
function Good() {
  const anim = useAnimatable(atoms)
  return ...
}
```

---

## Splash Screen (Q-Branch Brutalist)

The splash screen orchestrates a Bond-inspired boot sequence.

### Design Spec

| Dimension | Value                                 |
| --------- | ------------------------------------- |
| Aesthetic | Retro-futurist × Industrial brutalist |
| Palette   | Warm gray with cream undertones       |
| Timing    | ~2s boot + ~2s logo = ~4s total       |
| Skippable | Yes (click or any key)                |

### Phases

1. **Static burst** - CRT power-on noise
2. **Terminal init** - Staccato log lines with color shift
3. **Logo reveal** - T→Terminal, M→Multi-Modal, N→Navigation, L→Layer
4. **Morph/dissolve** - Fade to reveal HoundstoothGOL background

### Usage

```tsx
import { Splash } from '@/components/splash';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      <HoundstoothGOL /> {/* Always rendered, splash overlays */}
      <Content />
    </>
  );
}
```

---

## Conceptual Alignment Protocol

When Prime proposes a new abstraction, pattern, or system and the mental models aren't perfectly aligned, **immediately** invoke this protocol:

### Step 1: Surface the Gap

Use `AskUserQuestion` with 3-4 targeted questions:

1. **Shape Question** — "What is the data structure/interface in your head?"

   - Object with functions?
   - Pure function?
   - HOC/Decorator?
   - Something else?

2. **Composition Question** — "How should these compose?"

   - Merge/mixin?
   - Inheritance/extension?
   - Independent stacking?
   - Pipeline?

3. **API Question** — "What does the consumer API look like?"

   - Single item vs array?
   - Return shape (tuple, object, keyed)?
   - Imperative vs declarative?

4. **Scope Question** — "Where does this live? Who owns it?"
   - Provider-scoped?
   - Global?
   - File/module level?

### Step 2: Synthesize

After answers, write a **30-second summary** of the aligned model:

```
ALIGNED MODEL:
- Shape: Plain object with render/style/className functions
- Composition: Mixin with slot merging, order matters
- API: useTrait(single) or useTraits([array]) → keyed by trait.id
- Scope: Provider-scoped, injections isolated
```

### Step 3: Implement

Build to the aligned spec. If ambiguity resurfaces during implementation, pause and re-invoke the protocol.

### Step 4: Document

Create both:

- **README.md** — User-facing, concise, examples
- **CLAUDE.\*.md** — Agent handoff, comprehensive, gotchas

### Example: Trait System Alignment

**Initial request:** "A trait system for React, like Rust traits"

**Questions asked:**

1. Shape? → Object with fns
2. Composition? → Mixin with merge slots, order matters
3. Multi-trait API? → Object keyed by trait
4. Doc location? → CLAUDE.md root

**Result:** `src/lib/traits/` with `useTrait()` and `useTraits()` hooks, provider-scoped injection, stacked rendering.

---

## Current Task: Effect-ification (feat/tldraw-drag-reticles)

### Completed

- [x] Animation library with GSAP/anime.js drivers
- [x] Testbed route at `/testbed` with 3 case studies
- [x] Splash screen with Q-Branch Brutalist aesthetic

### Remaining

1. **Effect-ify animations** - Sequences as `Effect.gen` programs with spans
2. **Wire DragReticleOverlay** - Connect animation system to tldraw drag
3. **Add observability** - `Effect.withSpan()` for DevTools visibility

### Key Insight

Animation sequences should be **Effect programs**:

- `Effect.withSpan` for observability
- Fiber interruption for cancellation
- `Effect.all` for parallel animations
- `Scope` for cleanup

---

## Slider System (DAW-grade)

A DAW-grade slider system with runtime-swappable behaviors, fine-grained precision control, and debug overlays.

### File Structure

```
src/lib/slider/
├── index.ts                     # Public exports
├── types.ts                     # SliderState, SliderConfig, SliderBehaviorShape, SliderDebugInfo
├── services/
│   └── SliderBehavior.ts        # Effect.Service + 5 built-in behaviors
├── atoms/
│   └── index.ts                 # Atom.runtime factories, sliderReducer, debug atoms
├── hooks/
│   └── useSlider.ts             # Primary hook with state, events, handlers
├── components/
│   └── Slider.tsx               # Base slider component
└── debug/
    └── withSliderDebug.tsx      # HOC + SliderDebugPanel
```

### Core Pattern: Effect.Service for Behaviors

```typescript
// SliderBehavior is an Effect service
export class SliderBehavior extends Context.Tag('tmnl/slider/SliderBehavior')<
  SliderBehavior,
  SliderBehaviorShape
>() {}

// Each behavior is a Layer implementation
export const LinearBehavior = {
  Default: Layer.succeed(SliderBehavior, linearBehavior),
  shape: linearBehavior,
};

// Runtime factories for Atom.runtime()
export const linearSliderRuntime = createSliderRuntime(LinearBehavior.Default);
export const decibelSliderRuntime = createSliderRuntime(
  DecibelBehavior.Default
);
```

### Available Behaviors

| Behavior        | Use Case                | Example           |
| --------------- | ----------------------- | ----------------- |
| **Linear**      | Uniform distribution    | Volume 0-100      |
| **Logarithmic** | Frequency, gain         | 20Hz-20kHz        |
| **Decibel**     | Audio gain with 0dB ref | -48dB to +12dB    |
| **Exponential** | Time constants          | Attack 0-5000ms   |
| **Stepped**     | Discrete values only    | Quantized presets |

### Precision Modifiers

DAW-style modifier keys for fine-grained control:

| Modifier | Sensitivity   | Use Case            |
| -------- | ------------- | ------------------- |
| None     | 1.0x          | Normal dragging     |
| Shift    | 0.1x          | Fine adjustment     |
| Ctrl     | 0.01x         | Ultra-fine (sub-dB) |
| Alt      | Snap to steps | Force stepping      |

### Usage: Basic

```tsx
import { Slider, DecibelBehavior } from '@/lib/slider';

<Slider
  value={gain}
  onChange={setGain}
  behavior={DecibelBehavior.shape}
  config={{
    min: -48,
    max: 12,
    defaultValue: 0,
    step: 0.5,
    unit: 'dB',
  }}
/>;
```

### Usage: With Debug Overlay

```tsx
import { Slider, withSliderDebug } from '@/lib/slider'

const DebugSlider = withSliderDebug(Slider, { defaultExpanded: true })

<DebugSlider
  value={value}
  behavior={LinearBehavior.shape}
  config={{ min: 0, max: 100 }}
/>
```

### Usage: Standalone Debug Panel

```tsx
import { useSlider, SliderDebugPanel } from '@/lib/slider'

function MySlider() {
  const slider = useSlider({ value: 0.5, config: { min: 0, max: 1 }, debug: true })

  return (
    <div className="grid grid-cols-2">
      <div ref={slider.containerRef} onPointerDown={slider.handlePointerDown} ... />
      <SliderDebugPanel debugInfo={slider.debugInfo} />
    </div>
  )
}
```

### Testbed

Full demonstration at `/testbed/slider`:

- All 6 behavior variants with debug overlays
- Precision modifier demonstration
- Input modalities (drag, keyboard, wheel, double-click reset)
- Mixer strip example (gain, pan, send)
- Standalone debug panel layout

---

## DataManager Architecture (EPOCH-0002)

Service-scoped data orchestration with hybrid dispatch (Effect fibers + Web Workers).

### File Structure

```
src/lib/data-manager/
├── ARCHITECTURE.md              # Comprehensive design document
└── v1/
    ├── index.ts                 # Public exports
    ├── types.ts                 # Core interfaces (KernelType, Task, DataManagerOps)
    ├── DataManager.ts           # Effect.Service<>() with hybrid dispatch
    ├── kernels/
    │   ├── index.ts
    │   ├── types.ts             # Kernel payloads
    │   └── SearchKernel.ts      # Wraps FlexSearch + Linear drivers
    ├── atoms/
    │   └── index.ts             # Runtime atom + state/operation atoms
    └── hooks/
        └── useDataManager.ts    # React hook with typed interface
```

### Key Patterns

| Pattern                 | Location       | Notes                       |
| ----------------------- | -------------- | --------------------------- |
| `Effect.Service<>()`    | DataManager.ts | Canonical service pattern   |
| `Effect.Ref<State>`     | DataManager.ts | Internal state management   |
| `Effect.withSpan()`     | DataManager.ts | Traced dispatch             |
| Untraced hot path       | DataManager.ts | `dispatchHot()` skips spans |
| `Atom.runtime()`        | atoms/index.ts | Combines service layers     |
| `runtimeAtom.fn<T>()()` | atoms/index.ts | Mutation operations         |

### Testbed

Route: `/testbed/data-manager`

Validates hypotheses:

- H1: effect-atom state flows correctly to AG-Grid rowData
- H2: Progressive stream updates trigger grid re-renders without flicker
- H3: Service-scoped atoms provide cleaner DX than useState
- H4: Throughput atom provides real-time search metrics
- H5: Driver switching (flex/linear) is seamless

---

## useState → effect-atom Migration Protocol

**PRECEDENT ESTABLISHED (EPOCH-0002)**

See `.edin/EFFECT_PATTERNS.md` for the comprehensive registry of Effect-Atom patterns.

When building new features or refactoring existing components, **prefer effect-atom over useState** for any state that:

1. **Crosses component boundaries** — shared state between sibling/distant components
2. **Derives from async operations** — API calls, streams, Effects
3. **Needs reactive subscriptions** — multiple consumers of same state
4. **Benefits from service scoping** — lifecycle tied to a service, not component mount

### Migration Pattern

**Before (useState pollution):**

```tsx
const [results, setResults] = useState<SearchResult[]>([]);
const [status, setStatus] = useState<StreamStatus>('idle');
const [stats, setStats] = useState<StreamStats>({ chunks: 0, items: 0, ms: 0 });
const [isIndexing, setIsIndexing] = useState(false);
```

**After (effect-atom):**

```tsx
// In atoms/index.ts
export const resultsAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const dm = yield* DataManager;
    return Atom.get(dm.atoms.results);
  })
);

// In component
const resultsResult = useAtomValue(resultsAtom);
const results = Result.isSuccess(resultsResult) ? resultsResult.value : [];
```

### When useState Is Still Acceptable

- **Pure UI state** — input bindings, toggle visibility, hover states
- **Single-component scope** — state used only within one component
- **No async dependencies** — simple synchronous state

### Anti-Patterns

**DON'T** use useState for:

- Search results (use atoms with progressive stream updates)
- Loading/error states (use Result types from effect-atom)
- Service configuration (use service-scoped atoms)
- Derived values (use derived atoms, not useState + useEffect)

**DON'T** sprinkle setters throughout callbacks:

```tsx
// WRONG - setter soup
const handleSearch = async () => {
  setStatus('streaming');
  setResults([]);
  for await (const result of stream) {
    setResults((prev) => [...prev, result]);
    setStats((prev) => ({ ...prev, items: prev.items + 1 }));
  }
  setStatus('complete');
};

// CORRECT - atom operations
const handleSearch = async () => {
  await doSearch({ query, limit: 100 });
  // Atoms update automatically via stream subscription
};
```

### Reference Implementation

See `src/components/testbed/DataManagerTestbed.tsx` for the canonical example of this pattern in action.

---

- install to the project directory, not the top level of the git repo.
- I have to say. This looks phenomenal. Tend to not change the UI once it's generated. If we're addressing bugs, then address what underlies.
- the new website submodule is WHAT you need to be researching against for canonical patterns. It contains the documentation as I see it presently. This is HUMAN authored. which means it has some battle tested patterns that are to be observed and adapted. deepwiki will return its best effort to understand, but its an agent, that has not written effect, merely read it.
- use Effect-ts for the search string lolol
- the canonical string, per deepwiki requests pertaining to effect IS Effect-TS/effect.
- Atom-as-State Pattern: When React is the consumer via effect-atom, use
  Atom.make() as the primary state—not Effect.Ref inside services. Service
  methods mutate Atoms directly (Atom.set), React subscribes directly. This
  eliminates the Ref→Atom bridge: no polling, no SubscriptionRef, no
  streams-to-consume-streams.
- It's never ever fixed. Until I say it's fixed
- when checking or validating patterns, usage etc, prefer consulting with resources (e.g. deepwiki or effect-docs, resources defined during session, refer to that as well)
- wtf. Use the goddamn stx for state management
- always wrap and run processes via pueue
