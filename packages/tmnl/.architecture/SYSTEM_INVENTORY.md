# TMNL System Inventory

**Purpose**: Complete catalog of all 71 systems in `src/lib/` with metadata for onboarding and reference.

**Last Updated**: 2026-01-14

---

## System Categories

### Foundation Layer (Planned)

| Module   | Purpose                                              | Status      |
| -------- | ---------------------------------------------------- | ----------- |
| `_core/` | Effect primitives, schema helpers, runtime utilities | 📋 Proposed |

### Capabilities Layer (Planned)

| Module          | Purpose                                                                 | Status      |
| --------------- | ----------------------------------------------------------------------- | ----------- |
| `capabilities/` | Cross-cutting features (commands, hotkeys, overlays, layers, telemetry) | 📋 Proposed |

### Features Layer (Target State)

| System           | Purpose                 | Files                                                                                       | Status |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------- | ------ |
| **terminal**     | Terminal UI             | `v3/index.ts`, `v3/v2`, `README.md`, `atoms/`, `hooks/`                                     | ✅     |
| **editor**       | Code editor             | `v3/index.ts`, `v1/index.ts`, `v2/index.ts`, `README.md`, `atoms/`, `hooks/`, `components/` | ✅     |
| **data-manager** | Search orchestration    | `v2/index.ts`, `v1/atoms/index.ts`, `v2/README.md`, `atoms/`, `hooks/`                      | ✅     |
| **ava**          | Asset View Agent        | `v2/index.ts`, `v1/index.ts`, `v2/atoms/`, `v2/hooks/`, `schemas/`, `events/`               | ✅     |
| **slider**       | DAW-grade sliders       | `v2/index.ts`, `v1/index.ts`, `atoms/`, `hooks/`, `components`                              | ✅     |
| **hotkeys**      | Command orchestration   | `index.ts`, `atoms/`, `services/`, `components`, `README.md`                                | ✅     |
| **animation**    | Animation library       | `v2/index.ts`, `atom.ts`, `drivers/`, `hooks/`, `types.ts`                                  | ✅     |
| **traits**       | Trait system            | `index.ts`, `types.ts`, `context.tsx`, `hooks/`, `components/`                              | ✅     |
| **commands**     | Global command registry | `index.ts`, `defaults.ts`, `types.ts`, `decorators.ts`, `service.ts`, `hooks/`              | ✅     |

### Data Layer (Target State)

| System              | Purpose          | Files                   | Status |
| ------------------- | ---------------- | ----------------------- | ------ |
| **search**          | Search system    | `index.ts`, `README.md` | ✅     |
| **indices**         | Index system     | `index.ts`, `README.md` | ✅     |
| **file-index**      | File indexing    | `index.ts`, `README.md` | ✅     |
| **nats**            | NATS client      | `index.ts`              | ✅     |
| **holonet**         | Holonet stack    | `index.ts`, `core/`     | ✅     |
| **durable-streams** | Durable streams  | `index.ts`              | ✅     |
| **streams**         | Stream utilities | `index.ts`              | ✅     |

### UI/Apps Layer (Target State)

| System            | Purpose             | Files                                   | Status   |
| ----------------- | ------------------- | --------------------------------------- | -------- | --- |
| **data-grid**     | AG-Grid integration | `index.ts`, `components/`, `renderers/` | ✅       |
| **drawer**        | Drawer overlay      | `index.ts`                              | `atoms/` | ✅  |
| **floating**      | Floating panels     | `index.ts`                              | `atoms/` | ✅  |
| **overlays**      | Overlays            | `index.ts`                              | `atoms/` | ✅  |
| **windows**       | Window system       | `index.ts`, `hooks/`, `atoms/`          | ✅       |
| **sidebar**       | Sidebar             | `index.ts`                              | `atoms/` | ✅  |
| **panels**        | Panels              | `index.ts`, `atoms`                     | ✅       |
| **tmnl-ui**       | TMNL UI             | `index.ts`                              | ✅       |
| **fui**           | FUI components      | `index.ts`                              | ✅       |
| **renderer**      | Renderer            | `index.ts`                              | ✅       |
| **screensaver**   | Screensaver         | `index.ts`                              | ✅       |
| **primitives**    | UI primitives       | `index.ts`                              | ✅       |
| **canvas**        | Canvas system       | `index.ts`                              | ✅       |
| **table-service** | Table service       | `index.ts`                              | ✅       |
| **pty**           | PTY system          | `index.ts`                              | ✅       |

