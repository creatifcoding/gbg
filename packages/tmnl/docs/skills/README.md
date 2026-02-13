# TMNL Skills Catalog

> **79 skills** across **16 categories** | Generated: 2026-02-09
>
> Skills are distilled expertise encoded in `.claude/skills/`. Each provides
> patterns, decision trees, and canonical references for a specific domain.
> Invoke via `/skill-name` or the Skill tool.

---

## Quick Reference — Top 10 Skills

These are the most frequently invoked skills across sessions:

| # | Skill | Invoke | Use When |
|---|-------|--------|----------|
| 1 | **effect-patterns** | `/effect-patterns` | General Effect-TS services, layers, schemas |
| 2 | **effect-schema-mastery** | `/effect-schema-mastery` | TaggedStruct, TaggedClass, branded types, transforms |
| 3 | **effect-service-authoring** | `/effect-service-authoring` | Effect.Service, Context.Tag, Layer composition |
| 4 | **effect-atom-integration** | `/effect-atom-integration` | Atom.runtime, ctx.set(), Result handling |
| 5 | **spike-testing** | `/spike-testing` | Hypothesis-driven debugging (H1-H4 isolation) |
| 6 | **grounded-research** | `/grounded-research` | Epistemic honesty, cascading source verification |
| 7 | **react-compound-components** | `/react-compound-components` | Compound component APIs, slot patterns |
| 8 | **common-conventions** | `/common-conventions` | File organization, barrel exports, naming |
| 9 | **iiot-isa95-hierarchy** | `/iiot-isa95-hierarchy` | ISA-95 equipment hierarchy, asset modeling |
| 10 | **fermion-patterns** | `/fermion-patterns` | Schema-driven Atom.family, registry patterns |

---

## Categories

