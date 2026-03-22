# STORYBOARD 5: Voice Input + Agent Selector

> Val's architecture note · COP Chat Panel · Field Operator Modalities
> Questionnaire source: `chat-panel-composition` → "Voice/whisper input" and "Agent selector — pick which Conductor agent receives the message"
> This is the FIELD OPERATOR storyboard — hands may be busy, gloves on, screen at a distance.

## Visual: Voice Recording + Agent Dropdown

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 5a: Voice Input — Active Recording                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ CHAT ────────────────────────────────────────────────── ▾ ───────────┐  ║
║  │  ◆ COP ASSISTANT                              agent: planner ▼  │ │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  (previous conversation blocks above...)                              │  ║
║  │                                                                       │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  🔴 Recording...                                                │  │  ║
║  │  │                                                                  │  │  ║
║  │  │  "Show me alarms for building three"                             │  │  ║
║  │  │   ↑ live transcript (Web Speech API interim results)             │  │  ║
║  │  │                                                                  │  │  ║
║  │  │  ▁▂▃▅▆▇▆▅▃▂▁▂▃▅▇▆▅▃▁                                          │  │  ║
║  │  │  ↑ audio level visualization (analyser node)                     │  │  ║
║  │  │                                                                  │  │  ║
║  │  │           [⏹ Stop]        [Cancel]                              │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                       │  ║
║  │  [Terminal] [●AI]  ◈ high │  /cmd  @entity  📎  🎤       [Send]     │  ║
║  │                                                   ↑ pulsing red       │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Visual: Agent Selector Dropdown

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 5b: Agent Selector Dropdown — Expanded                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ CHAT ────────────────────────────────────────────────── ▾ ───────────┐  ║
║  │  ◆ COP ASSISTANT                              agent: planner ▼  │ │  ║
║  ├───────────────────────────────────────────── ┌──────────────────────┐ ┤  ║
║  │                                              │                      │ │  ║
║  │                                              │  AGENTS              │ │  ║
║  │  (conversation blocks...)                    │                      │ │  ║
║  │                                              │  ● planner           │ │  ║
║  │                                              │    Strategy & triage │ │  ║
║  │                                              │    claude-sonnet-4   │ │  ║
║  │                                              │    ● working         │ │  ║
║  │                                              │                      │ │  ║
║  │                                              │  ○ analyst           │ │  ║
║  │                                              │    Data correlation  │ │  ║
║  │                                              │    claude-sonnet-4   │ │  ║
║  │                                              │    ○ idle            │ │  ║
║  │                                              │                      │ │  ║
║  │                                              │  ○ operator          │ │  ║
║  │                                              │    Procedure exec    │ │  ║
║  │                                              │    claude-haiku      │ │  ║
║  │                                              │    ○ idle            │ │  ║
║  │                                              │                      │ │  ║
║  │                                              │  ✕ supervisor        │ │  ║
║  │                                              │    Review & approve  │ │  ║
║  │                                              │    claude-opus       │ │  ║
║  │                                              │    ✕ failed          │ │  ║
║  │                                              │                      │ │  ║
║  │                                              │  ┌────────────────┐ │ │  ║
║  │                                              │  │ + Spawn Agent  │ │ │  ║
║  │                                              │  └────────────────┘ │ │  ║
║  │                                              └──────────────────────┘ │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  Show me alarms for building 3│                                 │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │  [Terminal] [●AI]  ◈ high │  /cmd  @entity  📎  🎤       [Send]     │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Visual: Voice Transcript → Submitted Message

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 5c: Voice → Submitted — Transcript becomes input text            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  ┌─ YOU ── 🎤 ───────────────────────────────────────────────────┐   │  ║
║  │  │  Show me alarms for building 3                                 │   │  ║
║  │  │  ↑ voice-originated message — mic icon in header               │   │  ║
║  │  └────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                       │  ║
║  │  ┌─ ASSISTANT → planner ────────────────────── streaming ── ┐        │  ║
║  │  │  I found 8 active alarms for Building 3:                  │        │  ║
║  │  │  ...                                                       │        │  ║
║  │  └────────────────────────────────────────────────────────────┘        │  ║
║  │                                                                       │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  │                                                              │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │  [Terminal] [●AI]  ◈ high │  /cmd  @entity  📎  🎤       [Send]     │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Voice Input Architecture

### Web Speech API Integration