### Interaction Layer

| System         | Purpose             | Files                             | Status      |
| -------------- | ------------------- | --------------------------------- | ----------- | ------------- | --- |
| **minibuffer** | M-x command palette | `index.ts`                        | `README.md` | `components/` | ✅  |
| **selection**  | Selection system    | `index.ts`, `atoms/`              | ✅          |
| **cursor**     | Cursor system       | `index.ts`, `atoms`, `components` | ✅          |
| **drag**       | Drag system         | `index.ts`                        | ✅          |
| **pty**        | PTY system          | ✅                                |

### Domain Apps Layer

| System        | Purpose               | Files      | Status        |
| ------------- | --------------------- | ---------- | ------------- | --- |
| **geoint**    | GeoInt system         | `index.ts` | ✅            |
| **testbed**   | Testbed components    | `index.ts` | ✅            |
| **dataplane** | Dataplane integration | `index.ts` | `components/` | ✅  |

### Infrastructure Layer

| System            | Purpose            | Files                                          | Status |
| ----------------- | ------------------ | ---------------------------------------------- | ------ |
| **session**       | Session management | `index.ts`, `atoms`, `services`, `persistence` | ✅     |
| **debug**         | Debug utilities    | `index.ts`                                     | ✅     |
| **schema-system** | Design tokens      | `index.ts`                                     | ✅     |
| **scale**         | Scale system       | `index.ts`                                     | ✅     |
| **variable**      | Variable system    | `index.ts`                                     | ✅     |

### Core/Experimental (Needs Review)

| System           | Purpose              | Files                             | Status |
| ---------------- | -------------------- | --------------------------------- | ------ |
| **actors**       | Actor system         | `index.ts`, `services`            | ✅     |
| **ecs**          | ECS engine           | `index.ts`                        | ✅     |
| **kori**         | Kori system          | `index.ts`, `services`            | ✅     |
| **stx**          | STX state management | `index.ts`                        | ✅     |
| **fermion**      | Fermion pattern      | `index.ts`, `components`, `atoms` | ✅     |
| **telegram**     | Telegram integration | `index.ts`                        | ✅     |
| **mcp**          | MCP client           | `index.ts`                        | ✅     |
| **file-browser** | File browser         | `index.ts`                        | ✅     |
| **file-index**   | File indexing        | `index.ts`                        | ✅     |
| **rag**          | RAG system           | `index.ts`                        | ✅     |
| **theia**        | Theia integration    | `index.ts`                        | ✅     |

### Documentation/Artifacts (Scattered)

| Location                          | Count               | Status       |
| --------------------------------- | ------------------- | ------------ | --- |
| `.edin/`                          | EDIN cycle tracking | 1 file       | ✅  |
| `.architecture/`                  | Architecture docs   | 3 files      | ✅  |
| Individual system ARCHITECTURE.md | ~50 files           | 📋 Scattered |
| AGENTS.\*.md in systems           | ~10 files           | 📋 Scattered |

---

## System Metadata

### Key Metrics

