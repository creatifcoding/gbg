# TMNL Skill Registry & System Decomposition

> Generated: 2025-12-20 | Updated: 2026-01-16
> Purpose: Comprehensive mapping of subsystems, testbeds, and skills with dependency graph

## Overview

TMNL is decomposed into **32 lib subsystems**, validated by **31 testbeds**, and documented via **50+ skills**.

**P0+P1 Skills Complete (6 skills, 53 patterns)**:

- `slider-system` (7 patterns) — DAW-grade behaviors, precision modifiers
- `data-manager-system` (7 patterns) — Effect.Service orchestration, hybrid dispatch
- `commands-hotkeys-system` (9 patterns) — Emacs-style command infrastructure
- `search-system` (10 patterns) — FlexSearch, QueryDSL, progressive streaming
- `drawer-floating-system` (10 patterns) — Rolodex stacks, stx-powered panels
- `streams-playground-system` (10 patterns) — EmissionEngine, reservoir sampling

This registry serves as the authoritative reference for skill discovery, gap analysis, and evolution planning.

---

## Subsystem → Testbed → Skill Mapping

### Legend

| Symbol | Meaning                                            |
| ------ | -------------------------------------------------- |
| ✅     | Complete (testbed + skill exist)                   |
| ⚠️     | Partial (testbed exists, skill missing/incomplete) |
| 🔧     | Planned (on roadmap)                               |
| ➖     | N/A (infrastructure, no testbed needed)            |

---

## Core Infrastructure Layer

| Subsystem      | Path                  | Testbed           | Skill                              | Status |
| -------------- | --------------------- | ----------------- | ---------------------------------- | ------ |
| **commands**   | `src/lib/commands/`   | KeybindingTestbed | `commands-hotkeys-system`          | ✅     |
| **hotkeys**    | `src/lib/hotkeys/`    | HotkeyTestbed     | `commands-hotkeys-system`          | ✅     |
| **variables**  | `src/lib/variables/`  | VariablesTestbed  | —                                  | ⚠️     |
| **overlays**   | `src/lib/overlays/`   | OverlayTestbed    | `tmnl-registry-patterns` (partial) | ⚠️     |
| **minibuffer** | `src/lib/minibuffer/` | —                 | —                                  | ⚠️     |
| **debug**      | `src/lib/debug/`      | —                 | `tmnl-debug-instrumentation`       | ✅     |

---

## Data & Search Layer

| Subsystem        | Path                    | Testbed                              | Skill                 | Status |
| ---------------- | ----------------------- | ------------------------------------ | --------------------- | ------ |
| **data-manager** | `src/lib/data-manager/` | DataManagerTestbed, DataManagerV1/V2 | `data-manager-system` | ✅     |
| **search**       | `src/lib/search/`       | SearchTestbed                        | `search-system`       | ✅     |
| **indices**      | `src/lib/indices/`      | IndicesTestbed                       | —                     | ⚠️     |
| **data-grid**    | `src/lib/data-grid/`    | DataGridTestbed, Variants            | `ag-grid-patterns`    | ✅     |

---

## UI Controls Layer

| Subsystem        | Path                    | Testbed                        | Skill                    | Status |
| ---------------- | ----------------------- | ------------------------------ | ------------------------ | ------ |
| **slider**       | `src/lib/slider/`       | SliderTestbed, SliderV2Testbed | `slider-system`          | ✅     |
| **drawer**       | `src/lib/drawer/`       | DrawerTestbed                  | `drawer-floating-system` | ✅     |
| **floating**     | `src/lib/floating/`     | FloatingPanelTestbed           | `drawer-floating-system` | ✅     |
| **selection**    | `src/lib/selection/`    | SelectionTestbed               | —                        | ⚠️     |
| **traits**       | `src/lib/traits/`       | TraitTestbed                   | —                        | ⚠️     |
| **capabilities** | `src/lib/capabilities/` | CapabilityTestbed              | —                        | ⚠️     |

### Gap: Traits & Capabilities Skill

**Needed**: `traits-capabilities-system` skill covering:

- Trait injection pattern (Rust-inspired)
- useTrait / useTraits hooks
- Provider-scoped injection
- Capability decorators
- Composition patterns

---

## Animation & Graphics Layer

| Subsystem       | Path                   | Testbed                              | Skill                   | Status |
| --------------- | ---------------------- | ------------------------------------ | ----------------------- | ------ |
| **animation**   | `src/lib/animation/`   | AnimationTestbed, AnimationV2Testbed | `tmnl-animation-tokens` | ✅     |
| **motion**      | `src/lib/motion/`      | —                                    | —                       | ⚠️     |
| **scale**       | `src/lib/scale/`       | —                                    | —                       | ➖     |
| **screensaver** | `src/lib/screensaver/` | ScreensaverTestbed                   | —                       | ⚠️     |

