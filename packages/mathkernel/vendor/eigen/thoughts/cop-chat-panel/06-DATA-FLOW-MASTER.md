# COP Chat Panel — Master Data Flow & Integration Architecture

> Val's architecture note · The full wiring diagram
> All 5 storyboards connected into a single coherent system

## System Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     COP CHAT PANEL                                       │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  FoldablePanel (panelId="cop-chat")                                                │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Header: "COP ASSISTANT" + AgentSelector(activeAgentAtom)                    │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ChatBlockList (subscribes: chatBlocksAtom)                                  │  │  │
│  │  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────────┐  │  │  │
│  │  │  │  UserBlockV3   │ │AIResponseBlockV3│ │AgentOutputBlock│ │SlashCmdBlock │  │  │  │
│  │  │  │  (_tag:'user') │ │(_tag:'ai-resp') │ │(_tag:'agent')  │ │(_tag:'slash')│  │  │  │
│  │  │  └────────────────┘ └───────┬─────────┘ └───────┬────────┘ └──────────────┘  │  │  │
│  │  │                             │                    │                             │  │  │
│  │  │               ┌─────────────┘              ┌─────┘                            │  │  │
│  │  │               ▼                            ▼                                  │  │  │
│  │  │  ┌────────────────────┐      ┌─────────────────────┐                         │  │  │
│  │  │  │  ToolCallView      │      │  Agent PTY Stream    │                         │  │  │
│  │  │  │  Registry lookup   │      │  (Conductor agent)   │                         │  │  │
│  │  │  │  ┌──────────────┐  │      └──────────┬──────────┘                         │  │  │
│  │  │  │  │ json-render  │  │                  │                                    │  │  │
│  │  │  │  │ UIRenderer   │  │                  │                                    │  │  │
│  │  │  │  │ (catalog)    │  │                  │                                    │  │  │
│  │  │  │  └──────┬───────┘  │                  │                                    │  │  │
│  │  │  └─────────┼──────────┘                  │                                    │  │  │
│  │  │            │ [▶ Panel]                   │                                    │  │  │
│  │  │            ▼                              │                                    │  │  │
│  │  │  ┌────────────────────┐                  │                                    │  │  │
│  │  │  │  Breakout Panel    │                  │                                    │  │  │
│  │  │  │  (FoldablePanel)   │                  │                                    │  │  │
│  │  │  │  → entity detail   │                  │                                    │  │  │
│  │  │  └────────────────────┘                  │                                    │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ChatInputBar                                                                │  │  │
│  │  │  ┌────────────────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │  ChatInput.ContextChips → [📍 location] [🔧 entity] [📎 attachment]   │  │  │  │
│  │  │  ├────────────────────────────────────────────────────────────────────────┤  │  │  │
│  │  │  │  ChatInput.TextArea (TipTap with @-mention + /slash extensions)       │  │  │  │
│  │  │  ├────────────────────────────────────────────────────────────────────────┤  │  │  │
│  │  │  │  ChatInput.Toolbar                                                     │  │  │  │
│  │  │  │  [Terminal][●AI] ◈think │ /cmd @ent 📎attach 🎤voice │ [Send]        │  │  │  │
│  │  │  └────────────────────────────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  POPUPS (floating, above input):                                                        │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────┐  │
│  │ SlashCommandPopup │ │ EntityMentionPopup│ │ AttachmentPopup   │ │ VoiceOverlay    │  │
│  │ (filtered by /)   │ │ (filtered by @)   │ │ (panel contexts)  │ │ (recording)     │  │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Service Dependency Graph

```
COP Chat Panel (React)
│
├── subscribes to (effect-atom):
│   ├── chatBlocksAtom ─────────────── [NEW] Array<COPBlockV3>
│   ├── activeAgentAtom ────────────── [NEW] string | null
│   ├── panelContextAtom ───────────── [NEW] PanelContext
│   ├── breakoutPanelsAtom ─────────── [NEW] Map<id, BreakoutConfig>
│   ├── agentListAtom ─────────────── [EXISTING] conductor/atoms
│   ├── agentAtom(id) ─────────────── [EXISTING] conductor/atoms (family)
│   ├── streamStateByIdAtom(reqId) ── [EXISTING] ai-core atoms
│   ├── workOrderAtom(id) ─────────── [EXISTING] iiot/fermion (family)
│   └── catalogAtom ───────────────── [EXISTING] json-render/atoms
│
├── dispatches via (Effect services):
│   ├── BlockTerminalService ────────── AI queries → streamRef → ai-core
│   ├── SlashCommandRegistry ────────── [NEW] /commands → IIoTService
│   ├── EntityMentionService ────────── [NEW] @-mention → Fermion search via unified IIoT HttpApi
│   ├── ConductorService ───────────── Agent routing, spawn, observe
│   ├── IIoTService ────────────────── Work orders, alarms, sensors
│   └── ChannelService ─────────────── Stream events → chat notifications
│
└── renders via (component libraries):
    ├── FoldablePanel ──────────────── Container
    ├── ChatInput (compound) ───────── Input surface (chat-shell)
    ├── ToolCallView registry ──────── Tool result rendering (terminal-v3)
    ├── UIRenderer (json-render) ───── Catalog output (RVN components)
    ├── AgentStatusDot ─────────────── Agent indicators (conductor)
    └── RVN primitives ─────────────── Cards, badges, progress, buttons
```