- **Total Systems**: 71
- **With atoms/**: 38
- **With services/**: 33
- **With hooks/**: 42
- **With index.ts barrel**: 364
- **Test directories**: 20+ `__tests__/`
- **Markdown docs**: ~100 scattered

### Organization Quality Score

| Aspect              | Score | Notes                                                   |
| ------------------- | ----- | ------------------------------------------------------- |
| **Consistency**     | 6/10  | Mixed patterns, version sprawl                          |
| **Boundaries**      | 8/10  | Well-separated features, unclear cross-system ownership |
| **Documentation**   | 5/10  | Extensive but scattered                                 |
| **Maintainability** | 7/10  | Good test coverage, clear patterns                      |

### Version Sprawl (Active Parallel Development)

| System           | Versions   | Active Version                        | Assessment |
| ---------------- | ---------- | ------------------------------------- | ---------- |
| **terminal**     | v1, v2, v3 | **v3 active** - parallel dev tracks   |
| **editor**       | v1, v2, v3 | **v3 active** - parallel dev tracks   |
| **data-manager** | v1, v2     | **v2 current** - v2 is stable         |
| **slider**       | v1, v2     | **v2 active** - parallel dev tracks   |
| **animation**    | v2         | **v1 exists** - v2 is main, v1 legacy |
| **minibuffer**   | v1, v2     | **v2 active** - parallel dev tracks   |

**Recommendation**: Freeze v1 versions after v2 is proven stable

---

## System Dependencies

### High-Dependency Count

| System        | Depends On                              |
| ------------- | --------------------------------------- |
| **data-grid** | drawer, table-service                   |
| **editor**    | actors, ai-core, bfo, data-grid, geoint |
| **terminal**  | ai-core, mcp, tmnl-ui                   |
| **ava**       | nats, durable-streams, holonet          |
| **testbed**   | All testbed components                  |
| **geoint**    | indices, search, geoint (self)          |
| **dataplane** | dataplane, geoint                       |

### Cross-System Integration Points

| Integration           | Consumer                                   | Owner    |
| --------------------- | ------------------------------------------ | -------- | -------------- |
| Editor blocks use AVA | MapBlock, DataGridBlock                    | Editor   | Direct imports |
| Commands consumed by  | minibuffer, hotkeys, overlays, screensaver | Commands | Wire adapters  |
| Hotkeys consumed by   | windows                                    | Windows  | Hotkeys        |
| Terminal consumed by  | tmnl-ui, panels, overlays                  | Terminal | Direct imports |

---

## Notes

### Well-Organized Systems (Templates)

Use these as references when migrating other systems:

- **slider/v1**: Atoms/services/hooks/components clearly separated
- **hotkeys**: Atom-first architecture with comprehensive README
- **data-manager/v1**: Materialized views pattern
- **ava/v2**: Comprehensive system with atoms/services/hooks/runtime
- **traits**: Clean pattern with types/context/hooks/components

### Systems Requiring Version Cleanup

These have parallel development tracks that should be consolidated:

1. **terminal** - v1 (legacy) → v2 (facade) → v3 (canonical)
2. **editor** - v1 (legacy) → v2 (facade) → v3 (canonical)
3. **slider** - v1 (legacy) → v2 (facade)
4. **data-manager** - v1 (legacy) → v2 (canonical)

### Documentation Consolidation Targets

**Immediate** (Low risk):

- Remove duplicate CLAUDE files from individual systems (3 files)
- Consolidate scattered ARCHITECTURE.md files to `.architecture/` or `.edin/`

**Short-term** (Medium risk):

- Establish `_core/` and `capabilities/` structure
- Migrate 5 systems to `features/` tier

**Long-term** (High effort):

- Implement Foundation layer
- Enforce canonical system skeleton across all systems
- Centralize runtime composition

---

## References

- [CRUFT_DELETION_PLAN.md](./CRUFT_DELETION_PLAN.md) - Detailed cruft deletion plan
- [REORG_STRATEGY.md](./REORG_STRATEGY.md) - Full reorganization strategy
- [AGENTS.md](./AGENTS.md) - Agent handoff for this directory

---

_Last Updated: 2026-01-14_