### Note: Animation Coverage

`tmnl-animation-tokens` covers tokens but not the full driver architecture. Consider expanding or creating companion skill.

---

## State Management Layer

| Subsystem   | Path               | Testbed | Skill                          | Status |
| ----------- | ------------------ | ------- | ------------------------------ | ------ |
| **stx**     | `src/lib/stx/`     | —       | `xstate-integration` (partial) | ⚠️     |
| **context** | `src/lib/context/` | —       | —                              | ➖     |
| **fui**     | `src/lib/fui/`     | —       | —                              | ➖     |

### Note: STX Coverage

`xstate-integration` covers STX but could use deeper examples. Consider expanding "stx hybrid pattern" section.

---

## Streaming & Real-time Layer

| Subsystem   | Path               | Testbed           | Skill                       | Status |
| ----------- | ------------------ | ----------------- | --------------------------- | ------ |
| **streams** | `src/lib/streams/` | StreamsPlayground | `streams-playground-system` | ✅     |
| **ava**     | `src/lib/ava/`     | AvaTestbed        | —                           | ⚠️     |
| **ams**     | `src/lib/ams/`     | —                 | —                           | ⚠️     |
| **bfo**     | `src/lib/bfo/`     | —                 | —                           | ⚠️     |

---

## Canvas & Visualization Layer

| Subsystem         | Path                            | Testbed             | Skill                        | Status |
| ----------------- | ------------------------------- | ------------------- | ---------------------------- | ------ |
| **tldraw shapes** | `src/components/tldraw/shapes/` | —                   | `ag-grid-patterns` (partial) | ⚠️     |
| **scada**         | `src/components/scada/`         | ScadaOverlayTestbed | —                            | ⚠️     |
| **drag**          | `src/lib/drag/`                 | —                   | —                            | ⚠️     |

### Gap: tldraw Integration Skill

**Needed**: `tldraw-integration` skill covering:

- Custom ShapeUtil patterns
- Canvas overlays (DragReticleOverlay)
- Hybrid drag system (grid-to-canvas)
- Shape embedding patterns

---

## Support Infrastructure

| Subsystem         | Path                     | Testbed | Skill                            | Status |
| ----------------- | ------------------------ | ------- | -------------------------------- | ------ |
| **testbed**       | `src/lib/testbed/`       | —       | `tmnl-testbed-patterns`          | ✅     |
| **primitives**    | `src/lib/primitives/`    | —       | `tmnl-component-tiers` (partial) | ✅     |
| **tmnl-ui**       | `src/lib/tmnl-ui/`       | —       | `tmnl-design-tokens`             | ✅     |
| **sidebar**       | `src/lib/sidebar/`       | —       | —                                | ➖     |
| **table-service** | `src/lib/table-service/` | —       | —                                | ⚠️     |
| **renderer**      | `src/lib/renderer/`      | —       | —                                | ➖     |

---

## Embedded & Simulation Layer

| Subsystem  | Path               | Testbed | Skill                                                  | Status |
| ---------- | ------------------ | ------- | ------------------------------------------------------ | ------ |
| **renode** | `embedded/renode/` | —       | `renode-for-tmnl`, `renode-init`, `renode-development` | ✅     |

---

## Dependency Graph

```
                    ┌─────────────────────────────────────────────┐
                    │           FOUNDATION SKILLS                  │
                    │  common-conventions, tmnl-file-organization │
                    │  tmnl-documentation-nav                      │
                    └───────────────────┬─────────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────────┐
                    │           EFFECT-TS CORE                     │
                    │  effect-patterns, effect-service-authoring  │
                    │  effect-schema-mastery, effect-stream       │
                    └───────────────────┬─────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   REACTIVE STATE    │   │   REACT COMPONENT   │   │   DOMAIN SPECIFIC   │
│  effect-atom-integ  │   │  react-compound     │   │  ag-grid-patterns   │
│  react-state-migr   │   │  react-hook-comp    │   │  xstate-integration │
│                     │   │  react-hoc-pattern  │   │  tmnl-animation-tok │
└─────────┬───────────┘   └─────────┬───────────┘   └─────────┬───────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────────┐
                    │         SUBSYSTEM SKILLS (NEW)           │
                    │  slider-system, data-manager-system     │
                    │  commands-hotkeys, drawer-floating      │
                    │  traits-capabilities, streams-playground│
                    │  search-system, tldraw-integration      │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │           TESTING & VALIDATION           │
                    │  bdd-specification, bdd-test-impl       │
                    │  bdd-hypothesis-validation              │
                    │  tmnl-testbed-patterns                  │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │           INFRASTRUCTURE                 │
                    │  beads-issue-management                 │
                    │  beads-dependency-tracking              │
                    │  beads-session-workflow                 │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────▼─────────────────────┐
                    │        RESEARCH & VERIFICATION          │
                    │  grounded-research (uncertainty proto)  │
                    │  effect-research (Effect-TS specific)   │
                    │  research-cascade (multi-source orch)   │
                    │  tmnl-submodule-exploration             │
                    └─────────────────────────────────────────┘
```

