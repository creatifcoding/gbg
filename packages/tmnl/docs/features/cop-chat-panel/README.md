# COP Chat Panel -- Feature Documentation

> Consolidated from `thoughts/cop-chat-panel/`
> Original date: 2026-02-09

## Overview

The COP (Common Operating Picture) Chat Panel is a unified AI conversation surface that merges 6 existing systems into a single FoldablePanel. It combines chat, agent orchestration, generative UI, voice interaction, and data-plane integration.

## Systems Inventory

| # | System | Location | What It Provides |
|---|--------|----------|------------------|
| 1 | **BlockTerminal v3** | `src/lib/terminal/v3/` | AI conversation engine -- streamRef blocks, XState machine, STX bridge |
| 2 | **ChatInput** | `src/lib/chat-shell/` | Compound input -- mode toggle, thinking levels, context chips |
| 3 | **json-render** | `src/lib/json-render/` | Catalog-driven AI UI -- NDJSON streaming, domain catalogs |
| 4 | **CursorChat** | `src/lib/cursor/components/chat/` | Dynamic Island chat -- messages, zoom, attachments |
| 5 | **Conductor** | `src/lib/conductor/components/` | Agent PTY view -- xterm bound to agent session |
| 6 | **Kori Inspector** | `src/components/testbed/kori/panels/` | Node property inspector |

## Underlying Services

| Service | Location | Role |
|---------|----------|------|
| ai-core | `src/lib/ai-core/` | Unified AI library -- streaming, MCP tools, sessions |
| AICoreService | `src/lib/ai-core/services/` | Effect.Service -- streamChat, abort, provider config |
| BlockTerminalService | `src/lib/terminal/v3/services/` | executeAIQuery, executeCommand |
| ConductorService | `src/lib/conductor/services/` | Agent orchestration -- spawn, drive, observe |
| ChannelService | `src/lib/streams/` | Push data flow -- Feed, Junction, Inlet/Outlet |
| CatalogService | `src/lib/json-render/core/` | Component registry for json-render types |

## Storyboard Documents

| File | Content |
|------|---------|
| `01-STORYBOARD-IDLE.md` | Idle state UI/UX |
| `02-STORYBOARD-ACTIVE-CONVERSATION.md` | Active chat flow |
| `03-STORYBOARD-BREAKOUT-PANEL.md` | Breakout panel interactions |
| `04-STORYBOARD-SLASH-MENTION.md` | Slash commands and @-mentions |
| `05-STORYBOARD-VOICE-AGENT.md` | Voice interaction |

## Architecture Documents

| File | Content |
|------|---------|
| `06-DATA-FLOW-MASTER.md` | Complete data flow architecture |
| `07-FEATURE-PLAN-SUMMARY.md` | Implementation plan |
| `08-PI-RPC-PROVIDER-RESEARCH.md` | Pi RPC provider research |
| `09-SPAWN-ORCHESTRATION-DESIGN.md` | Agent spawn orchestration |
| `10-PI-IMPLEMENTATION-BLUEPRINT.md` | Pi integration blueprint |
| `11-PI-ERROR-HANDLING-PLAYBOOK.md` | Error handling patterns |
| `12-RUNTIME-BOUNDARY-CONTRACT.md` | Runtime boundary contracts |

## Key Design Decisions

| Question | Answer |
|----------|--------|
| Which systems merge? | ALL 6 -- total convergence |
| Tool output rendering? | json-render catalog + terminal blocks + inline panels + breakout |
| Layout position? | FoldablePanel (consistent with other COP panels) |
| Agent integration model? | Stream-into -- agent output becomes chat blocks |

## Key Schemas (Effect Schema)

| Schema | Location | _tag |
|--------|----------|------|
| AIResponseBlockV3 | `terminal/v3/schemas/blocks.ts` | `'ai-response'` |
| CommandBlockV3 | `terminal/v3/schemas/blocks.ts` | `'command'` |
| JsonRenderBlockV3 | `terminal/v3/schemas/json-render-block.ts` | `'json-render'` |

## Key Atoms (effect-atom)

| Atom | What It Holds |
|------|---------------|
| `blocksAtom` | Array of BlockV3 -- the conversation |
| `inputModeAtom` | 'terminal' \| 'ai' |
| `agentListAtom` | Array of AgentState |
| `streamStatesByIdAtom` | Map<requestId, StreamState> |

## Source Documents

All source documents are preserved at `thoughts/cop-chat-panel/`. This README serves as the navigation index.
