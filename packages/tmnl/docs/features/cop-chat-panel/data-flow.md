---
title: "COP Chat Panel — Data Flow Architecture"
date: 2026-02-09
status: Active
source: thoughts/cop-chat-panel/06-DATA-FLOW-MASTER.md
---

# COP Chat Panel — Data Flow Architecture

Consolidated from `thoughts/cop-chat-panel/06-DATA-FLOW-MASTER.md`.

## System Integration

The COP Chat Panel is a `FoldablePanel` (panelId="cop-chat") that merges 6 systems:

1. **BlockTerminal v3** -- AI conversation engine with streamRef blocks
2. **ChatInput** -- Compound input with mode toggle, thinking levels, context chips
3. **json-render** -- Catalog-driven AI UI with NDJSON streaming
4. **CursorChat** -- Dynamic Island chat with messages and attachments
5. **Conductor** -- Agent PTY view bound to agent sessions
6. **Kori Inspector** -- Node property inspector

## Atom Topology

### New Atoms

| Atom | Type | Purpose |
|------|------|---------|
| `chatBlocksAtom` | `Array<COPBlockV3>` | The conversation -- all block types |
| `activeAgentAtom` | `string | null` | Currently selected agent |
| `panelContextAtom` | `PanelContext` | Active panel context (entity, location) |
| `breakoutPanelsAtom` | `Map<id, BreakoutConfig>` | Open breakout panels |
| `chatScrollPositionAtom` | `number` | Scroll position for auto-scroll |
| `chatSessionAtom` | `ChatSession` | Session metadata |

### Existing Atoms (subscribed)

| Atom | Source | Purpose |
|------|--------|---------|
| `agentListAtom` | conductor/atoms | Available agents |
| `agentAtom(id)` | conductor/atoms (family) | Per-agent state |
| `streamStateByIdAtom(reqId)` | ai-core atoms | Stream progress |
| `workOrderAtom(id)` | iiot/fermion (family) | Work order data |
| `catalogAtom` | json-render/atoms | Component catalog |

## Service Dependencies

| Service | Source | Role |
|---------|--------|------|
| `BlockTerminalService` | terminal/v3 | AI queries via streamRef to ai-core |
| `SlashCommandRegistry` | NEW | `/commands` routing to IIoTService |
| `EntityMentionService` | NEW | `@-mention` entity resolution via Fermion |
| `ConductorService` | conductor | Agent routing, spawn, observe |
| `IIoTService` | iiot | Work orders, alarms, sensors |
| `ChannelService` | streams | Stream events to chat notifications |

## Block Types

| Block | `_tag` | Source |
|-------|--------|--------|
| `UserBlockV3` | `'user'` | User input |
| `AIResponseBlockV3` | `'ai-response'` | AI streaming response |
| `AgentOutputBlock` | `'agent'` | Conductor agent PTY output |
| `SlashCommandBlock` | `'slash'` | Slash command results |
| `JsonRenderBlockV3` | `'json-render'` | Tool output via json-render catalog |

## Data Flow

```
User Input (ChatInput)
  |
  +--> BlockTerminalService.executeAIQuery()
  |     |
  |     +--> ai-core streamChat() --> streamRef blocks
  |     |     |
  |     |     +--> ToolCallView registry lookup
  |     |           |
  |     |           +--> json-render UIRenderer (catalog)
  |     |                 |
  |     |                 +--> [Breakout Panel] (optional)
  |     |
  |     +--> chatBlocksAtom.update(append AIResponseBlockV3)
  |
  +--> SlashCommandRegistry.dispatch()
  |     |
  |     +--> IIoTService.* / ConductorService.*
  |     +--> chatBlocksAtom.update(append SlashCommandBlock)
  |
  +--> ConductorService.spawn/drive()
        |
        +--> Agent PTY stream
        +--> chatBlocksAtom.update(append AgentOutputBlock)
```

## Related Documents

- [README](README.md) -- Feature index and systems inventory
- [Implementation Plan](implementation-plan.md) -- Task hierarchy and critical path
- Source: `thoughts/cop-chat-panel/06-DATA-FLOW-MASTER.md`