---

## Research Skills Layer (NEW)

Research skills enforce epistemic honesty and grounded verification before implementation.

| Skill                        | Purpose                                                    | Triggers                                   |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `grounded-research`          | Uncertainty admission protocol, knowledge cutoff awareness | "research", "verify", "uncertain"          |
| `effect-research`            | Effect-TS specialized research via deepwiki + submodules   | "Effect pattern", "Schema", "Atom.runtime" |
| `research-cascade`           | Multi-source orchestration (deepwiki → submodules → web)   | "cross-reference", "verify from multiple"  |
| `tmnl-submodule-exploration` | Navigate effect, effect-atom, website submodules           | "submodule", "canonical example"           |

### Research Cascade Order

```
1. deepwiki (ask verification questions)
   └─ Repos: Effect-TS/effect, tim-smart/effect-atom
2. Submodules (canonical sources)
   └─ website/ (human docs), effect/ (tests), effect-atom/ (atoms)
3. WebSearch (recent changes only)
   └─ Breaking changes, version updates
4. Codebase (.edin/, src/lib/)
   └─ Local precedent, TMNL conventions
```

### Key Principle

> **Admit uncertainty BEFORE researching. Verify BEFORE implementing.**

---

## CLI Framework Skills (NEW)

Internal CLI framework using Effect CLI with modular services for persistence, messaging, and configuration.

| Skill             | Purpose                                                               | Triggers                                                 |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `cli/core`        | Command.make, Args, Options, subcommands, program structure           | "CLI", "Command.make", "@effect/cli"                     |
| `cli/persistence` | SQLite storage via @effect/sql-sqlite-bun, repositories, migrations   | "SQLite", "cli storage", "persistence"                   |
| `cli/messaging`   | Agent-guiding errors, TaggedError patterns, output formatting         | "error messages", "agent guidance", "TaggedError"        |
| `cli/services`    | Effect.Service patterns, Layer composition, dependency injection      | "Effect.Service", "Layer composition", "CLI service"     |
| `cli/config`      | Configuration via Context + Config, env vars, config files, XDG paths | "CLI config", "environment variables", "Config.Provider" |

### CLI Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI APPLICATION                           │
├─────────────────────────────────────────────────────────────────┤
│  cli/core         │  Command definitions, Args, Options          │
├───────────────────┼─────────────────────────────────────────────┤
│  cli/messaging    │  TaggedErrors, recovery guidance, output fmt │
├───────────────────┼─────────────────────────────────────────────┤
│  cli/services     │  Effect.Service, Layer composition           │
├───────────────────┼─────────────────────────────────────────────┤
│  cli/persistence  │  SqliteClient, repositories, migrations      │
├───────────────────┼─────────────────────────────────────────────┤
│  cli/config       │  Config providers, env vars, XDG paths       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principle

> **Errors guide the next action. Every failure message answers: What now?**

### Reference Implementation

- **Research Session CLI**: `scripts/research-session-cli.ts`

---

## Priority Matrix: Skills Status

### P0 — Critical (Frequently Used Subsystems) ✅ COMPLETE

| Skill                     | Subsystem         | Testbed                   | Patterns   |
| ------------------------- | ----------------- | ------------------------- | ---------- |
| `slider-system`           | slider            | SliderTestbed, SliderV2   | 7 patterns |
| `data-manager-system`     | data-manager      | DataManagerTestbed, v1/v2 | 7 patterns |
| `commands-hotkeys-system` | commands, hotkeys | Keybinding, Hotkey        | 9 patterns |

### P1 — High (Active Development) ✅ COMPLETE

| Skill                       | Subsystem        | Testbed                      | Patterns    |
| --------------------------- | ---------------- | ---------------------------- | ----------- |
| `search-system`             | search           | SearchTestbed                | 10 patterns |
| `drawer-floating-system`    | drawer, floating | DrawerTestbed, FloatingPanel | 10 patterns |
| `streams-playground-system` | streams          | StreamsPlayground            | 10 patterns |

