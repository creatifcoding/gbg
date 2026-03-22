# STORYBOARD 1: Chat Panel — Idle State (FoldablePanel)

> Val's architecture note · COP Chat Panel · Idle / Empty / Cold Start
> Questionnaire source: `chat-panel-features-cont` → "As a FoldablePanel — Yes."

## Visual

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 1: Chat Panel — Idle State (FoldablePanel)                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ CHAT ────────────────────────────────────────────────── ▾ ───────────┐  ║
║  │  ◆ COP ASSISTANT                              agent: planner ▼  │ │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │                                                                       │  ║
║  │     ┌─────────────────────────────────────────────────────────┐       │  ║
║  │     │                                                         │       │  ║
║  │     │   ◇  No messages yet                                    │       │  ║
║  │     │                                                         │       │  ║
║  │     │   Type a message, use /commands, or @mention entities   │       │  ║
║  │     │                                                         │       │  ║
║  │     │   Quick actions:                                        │       │  ║
║  │     │     /status    — System overview                        │       │  ║
║  │     │     /alarm     — Active alarms                          │       │  ║
║  │     │     @WO-       — Reference a work order                 │       │  ║
║  │     │                                                         │       │  ║
║  │     └─────────────────────────────────────────────────────────┘       │  ║
║  │                                                                       │  ║
║  │                                                                       │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  Ask about work orders, alarms, sensors...               ⏎    │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │  [Terminal] [AI]  ◈ none  │  /cmd  @entity  📎  🎤       [Send]     │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Component Tree

```
FoldablePanel (panelId="cop-chat", badge={tag:'custom', label:'CHAT'})
├── FoldablePanel.Header
│   ├── PanelBadge icon={MessageSquare}
│   ├── title: "COP ASSISTANT"
│   └── AgentSelector (compound child — see F9.2)
│       ├── label: "agent:"
│       ├── value: agentListAtom → first agent or "planner"
│       └── dropdown: agent list with status dots
├── FoldablePanel.Content
│   ├── ChatBlockList (scrollable area — empty state shown)
│   │   └── EmptyState
│   │       ├── icon: ◇ (RvnIcon)
│   │       ├── title: "No messages yet"
│   │       ├── description: quick-start hints
│   │       └── quickActions: ["/status", "/alarm", "@WO-"]
│   └── (block list renders here when non-empty)
├── ChatInputBar (fixed bottom, never scrolls)
│   └── ChatInput (from chat-shell, compound component)
│       ├── ChatInput.TextArea
│       │   ├── placeholder: "Ask about work orders, alarms, sensors..."
│       │   ├── minHeight: 40
│       │   └── maxHeight: 160
│       ├── ChatInput.Toolbar
│       │   ├── ChatInput.ToolbarGroup (left)
│       │   │   ├── ChatInput.ModeToggle (Terminal / AI)
│       │   │   ├── ChatInput.Divider
│       │   │   └── ChatInput.ThinkingLevel
│       │   └── ChatInput.ToolbarGroup (right)
│       │       ├── ChatInput.SlashCommandButton (/cmd) [NEW]
│       │       ├── ChatInput.MentionButton (@entity) [NEW]
│       │       ├── ChatInput.AttachmentButton (📎) [NEW]
│       │       ├── ChatInput.VoiceButton (🎤) [NEW]
│       │       └── ChatInput.SendButton
│       └── ChatInput.ContextChips (above TextArea, shown when chips exist)
└── FoldablePanel.Settings (gear icon → tabs)
    ├── tab: "General" — model selection, temperature
    ├── tab: "Agent" — agent config, role description
    └── tab: "Notifications" — alarm severity filter
```

## Atom Topology (effect-atom — what's subscribed, where)

```
┌──────────────────────────────────────────────────────────────────┐
│                    React Subscription Graph                        │
│                                                                    │
│  FoldablePanel                                                     │
│  └── subscribes: panelStateAtom(panelId="cop-chat")               │
│       └── FoldState: 'expanded' | 'collapsed' | 'minimized'       │
│                                                                    │
│  AgentSelector                                                     │
│  └── subscribes: agentListAtom (from conductor/atoms)              │
│       └── Array<AgentInstance> → filtered active agents            │
│  └── subscribes: activeAgentAtom [NEW — COP chat STX]             │
│       └── string (selected agent ID)                               │
│                                                                    │
│  ChatBlockList                                                     │
│  └── subscribes: chatBlocksAtom [NEW — COP chat STX]              │
│       └── Array<COPBlockV3> (extended block union)                 │
│       └── empty → renders EmptyState                               │
│                                                                    │
│  ChatInput                                                         │
│  └── internal state via React Context (compound component pattern) │
│  └── onSubmit → dispatches to chatDispatchAtom [NEW]               │
│       └── routes by mode:                                          │
│           'ai' → BlockTerminalService.executeAIQuery               │
│           'terminal' → slash command registry / shell               │
│                                                                    │
│  EmptyState                                                        │
│  └── pure component, no atom subscriptions                         │
│  └── quickActions: onClick → inserts text into ChatInput           │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow: Cold Start Sequence

```
1. Component mounts
   └── FoldablePanel reads panelStateAtom("cop-chat")
       └── default: { foldState: 'expanded', settingsOpen: false }