```typescript
// src/components/cop/hooks/useVoiceInput.ts

interface VoiceInputState {
  /** Is speech recognition active? */
  isRecording: boolean
  /** Interim transcript (live, not final) */
  interimTranscript: string
  /** Final transcript (confirmed by engine) */
  finalTranscript: string
  /** Audio level (0-1) for visualization */
  audioLevel: number
  /** Error state */
  error: string | null
  /** Is Web Speech API available? */
  isAvailable: boolean
}

interface UseVoiceInputReturn {
  state: VoiceInputState
  /** Start recording */
  start: () => void
  /** Stop recording and return final transcript */
  stop: () => string
  /** Cancel recording, discard transcript */
  cancel: () => void
}
```

### Voice Flow

```
1. User clicks 🎤 button in ChatInput.Toolbar
   └── OR presses Ctrl+Shift+V (keyboard shortcut)

2. VoiceInputOverlay appears above TextArea
   └── Shows: recording indicator, live transcript, audio level bars
   └── 🎤 button turns red, pulses

3. Web Speech API (SpeechRecognition) starts
   └── interimResults: true (shows partial words)
   └── continuous: true (keeps listening until stopped)
   └── lang: 'en-US' (configurable)
   └── Each interim result → updates interimTranscript
   └── Each final result → appends to finalTranscript

4. Audio visualization (optional, requires AudioContext)
   └── getUserMedia() → analyser node → frequency data
   └── Rendered as small waveform bar: ▁▂▃▅▆▇▆▅▃▂▁

5. User clicks [⏹ Stop] or pauses speaking (auto-stop after 2s silence)
   └── Final transcript inserted into ChatInput.TextArea
   └── VoiceInputOverlay dismissed
   └── User can edit text before sending

6. User clicks [Send] (or Enter)
   └── Normal submission flow
   └── UserBlockV3 created with: voiceOriginated: true
   └── UserBlock renders with 🎤 icon in header

7. If user clicks [Cancel]:
   └── Transcript discarded
   └── VoiceInputOverlay dismissed
   └── No text inserted
```

### Graceful Degradation

```
if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
  // Web Speech API not available
  // VoiceButton renders as disabled with tooltip: "Speech recognition not available in this browser"
  // No error, just graceful disable
}

// Works in: Chrome, Edge, Safari (webkit prefix)
// Does NOT work in: Firefox (as of 2026-02)
// Tauri/WebKitGTK: Depends on WebKitGTK version + system speech services
```

## Agent Selector Architecture

### Component: ChatInput.AgentSelector (new compound child)

```typescript
// Added to ChatInput compound component

interface AgentSelectorProps {
  className?: string
}

function AgentSelector({ className }: AgentSelectorProps) {
  const { activeAgent, setActiveAgent } = useChatInput()  // extended context
  const agents = useAtomValue(agentListAtom)               // from conductor/atoms
  const activeCount = useAtomValue(activeAgentCountAtom)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("flex items-center gap-1", className)}>
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>agent:</span>
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} className="font-mono font-medium">
            {activeAgent?.spec.name ?? 'none'}
          </span>
          <AgentStatusDot status={activeAgent?.status ?? 'idle'} size="xs" />
          <ChevronDown size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <AgentDropdownList
          agents={agents}
          selectedId={activeAgent?.id}
          onSelect={setActiveAgent}
        />
      </PopoverContent>
    </Popover>
  )
}
```

### Agent Dropdown Item

```
AgentDropdownItem
├── status dot: ● working / ○ idle / ✕ failed (AgentStatusDot)
├── name: "planner" (font-mono, 14px)
├── role: "Strategy & triage" (muted, 12px)
├── model: "claude-sonnet-4" (muted, 12px)
├── status text: "● working" / "○ idle" / "✕ failed" (colored, 12px)
└── on click: setActiveAgent(agentId) → routes next message to this agent
```

### Agent Message Routing

```
User selects agent "analyst" in dropdown
User types: "Correlate temperature readings for the last 24 hours"
User clicks [Send]

1. chatDispatch reads activeAgentAtom → "analyst"

2. Routes message to analyst agent:
   ├── IF agent has AI backend (AICoreService):
   │   └── BlockTerminalService.executeAIQuery(prompt, { agentContext: analyst.spec })
   │   └── Creates AIResponseBlockV3 with streamRef
   │   └── AI response attributed to "analyst" in block header
   │
   └── IF agent has PTY backend (ConductorService):
       └── ConductorService.sendToAgent(agentId, prompt)
       └── Agent's PTY output streams as AgentOutputBlockV3

3. Response block shows: "ASSISTANT → analyst" in header
   └── Indicates which agent responded
   └── Different agents may have different system prompts, tools, models
```