### P2 — Medium (Emerging Patterns)

| Skill                        | Subsystem            | Testbed                         | Justification               |
| ---------------------------- | -------------------- | ------------------------------- | --------------------------- |
| `traits-capabilities-system` | traits, capabilities | TraitTestbed, CapabilityTestbed | Novel abstraction pattern   |
| `selection-system`           | selection            | SelectionTestbed                | Marquee selection patterns  |
| `tldraw-integration`         | tldraw               | —                               | Canvas integration patterns |

### P3 — Low (Specialized)

| Skill                | Subsystem   | Testbed            | Justification                 |
| -------------------- | ----------- | ------------------ | ----------------------------- |
| `variables-system`   | variables   | VariablesTestbed   | Emacs-style variables         |
| `screensaver-system` | screensaver | ScreensaverTestbed | Specialized idle feature      |
| `overlays-system`    | overlays    | OverlayTestbed     | Partially covered by registry |

---

## Skill Template

All new skills should follow this structure:

```markdown
---
name: subsystem-name
description: [1-2 sentence purpose]. Invoke when [trigger conditions]. Provides [value].
model_invoked: true
triggers:
  - "trigger1"
  - "trigger2"
  - "trigger3"
---

# [Subsystem] Patterns for TMNL

## Canonical Sources

### TMNL Implementations

- **Primary**: `src/lib/[subsystem]/[file].ts`
- **Testbed**: `src/components/testbed/[Subsystem]Testbed.tsx`

### Reference Documentation

- **Architecture**: `assets/documents/[SUBSYSTEM]_ARCHITECTURE.md` (if exists)
- **Pattern Registry**: `.edin/[RELEVANT]_PATTERNS.md`

## Pattern 1: [Primary Pattern] — [VARIANT]

**When:** [Use case]

[Code example with comments]

**Key Features:**

- Feature 1
- Feature 2

**TMNL Examples:**

- `[file]:[line]` — [description]

## Pattern N: ...

## Anti-Patterns

### Don't: [Antipattern Title]

[Explanation and fix]

## Integration Points

- **Depends on**: [skill1], [skill2]
- **Used by**: [skill3], [skill4]

## Quick Reference

| Pattern | File | Use Case |
| ------- | ---- | -------- |
| ...     | ...  | ...      |
```

---

## Invocation Triggers Guide

Skills should include triggers that match:

1. **Direct mentions**: "slider", "DataManager", "hotkeys"
2. **Question patterns**: "how do I...", "where is..."
3. **Action patterns**: "create a...", "implement..."
4. **Error patterns**: "[Subsystem] not working", "fix [feature]"

---

## Maintenance Protocol

1. **On new testbed creation**: Check if subsystem skill exists; create if missing
2. **On lib subsystem evolution**: Update corresponding skill patterns
3. **On antipattern discovery**: Document in skill + EDIN epoch
4. **Quarterly review**: Audit gap matrix, prioritize skill creation

---

## Cross-References

- **Pattern Registry**: `.edin/EFFECT_PATTERNS.md`
- **Testing Patterns**: `.edin/EFFECT_TESTING_PATTERNS.md`
- **Service Patterns**: `.edin/EFFECT_SERVICE_PATTERNS.md`
- **Epoch Records**: `.edin/epochs/EPOCH-*.md`
- **Session Journal**: `.agents/index.md`

### Research Skills

- **Grounded Research**: `.claude/skills/grounded-research/SKILL.md`
- **Effect Research**: `.claude/skills/effect-research/SKILL.md`
- **Research Cascade**: `.claude/skills/research-cascade/SKILL.md`
- **Submodule Navigation**: `.claude/skills/tmnl-submodule-exploration/SKILL.md`

### CLI Framework Skills

- **Core Patterns**: `.claude/skills/cli/core/SKILL.md`
- **Persistence**: `.claude/skills/cli/persistence/SKILL.md`
- **Messaging**: `.claude/skills/cli/messaging/SKILL.md`
- **Services**: `.claude/skills/cli/services/SKILL.md`
- **Configuration**: `.claude/skills/cli/config/SKILL.md`

### Methodology Skills

- **Feature Design Documents (FDD)**: `.claude/skills/fdd-feature-design/SKILL.md`
  - Three-phase approach: SOI → FRD → FRP
  - Statement of Intent, Feature Requirements, Feature Realization
  - Backlink traceability between documents
