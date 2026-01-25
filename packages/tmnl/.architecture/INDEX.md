# TMNL Architecture Documentation Index

**Purpose**: This directory documents architectural decisions, system organization strategies, and reorganization initiatives for TMNL codebase.

**Goal**: Provide agent-friendly documentation for maintaining clarity across 100+ systems.

---

## Documents by Category

### Strategy & Planning

| Document                                           | Description                                      | Status      |
| -------------------------------------------------- | ------------------------------------------------ | ----------- |
| [REORG_STRATEGY.md](./REORG_STRATEGY.md)           | 4-phase reorganization of 71+ systems into tiers | ✅ Complete |
| [CRUFT_DELETION_PLAN.md](./CRUFT_DELETION_PLAN.md) | Targeted cruft identification and deletion plan  | ✅ Complete |

### System Organization (Future)

| Document                        | Description                                              | Status      |
| ------------------------------- | -------------------------------------------------------- | ----------- |
| _TBD: Foundation Layer_         | `_core/` structure for Effect primitives, schema helpers | 📋 Proposed |
| _TBD: Capability Tiers_         | `capabilities/` structure for cross-cutting features     | 📋 Proposed |
| _TBD: Capability Tiers_         | `capabilities/` structure for cross-cutting features     | 📋 Proposed |
| _TBD: System Dependency Matrix_ | Complete map of system interdependencies                 | 📋 Planned  |
| _TBD: Runtime Composition_      | Guide for system runtime layer creation                  | 📋 Planned  |

### Migration Guides (Future)

| Document                      | Description                                       | Status     |
| ----------------------------- | ------------------------------------------------- | ---------- |
| _TBD: Terminal Migration_     | Consolidate terminal v1/v2/v3 into single system  | 📋 Planned |
| _TBD: Editor Migration_       | Consolidate editor v1/v2/v3 into single system    | 📋 Planned |
| _TBD: Data-Manager Migration_ | Consolidate data-manager v1/v2 into single system | 📋 Planned |

### System Maps (Future)

| Document                | Description                                  | Status     |
| ----------------------- | -------------------------------------------- | ---------- |
| _TBD: System Inventory_ | Complete map of all 71 systems with metadata | 📋 Planned |

---

## Quick Reference

### System Tiers

- **Foundation**: `_core/` - Effect primitives, schema helpers, runtime utilities
- **Capabilities**: `capabilities/` - Cross-cutting features (commands, hotkeys, layers, etc.)
- **Features**: `features/` - User-facing domains (terminal, editor, AVA, data-grid)

### Canonical System Skeleton

See [REORG_STRATEGY.md](./REORG_STRATEGY.md) for the complete system skeleton pattern.

### Migration Status

See individual documents for progress on consolidating versioned systems (terminal, editor, data-manager, etc.).

---

## How to Update

When adding new documents:

1. **Determine category**: Strategy, System Org, Migration Guide, System Map, or Decision Record
2. **Name clearly**: Use `[PREFIX]_NAME.md` convention
3. **Update table**: Add row with status marker (📋 Proposed, 🚧 In Progress, ✅ Complete)
4. **Update timestamp**: Set "Last Updated" at top of file

---

## Related Documentation

### Internal Documentation

- [INDEX.md](./INDEX.md) - Master index of all architecture documents
- [AGENTS.md](./AGENTS.md) - Agent handoff guide for this directory

### System-Specific Documentation

- `src/ava/docs/` - AVA system architecture
- `.edin/EFFECT_PATTERNS.md` - Effect-atom integration patterns
- `.edin/EFFECT_SERVICE_PATTERNS.md` - Effect service patterns

---

_This index is maintained by architectural oversight. For questions about TMNL architecture, see individual documents or consult Val (the architectural conscience)._