## Atom Flow Diagram

```
                   ┌──────────────┐
                   │  User Input  │
                   │  (ChatInput) │
                   └──────┬───────┘
                          │ onSubmit
                          ▼
                   ┌──────────────┐     ┌──────────────────┐
                   │ chatDispatch │────►│ activeAgentAtom  │
                   │   (router)   │     │ (agent selection)│
                   └──────┬───────┘     └──────────────────┘
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
      ┌────────────┐ ┌──────────┐ ┌──────────┐
      │ slash cmd? │ │  AI msg  │ │ terminal │
      │ /command   │ │ ai-core  │ │  cmd     │
      └─────┬──────┘ └────┬─────┘ └────┬─────┘
            │              │             │
            ▼              ▼             ▼
      ┌────────────┐ ┌──────────┐ ┌──────────┐
      │SlashCommand│ │AIResponse│ │ Command  │
      │ Registry   │ │ BlockV3  │ │ BlockV3  │
      │ .execute() │ │(streamRef│ │ (output) │
      └─────┬──────┘ │→ai-core)│ └────┬─────┘
            │        └────┬─────┘      │
            │              │            │
            └──────────────┼────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  chatBlocksAtom │ ← ALL blocks land here
                  │  Array<COPBlock>│
                  └────────┬────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
                  ▼                 ▼
          ┌──────────────┐  ┌────────────────┐
          │ ChatBlockList│  │ Agent streams  │
          │ (React)      │  │ (subscriptions)│
          │ renders each │  │ append to      │
          │ block by _tag│  │ chatBlocksAtom │
          └──────────────┘  └────────────────┘
```

## Cross-Feature Dependencies

```
F117: GEOINT+IIoT Unified COP (root)
│
├── F119: FoldablePanel Surface Composition
│   └── ChatPanel IS a FoldablePanel
│   └── Breakout panels ARE FoldablePanels
│
├── F120: Dataplane Cross-Panel Data Flow
│   └── panelContextAtom connects to dataplane ports
│   └── 📎 attachment reads from dataplane selections
│
├── F121: IIoT Fermion Bridge
│   └── @-mention resolves against Fermion families
│   └── Fermion hydration consumes unified IIoT HttpApi (query/entity routes)
│   └── Tool results render Fermion entity data
│   └── /commands dispatch to IIoTService
│
├── F122: Conductor View & Layout Integration
│   └── Agent selector reads from ConductorService atoms
│   └── Agent output streams from Conductor sessions
│   └── Breakout panels positioned in Conductor layout
│
├── F123: Design System Compliance
│   └── 12px floor on all text
│   └── RVN primitives for all UI components
│   └── No border-radius
│
├── F124: Integration Testing
│   └── ChatPanel integration test with unified IIoT HttpApi surface
│   └── Tool result rendering test
│   └── Agent stream test
│
├── F125: Streams Channel Bridge
│   └── Live alarm events → chat notification blocks
│   └── Sensor anomaly events → chat alert blocks
│
└── F9 (NEW): COP Chat Panel
    ├── F9.1: Chat Core (scaffold + STX + block renderer + agent stream)
    ├── F9.2: ChatInput Extensions (agent selector, @-mention, /commands, voice, attach)
    ├── F9.3: Chat Output Rendering (IIoT catalog, tool registry, breakout panels, inspector)
    └── F9.4: Chat Integration (conductor wiring, streams bridge, session persist, tests)
```

## New File Structure