2. AgentSelector initializes
   └── reads agentListAtom from ConductorService
   └── if empty (no agents spawned yet):
       └── shows "No agents" disabled state
   └── if populated:
       └── auto-selects first agent, writes to activeAgentAtom

3. ChatBlockList initializes
   └── reads chatBlocksAtom [NEW]
   └── empty array → renders EmptyState
   └── EmptyState shows onboarding hints + quick actions

4. ChatInput ready
   └── ChatInput compound context initializes
   └── mode: 'ai' (default for COP)
   └── thinkingLevel: 'none' (default)
   └── textarea focused (optional: auto-focus config)

5. User sees:
   └── Panel header with "COP ASSISTANT" + agent selector
   └── Empty state with hints
   └── Input bar at bottom, ready for input
```

## Wiring to Existing Systems

| What | Source | How |
|------|--------|-----|
| FoldablePanel container | `src/lib/foldable-panel/FoldablePanel.tsx` | Direct usage. panelId="cop-chat", badge tag='custom' |
| ChatInput compound | `src/lib/chat-shell/ChatInput.tsx` | Direct usage. All 9 compound children available |
| Agent list | `src/lib/conductor/atoms/index.ts` → `agentListAtom` | useAtomValue(agentListAtom) |
| Agent by ID | `src/lib/conductor/atoms/index.ts` → `agentAtom(id)` | Atom.family pattern |
| Block schemas | `src/lib/terminal/v3/schemas/blocks.ts` → `BlockV3` | Extended union — add new COP tags |
| Empty state styling | `src/lib/rvn/` → RvnIcon, RvnBadge, RvnButton | RVN primitives for badges/icons |

## New Atoms Required

```typescript
// src/components/cop/atoms/chatAtoms.ts

/** Currently selected agent ID */
export const activeAgentAtom = Atom.make<string | null>(null)

/** All chat blocks (extended BlockV3 union + COP-specific blocks) */
export const chatBlocksAtom = Atom.make<COPBlockV3[]>([])

/** Dispatch function — routes input to correct handler */
export const chatDispatchAtom = Atom.make<null>(null) // action atom, not state
```

## New Schema Required

```typescript
// src/components/cop/schemas/blocks.ts
// Extends terminal/v3 BlockV3 with COP-specific block types

import { Schema } from 'effect'

/** Agent output block — streamed from Conductor agent PTY */
export const AgentOutputBlockV3 = Schema.TaggedStruct('agent-output', {
  id: Schema.String,
  agentId: Schema.String,
  agentName: Schema.String,
  agentRole: Schema.String,
  content: Schema.String,
  timestamp: Schema.DateFromSelf,
})

/** Slash command result block */
export const SlashCommandBlockV3 = Schema.TaggedStruct('slash-command', {
  id: Schema.String,
  command: Schema.String,
  result: Schema.Unknown,  // varies by command
  timestamp: Schema.DateFromSelf,
})

/** COP block union = terminal v3 blocks + COP-specific */
export const COPBlockV3 = Schema.Union(
  // Re-use all terminal v3 blocks
  AIResponseBlockV3,
  CommandBlockV3,
  InteractiveBlockV3,
  SystemBlockV3,
  ErrorBlockV3,
  JsonRenderBlockV3,
  // New COP blocks
  AgentOutputBlockV3,
  SlashCommandBlockV3,
)
```

## FoldablePanel Configuration

```typescript
// Badge for the chat panel
const chatPanelBadge: PanelBadge = {
  tag: 'custom' as PanelTag,
  label: 'CHAT',
  icon: MessageSquare, // lucide-react
  color: 'var(--rvn-cyan, #00e5ff)',
}

// Settings tabs
const chatSettingsTabs: SettingsTab[] = [
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    content: <ChatGeneralSettings />,
  },
  {
    id: 'agent',
    label: 'Agent',
    icon: Bot,
    content: <ChatAgentSettings />,
  },
  {
    id: 'notifications',
    label: 'Alerts',
    icon: Bell,
    content: <ChatNotificationSettings />,
  },
]
```

## Design Token Compliance (F123)

| Element | Token | Value | Rule |
|---------|-------|-------|------|
| Empty state hint text | `--tmnl-text-sm` | 14px | Readable at arm's length |
| Quick action labels | `--tmnl-text-xs` | 12px | THE FLOOR |
| Panel title "COP ASSISTANT" | `--tmnl-text-sm` | 14px | Consistent with other panels |
| Agent selector text | `--tmnl-text-xs` | 12px | Compact but readable |
| TextArea placeholder | `--tmnl-text-base` | 16px | Primary input surface |
| Toolbar button labels | `--tmnl-text-xs` | 12px | Icon-first, text secondary |
| border-radius | none | 0 | RVN brutalist aesthetic |

## Interaction Notes

- **Fold behavior**: Collapsing hides block list + input bar. Expanding restores scroll position.
- **Minimized**: Shows only header bar. Click to re-expand.
- **Focus mode**: FoldablePanel has `showFocusButton` — enters fullscreen chat.
- **Keyboard**: Enter to submit, Shift+Enter for newline. Tab cycles toolbar.
- **Auto-scroll**: Block list auto-scrolls to bottom on new block (unless user scrolled up).
