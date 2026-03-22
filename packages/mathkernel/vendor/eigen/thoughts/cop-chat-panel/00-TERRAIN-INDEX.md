# COP Chat Panel — Terrain Index

> Val's architectural survey, 2026-02-09
> Source: 4 questionnaire results + AST extraction + manual grep audit

## Systems Inventory (6 systems converging)

| # | System | Location | Maturity | What It Provides |
|---|--------|----------|----------|------------------|
| 1 | **BlockTerminal v3** | `src/lib/terminal/v3/` | Mature | AI conversation engine — streamRef blocks, XState machine, STX bridge, ToolCallView registry, useBlockTerminal hook |
| 2 | **ChatInput** (chat-shell) | `src/lib/chat-shell/` | Feature-complete | Compound input component — mode toggle (Terminal/AI), thinking levels, context chips, extensible toolbar groups |
| 3 | **json-render + GenerativeContainer** | `src/lib/json-render/` | Advanced | Catalog-driven AI UI generation — NDJSON streaming, worker pools, domain catalogs (geoint, rvn, ui, morph-card), recursive GenerativeContainer |
| 4 | **CursorChat** | `src/lib/cursor/components/chat/` | Working | Dynamic Island chat — messages, zoom, attachments, CursorPromptInput |
| 5 | **Conductor AgentTerminal** | `src/lib/conductor/components/AgentTerminal.tsx` | Working | Agent PTY view — xterm bound to agent session, render prop slot in ConductorPanel |
| 6 | **Kori InspectorPanel** | `src/components/testbed/kori/panels/InspectorPanel.tsx` | Exists | Node property inspector — entity drill-down |

## Underlying Services

| Service | Location | Role |
|---------|----------|------|
| **ai-core** | `src/lib/ai-core/` | Unified AI library — streaming, MCP tools, sessions, SSE adapter, conversation compaction |
| **AICoreService** | `src/lib/ai-core/services/AICoreService.ts` | Effect.Service — streamChat, abort, provider config |
| **SessionService** | `src/lib/ai-core/services/SessionService.ts` | Conversation persistence — save/restore, session management |
| **BlockTerminalService** | `src/lib/terminal/v3/services/BlockTerminalService.ts` | Effect.Service — executeAIQuery, executeCommand, composes AICoreService + TauriPtyService |
| **ConductorService** | `src/lib/conductor/services/ConductorService.ts` | Agent orchestration — spawn, drive, observe agents |
| **ChannelService** | `src/lib/streams/` | Push data flow — Feed, Junction, Inlet/Outlet topology |
| **CatalogService** | `src/lib/json-render/core/CatalogService.ts` | Component registry — maps json-render types to React components |

## Key Schemas (Effect Schema — TaggedStruct)

| Schema | Location | _tag |
|--------|----------|------|
| `AIResponseBlockV3` | `terminal/v3/schemas/blocks.ts` | `'ai-response'` |
| `CommandBlockV3` | `terminal/v3/schemas/blocks.ts` | `'command'` |
| `InteractiveBlockV3` | `terminal/v3/schemas/blocks.ts` | `'interactive'` |
| `SystemBlockV3` | `terminal/v3/schemas/blocks.ts` | `'system'` |
| `ErrorBlockV3` | `terminal/v3/schemas/blocks.ts` | `'error'` |
| `JsonRenderBlockV3` | `terminal/v3/schemas/json-render-block.ts` | `'json-render'` |
| `StreamRef` | `terminal/v3/schemas/blocks.ts` | (struct) |

## Key Atoms (effect-atom)

| Atom | Location | What It Holds |
|------|----------|---------------|
| `blocksAtom` | `terminal/v3/atoms/` | Array of BlockV3 — the conversation |
| `terminalSnapshotAtom` | `terminal/v3/terminal-stx.tsx` | XState snapshot bridge |
| `inputModeAtom` | `terminal/v3/terminal-stx.tsx` | 'terminal' \| 'ai' |
| `agentListAtom` | `conductor/atoms/` | Array of AgentState |
| `streamStatesByIdAtom` | `ai-core/atoms/` | Map<requestId, StreamState> |
| `workOrderListAtom` | `iiot/fermion/` | Array of WorkOrderModel (hydrated via unified IIoT HttpApi adapter) |
| `workOrderStatsAtom` | `iiot/fermion/` | Derived stats |

## Key Hooks

| Hook | Location | What It Does |
|------|----------|--------------|
| `useBlockTerminal()` | `terminal/v3/hooks/useBlockTerminal.ts` | blocks, executeAIQuery, isStreaming — the main API |
| `useAIBlockContent(block)` | `terminal/v3/hooks/useAIBlockContent.ts` | Derives content from streamRef → ai-core atom |
| `useTerminalInput()` | `terminal/v3/hooks/useTerminalInput.ts` | Input state, history, submission |
| `useUIStream()` | `json-render/react/hooks.ts` | NDJSON streaming → UITree atom |
| `useContainerUIStream()` | `json-render/react/GenerativeContainer.tsx` | Per-container isolated streaming |

## Questionnaire Results Summary

| Question | Answer |
|----------|--------|
| Which systems merge? | **ALL 6** — total convergence |
| What's missing from ChatInput? | Agent selector, panel context, @-mention, dataplane attach, /commands, voice |
| Tool output rendering? | **ALL options** — json-render catalog + terminal blocks + inline panels + breakout |
| Layout position? | **FoldablePanel** — consistent with other COP panels |
| Agent integration model? | **Stream-into** — agent output becomes chat blocks |

## File References

```
src/lib/terminal/v3/                     # BlockTerminal v3 (conversation engine)
src/lib/chat-shell/ChatInput.tsx         # ChatInput compound component
src/lib/json-render/                     # json-render (catalog output)
src/lib/cursor/components/chat/          # CursorChat (Dynamic Island)
src/lib/conductor/components/            # Conductor (AgentTerminal, ConductorPanel)
src/components/testbed/kori/panels/      # Kori Inspector
src/lib/ai-core/                         # Unified AI service layer
src/lib/iiot/fermion/                    # IIoT Fermion families (entity atoms)
src/lib/iiot/http/                       # Unified IIoT HttpApi (entity/query groups)
src/lib/streams/                         # Channel topology (push data flow)
src/lib/foldable-panel/                  # FoldablePanel container
src/lib/rvn/                             # RVN design system primitives
```
