---
title: "COP Chat Panel — Implementation Plan"
date: 2026-02-09
status: Active
source: thoughts/cop-chat-panel/07-FEATURE-PLAN-SUMMARY.md, thoughts/cop-chat-panel/10-PI-IMPLEMENTATION-BLUEPRINT.md
---

# COP Chat Panel — Implementation Plan

Consolidated from `thoughts/cop-chat-panel/07-FEATURE-PLAN-SUMMARY.md` and `10-PI-IMPLEMENTATION-BLUEPRINT.md`.

## Quantitative Summary

| Metric | Count |
|--------|-------|
| Features (F126 + children) | 5 |
| Total tasks | 42 |
| Dependency edges | 39 |
| Cross-feature dependencies | 12 (to F117 subtree) |
| New Effect Schema types | 6 |
| New effect-atoms | 6 |
| New Effect.Services | 3 |
| New json-render catalog components | 6 |
| New ToolCallView registrations | 6 |
| New React components | ~20 |

## Feature Hierarchy

```
#F126 -- COP Chat Panel (root)
|
+-- #F127 -- Chat Core (12 tasks)
|   Schemas, Atoms, STX bridge, Block renderer, Agent stream, Dispatch, Testbed
|
+-- #F128 -- ChatInput Extensions (16 tasks)
|   Agent selector, @-mention, /commands, Dataplane attach, Panel context, Voice
|
+-- #F129 -- Chat Output Rendering (10 tasks)
|   IIoT catalog, Tool views, Breakout manager, WO detail panel, Inspector tab
|
+-- #F130 -- Chat Integration (4 tasks)
    Conductor wiring, Streams bridge, Session persistence, Integration test
```

## Critical Path

The critical path starts with schemas, flows through atoms and scaffold, then fans out:

1. **Schema definitions** (UserBlockV3, AgentOutputBlock, SlashCommandBlock)
2. **COPBlockV3 union** (combines all block types)
3. **chatBlocksAtom** (conversation state)
4. **ChatPanel scaffold** (FoldablePanel container)
5. **STX bridge** (state machine integration)
6. **Block renderer** (discriminated block rendering)

From the block renderer, work fans out to:
- Agent stream integration
- IIoT catalog + tool views + breakout panels
- Conductor wiring
- Session persistence
- Integration test

## New Artifacts

### Effect Schema Types (6)

| Type | `_tag` | Purpose |
|------|--------|---------|
| `UserBlockV3` | `'user'` | User input block |
| `AgentOutputBlockV3` | `'agent'` | Agent PTY output |
| `SlashCommandBlockV3` | `'slash'` | Slash command result |
| `COPBlockV3` | -- | Union of all block types |
| `BreakoutPanelConfig` | -- | Breakout panel configuration |
| `SlashCommandDef` | -- | Slash command definition |

### Effect Services (3)

| Service | Purpose |
|---------|---------|
| `ChatDispatch` | Routes user input to appropriate handler |
| `SlashCommandRegistry` | Registers and dispatches `/commands` |
| `EntityMentionService` | Resolves `@-mention` via Fermion entity search |

### json-render Catalog Components (6)

WorkOrderList, WorkOrderDetail, AlarmSummary, SensorReadings, AssetTree, Timeline

### ToolCallView Registrations (6)

WorkOrder, Alarm, Sensor, Asset, Timeline, Escalate

## Design Decisions

| Question | Decision |
|----------|----------|
| Which systems merge? | ALL 6 -- total convergence |
| Tool output rendering? | json-render catalog + terminal blocks + inline panels + breakout |
| Layout position? | FoldablePanel (consistent with other COP panels) |
| Agent integration model? | Stream-into -- agent output becomes chat blocks |

## Related Documents

- [README](README.md) -- Feature index and systems inventory
- [Data Flow](data-flow.md) -- Atom topology and service dependency graph
- Source: `thoughts/cop-chat-panel/07-FEATURE-PLAN-SUMMARY.md`
- Source: `thoughts/cop-chat-panel/10-PI-IMPLEMENTATION-BLUEPRINT.md`
