# COP Chat Panel — Feature Plan Summary

> Generated from 5 questionnaire results + 5 storyboard expositions
> Feature root: **#F126** — COP Chat Panel — Unified AI+Agent+Inspector Interface

## Quantitative Summary

| Metric | Count |
|--------|-------|
| Features (F126 + children) | **5** |
| Total tasks | **42** |
| Dependency edges | **39** |
| Cross-feature dependencies | **12** (to F117 subtree tasks) |
| New Effect Schema types | **6** (UserBlockV3, AgentOutputBlockV3, SlashCommandBlockV3, COPBlockV3, BreakoutPanelConfig, SlashCommandDef) |
| New effect-atoms | **6** (chatBlocks, activeAgent, panelContext, breakoutPanels, chatScrollPosition, chatSession) |
| New Effect.Services | **3** (ChatDispatch, SlashCommandRegistry, EntityMention) |
| New json-render catalog components | **6** (WorkOrderList, WorkOrderDetail, AlarmSummary, SensorReadings, AssetTree, Timeline) |
| New ToolCallView registrations | **6** (WorkOrder, Alarm, Sensor, Asset, Timeline, Escalate) |
| New React components | **~20** (panels, blocks, popups, overlays, tool views) |
| Diagnostics issues | **0** |

## Feature Hierarchy

```
#F126 — F9: COP Chat Panel (root)
│
├── #F127 — F9.1: Chat Core (12 tasks)
│   Schemas → Atoms → STX bridge → Block renderer → Agent stream → Dispatch → Testbed
│
├── #F128 — F9.2: ChatInput Extensions (16 tasks)
│   Agent selector → @-mention → /commands → Dataplane attach → Panel context → Voice
│
├── #F129 — F9.3: Chat Output Rendering (10 tasks)
│   IIoT catalog → Tool views → Breakout manager → WO detail panel → Inspector tab
│
└── #F130 — F9.4: Chat Integration (4 tasks)
    Conductor wiring → Streams bridge → Session persistence → Integration test
```

## Critical Path

```
#469 UserBlockV3 schema ─┐
#470 AgentOutputBlock   ─┤
#471 SlashCommandBlock  ─┼─► #472 COPBlockV3 union ─► #474 chatBlocksAtom
                         │                              │
                         │                    ┌─────────┘
                         │                    ▼
                         │    #450 ChatPanel scaffold ─► #451 STX bridge ─► #452 Block renderer
                         │         │                                         │
                         │         ├─► #454 Testbed route                   ├─► #453 Agent stream ─► #466 Streams bridge
                         │         ├─► #455 Agent selector                  ├─► #461 IIoT catalog ─► #462 Tool views ─► #463 Breakout
                         │         ├─► #456 @-mention                       ├─► #465 Conductor wire
                         │         ├─► #457 Slash commands                  └─► #467 Session persist
                         │         ├─► #458 Dataplane attach                         │
                         │         └─► #460 Voice input                              ▼
                         │                                                   #468 Integration test
                         │
                         └─► #478 SlashCommandRegistry ─► #479 Built-in commands
                              #480 EntityMentionService
                              #486 IIoT domain catalog ─► #487 Tool views ─► #488 Breakout mgr ─► #489 WO detail
```

## Storyboard Index

| # | Document | Scope |
|---|----------|-------|
| 00 | `00-TERRAIN-INDEX.md` | Systems inventory, services, schemas, atoms, hooks — the full terrain |
| 01 | `01-STORYBOARD-IDLE.md` | Cold start: empty state, component tree, atom topology, FoldablePanel config |
| 02 | `02-STORYBOARD-ACTIVE-CONVERSATION.md` | Hot path: 5 block types, tool output via json-render, agent streams, data flow |
| 03 | `03-STORYBOARD-BREAKOUT-PANEL.md` | Breakout: tool result → standalone FoldablePanel, live data, cross-panel actions |
| 04 | `04-STORYBOARD-SLASH-MENTION.md` | Commands + mentions: slash registry, entity resolution, autocomplete popups, keyboard |
| 05 | `05-STORYBOARD-VOICE-AGENT.md` | Field operator: voice input, agent selector, attachment popup, dataplane context |
| 06 | `06-DATA-FLOW-MASTER.md` | Master integration: system map, service deps, atom flow, cross-feature deps, file structure |
| 07 | `07-FEATURE-PLAN-SUMMARY.md` | This document — quantitative summary + dependency lattice |

## Questionnaire Evidence

| Survey ID | Key Decision |
|-----------|-------------|
| `chat-panel-identity` | ALL 6 systems merge into COP Chat Panel |
| `chat-panel-composition` | All 6 missing features selected (agent selector, @-mention, /commands, dataplane, panel context, voice) |
| `chat-panel-features` | ALL tool output options: json-render catalog + terminal blocks + inline panels + breakout — "rich, and break out" |
| `chat-panel-features-cont` | Layout: FoldablePanel — "Yes" |
| `chat-panel-agent-model` | Agent integration: stream-into — agent output becomes chat blocks |

## Next Execution Step

The critical path starts with schemas (#469, #470, #471) → union (#472) → atoms (#474) → scaffold (#450).
These have ZERO dependencies on external tasks and can begin immediately.

The Fermion bridge (#407, in_progress) is the external dependency — it must hydrate via unified IIoT HttpApi flow (entity/query routes). Follow-up alignment work is tracked in #F132 with tasks #502–#507; once complete, the IIoT catalog (#486) and @-mention (#456) can proceed on the correct boundary.