- [Effect-TS](#effect-ts-12-skills)
- [React / UI](#react--ui-9-skills)
- [IIoT Domain](#iiot-domain-3-skills)
- [TMNL Platform](#tmnl-platform-14-skills)
- [CLI / Infrastructure](#cli--infrastructure-7-skills)
- [Testing / BDD](#testing--bdd-4-skills)
- [Workflow / Process](#workflow--process-5-skills)
- [Research](#research-3-skills)
- [Rust / Tauri](#rust--tauri-3-skills)
- [Renode (Embedded)](#renode-embedded-3-skills)
- [UX Patterns](#ux-patterns-3-skills)
- [Beads (Issue Tracking)](#beads-issue-tracking-4-skills)
- [NEX / NATS](#nex--nats-3-skills)
- [Data Systems](#data-systems-4-skills)
- [Vercel / Next.js](#vercel--nextjs-2-skills)
- [Specialized](#specialized-4-skills)

---

## Effect-TS (12 skills)

Core Effect-TS patterns — the foundation of the TMNL architecture.

| Skill | Description |
|-------|-------------|
| `effect-patterns` | Effect-TS pattern reference. Services, schemas, atoms, Effect-based architecture. Canonical file locations and pattern precedents. |
| `effect-schema-mastery` | Schema.TaggedStruct, Schema.TaggedClass, branded types, refinements, transformations. Runtime validation, type inference, schema composition. |
| `effect-service-authoring` | Effect.Service<>(), Context.Tag patterns, Layer composition. Decision trees for when to use which pattern. |
| `effect-atom-integration` | Atom.runtime, Atom.make, runtimeAtom.fn, operation atoms, Result handling. Atom-as-State doctrine for React integration. |
| `effect-stream-patterns` | Stream creation, consumption, transformation. Stream.async, Stream.fromSchedule, Stream.runForEach. Progressive data patterns. |
| `effect-error-handling` | Effect error handling patterns — typed errors, catchTag, catchTags, orElse, and error channel composition. |
| `effect-fiber-concurrency` | Fiber lifecycle, fork/join, race, interruption, and structured concurrency patterns. |
| `effect-logging-discipline` | Enforce Effect.log over console.log. Structured output, dynamic log levels, annotations, spans, and observability. |
| `effect-match-patterns` | Effect.Match for discriminated unions, Queue/PubSub for concurrency, Fiber lifecycle, HashMap for registries. |
| `effect-scope-resources` | Effect scopes for resource management, lifecycle concerns, and cleanup guarantees. |
| `effect-research` | Effect-TS specialized research via deepwiki and submodules. Grounded verification before implementation. |
| `fermion-patterns` | Schema-driven Atom.family patterns. Fermion builder API, registry patterns, algebra interpreters, React integration. |

---

## React / UI (9 skills)

Component architecture, state management, and UI composition patterns.

| Skill | Description |
|-------|-------------|
| `react-compound-components` | Compound component patterns. Context-based composition, slot patterns, Object.assign exports (e.g., `VantaCard.Header`). |
| `react-hoc-patterns` | Higher-Order Component patterns. Cross-cutting concerns, behavior injection (e.g., `withSliderDebug`, `withDraggable`). |
| `react-hook-composition` | Custom hook patterns. Hook composition, useDebugValue, atom subscriptions, registry patterns (e.g., `useSlider`). |
| `react-performance-patterns` | Performance optimization. useMemo, useCallback, React.memo, virtualization, and when optimization matters. |
| `react-state-migration` | Migration from useState to effect-atom. Pattern recognition for when useState is acceptable vs atoms required. |
| `components-build` | Build modern, composable, accessible React UI components following the components.build specification. |
| `vercel-composition-patterns` | Vercel-derived component composition patterns. |
| `vercel-react-best-practices` | React and Next.js performance optimization guidelines from Vercel Engineering. Bundle optimization, data fetching. |
| `xstate-integration` | XState v5 state machine patterns. setup().createMachine(), typed context/events, and the stx hybrid pattern. |

---

## IIoT Domain (3 skills)

Industrial IoT domain knowledge and data modeling.

| Skill | Description |
|-------|-------------|
| `iiot-isa95-hierarchy` | ISA-95 equipment hierarchy for asset modeling. Enterprise -> Site -> Area -> Line -> Cell -> Equipment -> Sensor. |
| `iiot-database` | IIoT database interaction patterns. TimescaleDB + Apache AGE queries, helper functions, mock data generation. |
| `iiot-unified-namespace` | Unified Namespace (UNS) architecture. Topic hierarchy, NATS subjects, and data flow patterns. |

---

## TMNL Platform (14 skills)

Platform-specific conventions, design tokens, and subsystem knowledge.

| Skill | Description |
|-------|-------------|
| `common-conventions` | Codebase conventions for file organization, barrel exports, naming patterns, comments, module structure. |
| `tmnl-file-organization` | Navigate directory structure. lib/ vs components/, testbeds, services, atoms, naming conventions. |
| `tmnl-component-tiers` | Component organization — three-tier hierarchy: primitives, composites, testbeds/pages. |
| `tmnl-color-system` | Color system architecture and surface hierarchy. Color schemes, glow effects, status indicators. |
| `tmnl-design-tokens` | Design token system. Token-based theming, CSS variables, extension patterns. |
| `tmnl-typography-discipline` | Typography rules and the **12px floor**. Minimum readable sizes, proper token usage. |
| `tmnl-debug-instrumentation` | DebugScope patterns, DebugScopeProvider, useDebugScope. Console logging via Effect.Console. |
| `tmnl-registry-patterns` | Singleton registries, atom registries, command registries. Subscription vs useAtomValue patterns. |
| `tmnl-testbed-patterns` | Creating testbed components at /testbed/*, route registration, testbed structure conventions. |
| `tmnl-documentation-nav` | Navigate documentation hierarchy — CLAUDE.md, .edin/ patterns, assets/documents/ ADRs, submodule docs. |
| `tmnl-submodule-exploration` | Navigate Effect, effect-atom, and website submodules for canonical sources and test examples. |
| `commands-hotkeys-system` | Emacs-inspired command and hotkey infrastructure. M-x palette, which-key popups, scope-aware bindings. |
| `animation-techniques` | Decision-tree routing for animation pattern selection. GSAP/anime.js integration. |
| `advanced-typescript-patterns` | Advanced TypeScript patterns. Conditional types, mapped types, branded types, generic constraints. |

---

## CLI / Infrastructure (7 skills)

Effect CLI framework and infrastructure tooling.

| Skill | Description |
|-------|-------------|
| `cli-core` | Core patterns for Effect CLI. Command.make, Args, Options, subcommands, program structure. |
| `cli-config` | Configuration patterns. Context.Tag, Config, env vars, config files, command-line overrides. |
| `cli-messaging` | Agent-guiding error messages. Data.TaggedError patterns, recovery suggestions, structured output. |
| `cli-persistence` | SQLite storage patterns using @effect/sql-sqlite-bun. Schema migrations, repositories, transactions. |
| `cli-services` | Effect.Service patterns for CLI infrastructure. Service definition, Layer composition, DI. |
| `ctl-release` | Update and rebuild spikectl or ctl packages in the monorepo. |
| `mcp-server-development` | Building MCP servers in Rust and TypeScript. Tool definitions, resource handling, Claude integration. |

---

## Testing / BDD (4 skills)

Test methodology, BDD specifications, and debugging protocols.

| Skill | Description |
|-------|-------------|
| `spike-testing` | Hypothesis-driven debugging. Progressive H1/H2/H3/H4 isolation methodology for spike tests. |
| `bdd-hypothesis-validation` | BDD hypothesis validation patterns. Structured approach to validating behavioral hypotheses. |
| `bdd-specification-patterns` | BDD specification patterns. Given/When/Then, feature files, specification authoring. |
| `bdd-test-implementation` | BDD test implementation. Translating specifications into executable tests. |

---

## Workflow / Process (5 skills)

Planning, execution, and coordination workflows.

| Skill | Description |
|-------|-------------|
| `architecture-council` | Multi-perspective architecture review process. |
| `fdd-feature-design` | Feature-Driven Development design patterns. |
| `iterative-plan-execution` | Phase-by-phase plan execution with checkpoints. |
| `plan-iteration-checkpoint` | Plan iteration review and checkpoint assessment. |
| `wbs-orchestration` | WBS management, session tracking, multi-agent dispatch (invoked via `/wbs`). |

> Note: `wbs-orchestration` is defined in user settings, not `.claude/skills/`.

---

## Research (3 skills)

Multi-source research and epistemic protocols.

| Skill | Description |
|-------|-------------|
| `grounded-research` | Epistemic honesty protocol. Uncertainty admission, cascading verification through deepwiki/submodules/web. |
| `research-cascade` | Multi-source research orchestration. Chains deepwiki, submodules, WebSearch. Escalation and synthesis. |
| `research-council` | Multi-agent research council for complex investigations. |

---

## Rust / Tauri (3 skills)

Rust patterns and Tauri desktop application development.

| Skill | Description |
|-------|-------------|
| `rust-effect-patterns` | Translating Effect-TS to Rust idioms. Result/Option, error propagation, Railway-Oriented Programming. |
| `rust-macro-patterns` | Procedural macros, derive macros, attribute macros, declarative macros. syn, quote!, TokenStream. |
| `tauri-rust-patterns` | Tauri app development. Command handlers, state management, IPC, plugins, WSLg workarounds. |

---

## Renode (Embedded) (3 skills)

Embedded systems emulation and firmware testing.

| Skill | Description |
|-------|-------------|
| `renode-development` | Day-to-day Renode development workflow. .resc edits, firmware swaps, UART verification. |
| `renode-for-tmnl` | Renode practices for TMNL with tmux, UART sockets, telemetry, and guardrails. |
| `renode-init` | Headless tmux launch workflow for Renode sessions, UART sockets, monitor panes. |

---

## UX Patterns (3 skills)

User experience, accessibility, and interaction design.

| Skill | Description |
|-------|-------------|
| `ux-accessibility-patterns` | Focus management, keyboard navigation, ARIA attributes, screen reader considerations. |
| `ux-feedback-patterns` | Loading states, progress indicators, status colors, toasts, DebugScope instrumentation. |
| `ux-interaction-patterns` | DAW-grade precision controls, Emacs-inspired keybindings, hover states, micro-interactions. |

---

## Beads (Issue Tracking) (4 skills)

Beads issue tracking system workflows.

| Skill | Description |
|-------|-------------|
| `beads-issue-management` | Creating, updating, and closing issues with proper types, priorities, metadata. |
| `beads-session-workflow` | Session start/end protocols, syncing with git, daily workflow integration. |
| `beads-daemon-management` | Daemon lifecycle management, log analysis, socket recovery, background sync. |
| `beads-dependency-tracking` | Issue dependencies, viewing blocked work, navigating dependency graphs. |

---

## NEX / NATS (3 skills)

NATS execution engine and messaging patterns.

| Skill | Description |
|-------|-------------|
| `nex-cli-guide` | NATS NEX CLI usage. Node and workload commands, flags, configuration. |
| `nex-codebase-navigation` | Navigate the NATS NEX codebase. Key codepaths, file structure, architecture. |
| `nex-effect-services` | Build NEX-integrated services using Effect-TS. Workload clients, RPC patterns, event subscriptions. |

---

## Data Systems (4 skills)

Data orchestration, search, streaming, and grid patterns.

| Skill | Description |
|-------|-------------|
| `data-manager-system` | Service-scoped data orchestration. Hybrid dispatch (fibers + workers), Atom-as-State, progressive streaming. |
| `search-system` | Stream-first search framework. QueryDSL operators, progressive results, FlexSearch integration. |
| `streams-playground-system` | Stress-test scenario engine. EmissionEngine, reservoir sampling, circuit breakers, D3 visualizations. |
| `ag-grid-patterns` | AG-Grid v34 integration. Custom cell renderers, themes, grid-based UI patterns. |

---

## Specialized (4 skills)

Domain-specific skills that don't fit other categories.

| Skill | Description |
|-------|-------------|
| `slider-system` | DAW-grade slider system. Precision controls, behavior curves, audio-style UI. Effect.Service patterns. |
| `drawer-floating-system` | Drawer and floating panel system. Rolodex stacks, stx-powered state, container queries. |
| `adal-schema-drift` | Schema drift analysis between Effect.Schema, @effect/sql Model, and PostgreSQL DDL. ASCII ER diagrams. |
| `sql-pro` | SQL optimization. Complex queries, window functions, CTEs, indexing strategies, query plan analysis. |

---

## When to Use Skills

### Activation Protocol

Skills are activated in three ways:

1. **Direct invocation** — Type `/skill-name` in conversation (e.g., `/effect-patterns`)
2. **Hook-triggered** — Pre-tool hooks detect patterns and emit `CRITICAL SKILLS` or `RECOMMENDED SKILLS` recommendations in system output
3. **Agent dispatch** — The WBS orchestration system assigns skills to sub-agents based on task type

### Hook-Triggered Activation

When hooks output skill recommendations:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL SKILLS:
  -> effect-schema-mastery

RECOMMENDED SKILLS:
  -> grounded-research

ACTION: Use Skill tool BEFORE responding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

| Signal | Action |
|--------|--------|
| `CRITICAL SKILLS` | **MUST** invoke immediately via Skill tool |
| `RECOMMENDED SKILLS` | **SHOULD** invoke unless clearly irrelevant |
| No skills listed | Proceed normally |

### Decision Tree: Which Skill?

```
What are you doing?
|
+-- Writing Effect-TS code?
|   +-- Defining types?      -> /effect-schema-mastery
|   +-- Creating services?   -> /effect-service-authoring
|   +-- Using streams?       -> /effect-stream-patterns
|   +-- Managing state?      -> /effect-atom-integration
|   +-- Error handling?      -> /effect-error-handling
|   +-- General patterns?    -> /effect-patterns
|
+-- Building React UI?
|   +-- Component API?       -> /react-compound-components
|   +-- Performance?         -> /react-performance-patterns
|   +-- State migration?     -> /react-state-migration
|   +-- Custom hooks?        -> /react-hook-composition
|
+-- Working on IIoT?
|   +-- Asset hierarchy?     -> /iiot-isa95-hierarchy
|   +-- Database queries?    -> /iiot-database
|   +-- NATS topics?         -> /iiot-unified-namespace
|
+-- Debugging?
|   +-- Isolating cause?     -> /spike-testing
|   +-- Verifying claims?    -> /grounded-research
|   +-- Schema mismatch?     -> /adal-schema-drift
|
+-- Unsure what exists?
    +-- File locations?      -> /tmnl-file-organization
    +-- Conventions?         -> /common-conventions
    +-- Documentation?       -> /tmnl-documentation-nav
```

---

## File Locations

| Resource | Path |
|----------|------|
| Skill definitions | `.claude/skills/<skill-name>/SKILL.md` |
| Skill registry | `.claude/skills/SKILL_REGISTRY.md` |
| BDD overview | `.claude/skills/BDD_SKILLS_OVERVIEW.md` |
| Skill scripts | `.claude/skills/_scripts/` |
| This catalog | `docs/skills/README.md` |

---

## Adding a New Skill

1. Create directory: `.claude/skills/<skill-name>/`
2. Add `SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: skill-name
   description: One-line description of what this skill provides.
   triggers:
     - keyword1
     - keyword2
   ---
   ```
3. Add patterns, decision trees, and canonical references in the body
4. Update this catalog with the new skill entry