### Agent Context in System Message

When routing to a specific agent, the system message includes:

```typescript
const agentSystemContext = `
You are the "${agent.spec.name}" agent in the COP system.
Role: ${agent.spec.role}
Capabilities: ${agent.spec.capabilities?.join(', ')}
Model: ${agent.spec.model}

Current context:
- Active panel: ${focusedPanel}
- Referenced entities: ${contextChips.map(c => c.label).join(', ')}
- Time: ${new Date().toISOString()}

Available tools: ${agent.spec.tools?.map(t => t.name).join(', ')}
`
```

### Spawn Agent

The "+" button at the bottom of the agent dropdown:

```
User clicks [+ Spawn Agent]
└── Opens inline form:
    ├── Name: [text input]
    ├── Role: [dropdown: planner, analyst, operator, supervisor, custom]
    ├── Model: [dropdown: claude-sonnet-4, claude-haiku, claude-opus]
    └── [Create]
        └── ConductorService.spawnAgent(spec)
        └── New agent appears in dropdown
        └── Auto-selected as active agent
```

## Dataplane Attachment (📎 Button)

The attachment button enables cross-panel data sharing:

### Visual: Attachment Context Menu

```
┌─── ATTACH FROM ─────────────────────────────────────┐
│                                                       │
│  📍 Map Selection                                     │
│     Current viewport: Plant Alpha, Building 3         │
│     3 assets visible                                  │
│                                                       │
│  ⚠️ Alarm Panel                                      │
│     8 active alarms (3 critical, 5 warning)           │
│     Selected: ALM-TMP-041-HIGH                        │
│                                                       │
│  📊 Telemetry Panel                                   │
│     Time range: Last 24h                              │
│     4 sensors displayed                               │
│                                                       │
│  🔧 Work Order Panel                                  │
│     Filter: overdue, Plant Alpha                      │
│     12 work orders matching                           │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Attachment Flow

```
1. User clicks 📎 button
   └── AttachmentPopup reads from panelContextAtom [NEW]
   └── Shows all active FoldablePanels with their current selection/filter

2. User clicks "📍 Map Selection"
   └── Creates attachment chip: { type: 'attachment', source: 'map', data: { viewport, assets } }
   └── Chip shows: [📍 Plant Alpha · 3 assets]

3. On submit:
   └── Attachment data serialized into AI context
   └── AI sees: "User has attached: Map selection showing Plant Alpha, Building 3 with assets PUMP-042-A, COMP-C2, TANK-T1"
   └── AI can reference these assets in its response
```

### panelContextAtom (New)

```typescript
// src/components/cop/atoms/panelContextAtom.ts

interface PanelContext {
  /** Which FoldablePanel is currently focused */
  focusedPanelId: string | null
  /** All active panels and their current state */
  panels: Map<string, {
    panelId: string
    type: 'map' | 'alarm' | 'telemetry' | 'work-order' | 'chat' | 'custom'
    /** Current selection (entity IDs, viewport, filter) */
    selection: unknown
    /** Human-readable summary */
    summary: string
  }>
}

export const panelContextAtom = Atom.make<PanelContext>({
  focusedPanelId: null,
  panels: new Map(),
})
```

## Design Token Compliance

| Element | Token | Value |
|---------|-------|-------|
| Voice transcript text | `--tmnl-text-base` | 16px — primary reading |
| "Recording..." label | `--tmnl-text-sm` | 14px |
| Audio level bars | n/a | 16px height, monospace block chars |
| Agent name in dropdown | `--tmnl-text-sm` | 14px, font-mono, bold |
| Agent role description | `--tmnl-text-xs` | 12px, muted |
| Agent model label | `--tmnl-text-xs` | 12px, muted, font-mono |
| Agent status text | `--tmnl-text-xs` | 12px, colored per status |
| "agent:" label in header | `--tmnl-text-xs` | 12px |
| Attachment panel name | `--tmnl-text-sm` | 14px |
| Attachment summary | `--tmnl-text-xs` | 12px, muted |
| border-radius | none | 0 — RVN brutalist |
| 🎤 button recording state | red pulse | `animation: pulse 1s ease-in-out infinite` |