```
src/components/cop/
├── panels/
│   └── ChatPanel.tsx                  # Main FoldablePanel wrapper
├── blocks/
│   ├── ChatBlockList.tsx              # Scrollable block list renderer
│   ├── UserBlock.tsx                  # User message block
│   ├── AIResponseBlock.tsx            # AI response (delegates to terminal-v3)
│   ├── AgentOutputBlock.tsx           # Agent PTY stream block
│   ├── SlashCommandBlock.tsx          # Command result block
│   └── EmptyState.tsx                 # No-messages onboarding state
├── input/
│   ├── AgentSelector.tsx              # Agent dropdown (ChatInput compound child)
│   ├── SlashCommandPopup.tsx          # / autocomplete popup
│   ├── EntityMentionPopup.tsx         # @ autocomplete popup
│   ├── AttachmentPopup.tsx            # 📎 panel context picker
│   └── VoiceInputOverlay.tsx          # 🎤 recording overlay
├── tool-views/
│   ├── index.ts                       # Tool registration
│   ├── WorkOrderToolView.tsx          # query_work_orders
│   ├── AlarmToolView.tsx              # get_active_alarms, acknowledge_alarm
│   ├── SensorToolView.tsx             # get_sensor_readings
│   ├── AssetToolView.tsx              # get_asset_hierarchy
│   └── TimelineToolView.tsx           # get_event_timeline
├── breakout/
│   ├── BreakoutPanelManager.tsx       # Manages spawned breakout panels
│   ├── WorkOrderDetailPanel.tsx       # WO breakout panel content
│   ├── AlarmDetailPanel.tsx           # Alarm breakout panel content
│   └── SensorChartPanel.tsx           # Sensor chart breakout panel
├── schemas/
│   ├── blocks.ts                      # COPBlockV3 union (extends terminal-v3)
│   ├── breakout.ts                    # BreakoutPanelConfig
│   └── commands.ts                    # SlashCommandDef, SlashCommandResult
├── atoms/
│   ├── chatAtoms.ts                   # chatBlocksAtom, activeAgentAtom
│   ├── panelContextAtom.ts            # Cross-panel context
│   └── breakoutAtoms.ts              # Breakout panel state
├── services/
│   ├── SlashCommandRegistry.ts        # Effect.Service — command registry
│   ├── EntityMentionService.ts        # Effect.Service — entity search
│   └── ChatDispatchService.ts         # Effect.Service — message routing
├── hooks/
│   ├── useChatPanel.ts                # Main hook composing all subsystems
│   ├── useVoiceInput.ts               # Web Speech API hook
│   └── useBreakoutPanels.ts           # Breakout panel management
├── __tests__/
│   ├── ChatPanel.test.tsx             # Unit tests
│   └── ChatPanel.integration.test.ts  # Integration test (RUN_INTEGRATION_TESTS=1)
└── index.ts                           # Public exports
```

## New Schemas Summary (Effect Schema)

| Schema | _tag | Purpose |
|--------|------|---------|
| `UserBlockV3` | `'user'` | User message with context chips + voice flag |
| `AgentOutputBlockV3` | `'agent-output'` | Agent PTY stream output |
| `SlashCommandBlockV3` | `'slash-command'` | Command execution result |
| `COPBlockV3` | (union) | All terminal-v3 blocks + COP blocks |
| `BreakoutPanelConfig` | (struct) | Breakout panel spawn config |
| `SlashCommandDef` | (struct) | Command definition |
| `SlashCommandResult` | `'slash-result'` | Command execution result |
| `EntityMentionResult` | (struct) | @-mention search result |
| `PanelContext` | (struct) | Cross-panel focus/selection state |

## New Atoms Summary (effect-atom)

| Atom | Type | Purpose |
|------|------|---------|
| `chatBlocksAtom` | `Atom<COPBlockV3[]>` | All chat blocks (source of truth) |
| `activeAgentAtom` | `Atom<string \| null>` | Selected agent ID |
| `panelContextAtom` | `Atom<PanelContext>` | Focused panel + selections |
| `breakoutPanelsAtom` | `Atom<Map<string, BreakoutPanelConfig>>` | Spawned breakout panels |
| `chatScrollPositionAtom` | `Atom<number>` | Scroll position (for restore) |
| `chatSessionIdAtom` | `Atom<string>` | Current session for persistence |

## New Services Summary (Effect.Service)

| Service | Dependencies | Purpose |
|---------|-------------|---------|
| `SlashCommandRegistry` | `IIoTService`, `ConductorService`, `GeointService` | Register and execute /commands |
| `EntityMentionService` | `IIoTService` + IIoT HttpApi adapters (Fermion families) | @-mention entity search |
| `ChatDispatchService` | `BlockTerminalService`, `SlashCommandRegistry`, `ConductorService` | Route input to correct handler |
