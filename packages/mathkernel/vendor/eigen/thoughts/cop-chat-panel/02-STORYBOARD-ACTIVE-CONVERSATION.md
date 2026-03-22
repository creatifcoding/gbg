# STORYBOARD 2: Active Conversation — Mixed Block Types

> Val's architecture note · COP Chat Panel · Hot Path — Multiple Block Types Interleaved
> Questionnaire sources:
>   - `chat-panel-identity` → ALL 6 systems merge
>   - `chat-panel-features` → "i want all of those different options — rich, and break out"
>   - `chat-panel-agent-model` → "Agent streams into chat — agent output becomes chat blocks"

## Visual

```
╔════════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 2: Active Conversation — Mixed Block Types                        ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ┌─ CHAT ──────────────────────────────────────────────────── ▾ ───────────┐  ║
║  │  ◆ COP ASSISTANT                                agent: planner ▼  │ │  ║
║  ├─────────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                         │  ║
║  │  ┌─ YOU ────────────────────────────────────────────────────────────┐   │  ║
║  │  │  Show me overdue work orders for Plant Alpha                     │   │  ║
║  │  └──────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                         │  ║
║  │  ┌─ ASSISTANT ───────────────────────────────────── streaming ── ┐     │  ║
║  │  │  Found 12 overdue work orders. Here's a summary:              │     │  ║
║  │  │                                                                │     │  ║
║  │  │  ┌─ ToolCall: query_work_orders ──────── ✓ ──────────────┐   │     │  ║
║  │  │  │                                                         │   │     │  ║
║  │  │  │  ╔════════════════════════════════════════════════════╗ │   │     │  ║
║  │  │  │  ║  OVERDUE · 12 items                  [▶ Panel]    ║ │   │     │  ║
║  │  │  │  ╠════════════════════════════════════════════════════╣ │   │     │  ║
║  │  │  │  ║                                                    ║ │   │     │  ║
║  │  │  │  ║  ■ WO-4821  EMERGENCY   Pump seal failure         ║ │   │     │  ║
║  │  │  │  ║    ▰▰▰▰▰▰▰▰ overdue 14d · Plant Alpha · Line 3  ║ │   │     │  ║
║  │  │  │  ║                                                    ║ │   │     │  ║
║  │  │  │  ║  ■ WO-4819  URGENT      Valve calibration         ║ │   │     │  ║
║  │  │  │  ║    ▰▰▰▰▰▰▱▱ overdue 7d · Plant Alpha · Line 1   ║ │   │     │  ║
║  │  │  │  ║                                                    ║ │   │     │  ║
║  │  │  │  ║  ■ WO-4815  HIGH        Bearing replacement       ║ │   │     │  ║
║  │  │  │  ║    ▰▰▰▰▱▱▱▱ overdue 3d · Plant Alpha · Line 2   ║ │   │     │  ║
║  │  │  │  ║                                                    ║ │   │     │  ║
║  │  │  │  ║  ... 9 more                          [Show all]   ║ │   │     │  ║
║  │  │  │  ╚════════════════════════════════════════════════════╝ │   │     │  ║
║  │  │  │        ↑ json-render catalog: WorkOrderListCard (RVN)  │   │     │  ║
║  │  │  └─────────────────────────────────────────────────────────┘   │     │  ║
║  │  │                                                                │     │  ║
║  │  │  Three are emergency priority. Shall I escalate WO-4821?      │     │  ║
║  │  └────────────────────────────────────────────────────────────────┘     │  ║
║  │                                                                         │  ║
║  │  ┌─ AGENT: analyst ─── ● working ──────────── streaming ──────────┐   │  ║
║  │  │  > Querying sensor correlations for WO-4821...                  │   │  ║
║  │  │  > Temp sensor TMP-041: 127°C (threshold: 95°C) ■ CRITICAL     │   │  ║
║  │  │  > Vibration sensor VIB-019: 4.2g (threshold: 3.5g) ■ WARNING  │   │  ║
║  │  │  > Pressure sensor PRS-008: 82 bar (nominal range) ■ OK        │   │  ║
║  │  │  > ↑ agent output streamed line-by-line as AgentOutputBlockV3   │   │  ║
║  │  └────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                         │  ║
║  ├─────────────────────────────────────────────────────────────────────────┤  ║
║  │  context: [📍 Plant Alpha]  [🔧 WO-4821]                               │  ║
║  │  ┌───────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  @WO-4821 escalate to supervisor Martinez│                   ⏎  │  │  ║
║  │  └───────────────────────────────────────────────────────────────────┘  │  ║
║  │  [Terminal] [● AI]  ◈ med  │  /esc  @WO  📎map-sel  🎤     [Send]    │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

## Block Type Anatomy

This storyboard shows **5 distinct block types** interleaved in a single conversation:

### Block 1: User Prompt Block (UserBlockV3 — new)

```
┌─ YOU ──────────────────────────────────────────┐
│ Show me overdue work orders for Plant Alpha     │
└─────────────────────────────────────────────────┘
```

- **Schema**: `UserBlockV3 = Schema.TaggedStruct('user', { id, prompt, contextChips?, mentionedEntities?, timestamp })`
- **Renderer**: Simple text with RVN card styling. Left-aligned, muted header "YOU".
- **Data source**: Created when ChatInput.onSubmit fires.
- **Context chips**: If user had `[📍 Plant Alpha]` pinned, stored in block.contextChips[].

### Block 2: AI Response Block (AIResponseBlockV3 — existing)

```
┌─ ASSISTANT ─────────────────── streaming ┐
│ Found 12 overdue work orders...           │
│ [ToolCall embedded inline]                │
│ Three are emergency priority...           │
└───────────────────────────────────────────┘
```

- **Schema**: `AIResponseBlockV3` from `terminal/v3/schemas/blocks.ts`
- **Content derivation**: `useAIBlockContent(block)` → reads `streamStateByIdAtom(block.streamRef.requestId)` from ai-core
- **Streaming indicator**: "streaming" badge in header, animated dots
- **Tool calls**: Rendered inline using ToolCallView registry (see Block 3)
- **Wiring**: BlockTerminalService.executeAIQuery → creates AIResponseBlockV3 → streamRef → ai-core

### Block 3: Tool Call Result — json-render Catalog (JsonRenderBlockV3 — existing, extended)

```
╔════════════════════════════════════════════╗
║  OVERDUE · 12 items          [▶ Panel]    ║
╠════════════════════════════════════════════╣
║ ■ WO-4821  EMERGENCY  Pump seal failure   ║
║ ■ WO-4819  URGENT     Valve calibration   ║
║ ... 9 more                   [Show all]   ║
╚════════════════════════════════════════════╝
```

- **This is the CRITICAL innovation**: Tool results render as json-render catalog components
- **Schema**: `JsonRenderBlockV3` from `terminal/v3/schemas/json-render-block.ts`
- **Catalog**: `iiot-domain-catalog` (NEW) registered in CatalogService
  - Component type: `WorkOrderListCard`
  - Props schema: `{ items: WorkOrderSummary[], title, count, filterStatus }`
  - Renderer: RvnCard with priority badges, overdue bars, [▶ Panel] breakout button
- **Registration**: ToolCallView registry maps `query_work_orders` → `WorkOrderToolView`
  - `WorkOrderToolView` renders json-render `<UIRenderer>` with `iiot-domain-catalog`
- **[▶ Panel] button**: Spawns breakout FoldablePanel (see Storyboard 3)
- **[Show all] button**: Expands inline to show all 12 items

### Block 4: Agent Output Block (AgentOutputBlockV3 — new)

```
┌─ AGENT: analyst ─── ● working ─── streaming ┐
│ > Querying sensor correlations for WO-4821... │
│ > Temp sensor TMP-041: 127°C ■ CRITICAL       │
│ > Vibration sensor VIB-019: 4.2g ■ WARNING     │
└────────────────────────────────────────────────┘
```

- **Schema**: `AgentOutputBlockV3 = Schema.TaggedStruct('agent-output', { id, agentId, agentName, agentRole, lines: Schema.Array(AgentOutputLine), isStreaming, timestamp })`
- **Content source**: Conductor agent's PTY session output stream
- **Wiring path**:
  1. ConductorService → agentAtom(agentId) → agent.sessionId
  2. TerminalSessionManager → session output Stream<string>
  3. Stream subscription → each line appended to AgentOutputBlockV3.lines
  4. chatBlocksAtom updated → React re-renders
- **Visual**: Monospace, prefixed with `>`, color-coded severity badges
- **Agent identity**: Header shows agent name + role from `agentAtom(id).spec`
- **Status dot**: `AgentStatusDot` component from conductor — ● working / ○ idle / ✕ failed

### Block 5: Context Chips (above input — existing ChatInput feature, extended)

```
context: [📍 Plant Alpha]  [🔧 WO-4821]
```

- **Existing**: ChatInput.ContextChips renders `contextChips: ContextChip[]`
- **New COP extensions**:
  - Entity chips: `{ type: 'entity', entityType: 'work-order', entityId: 'WO-4821', label: 'WO-4821' }`
  - Location chips: `{ type: 'location', locationId: 'plant-alpha', label: 'Plant Alpha' }`
  - Time range chips: `{ type: 'time-range', from: Date, to: Date, label: 'Last 24h' }`
- **Chip lifecycle**: Created by @-mention → persists across messages → removable via X button

## Component Tree (Active State)

```
FoldablePanel (panelId="cop-chat")
├── Header: "COP ASSISTANT" + AgentSelector(value="planner")
├── Content
│   └── ChatBlockList
│       ├── UserBlock
│       │   └── prompt: "Show me overdue work orders for Plant Alpha"
│       │   └── contextChips: [{type:'location', label:'Plant Alpha'}]
│       │
│       ├── AIResponseBlock
│       │   ├── useAIBlockContent(block) → streamState
│       │   │   ├── text: "Found 12 overdue work orders..."
│       │   │   ├── status: 'streaming' | 'complete'
│       │   │   └── toolCalls: [{name:'query_work_orders', result:{...}}]
│       │   │
│       │   └── ToolCallView (registered: 'query_work_orders' → WorkOrderToolView)
│       │       └── UIRenderer (json-render)
│       │           ├── catalog: iiot-domain-catalog
│       │           ├── element: { type: 'WorkOrderListCard', props: {items, count} }
│       │           └── children:
│       │               ├── WorkOrderRow (WO-4821, EMERGENCY)
│       │               ├── WorkOrderRow (WO-4819, URGENT)
│       │               ├── WorkOrderRow (WO-4815, HIGH)
│       │               └── ShowMoreButton (9 more → expand)
│       │
│       └── AgentOutputBlock (analyst)
│           ├── header: AgentStatusDot(working) + "analyst" + "● working"
│           └── lines: [line1, line2, line3, line4] (streaming)
│
├── ChatInputBar
│   ├── ChatInput.ContextChips
│   │   ├── [📍 Plant Alpha] (location chip, pinned)
│   │   └── [🔧 WO-4821] (entity chip, from @-mention)
│   ├── ChatInput.TextArea
│   │   └── value: "@WO-4821 escalate to supervisor Martinez"
│   └── ChatInput.Toolbar
│       ├── [Terminal] [● AI] (mode: 'ai', active indicator)
│       ├── ◈ med (thinking level: medium)
│       ├── /esc @WO 📎map-sel 🎤 (toolbar actions)
│       └── [Send]
└── (FoldablePanel.Settings collapsed)
```

## Atom Topology (Hot Path)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SUBSCRIPTION GRAPH — ACTIVE CONVERSATION                                 │
│                                                                            │
│  chatBlocksAtom ← [UserBlock, AIResponseBlock, AgentOutputBlock]          │
│  ├── ChatBlockList subscribes → re-renders on new block / update          │
│  │   ├── per UserBlock:                                                    │
│  │   │   └── pure render (no atom subscription)                           │
│  │   │                                                                     │
│  │   ├── per AIResponseBlock:                                              │
│  │   │   └── useAIBlockContent(block)                                     │
│  │   │       └── subscribes: streamStateByIdAtom(block.streamRef.reqId)   │
│  │   │           ├── .text → prose content (streamed tokens)              │
│  │   │           ├── .thinking → thinking content (if level > none)       │
│  │   │           ├── .toolCalls → array of tool invocations               │
│  │   │           │   └── per toolCall:                                     │
│  │   │           │       └── ToolCallView registry lookup                 │
│  │   │           │           └── WorkOrderToolView                        │
│  │   │           │               └── UIRenderer (json-render)             │
│  │   │           │                   └── subscribes: catalogAtom          │
│  │   │           └── .status → 'idle'|'streaming'|'complete'|'error'     │
│  │   │                                                                     │
│  │   └── per AgentOutputBlock:                                             │
│  │       └── subscribes: agentAtom(block.agentId) → agent status          │
│  │       └── block.lines → rendered directly (block is source of truth)   │
│  │                                                                         │
│  activeAgentAtom ← "planner"                                               │
│  ├── AgentSelector subscribes → shows selected agent                      │
│  └── chatDispatch reads → routes messages to correct agent                │
│                                                                            │
│  agentListAtom ← [...agents from ConductorService]                       │
│  ├── AgentSelector subscribes → populates dropdown                        │
│  └── AgentOutputBlock header uses agentAtom(id) for name/role            │
│                                                                            │
│  panelContextAtom ← { focusedPanel: 'alarm-panel', ... }                 │
│  └── ChatInputBar subscribes → auto-inject context when focused          │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Message Submission → Block Creation → Rendering

```
User types: "Show me overdue work orders for Plant Alpha"
User clicks [Send]

1. ChatInput.onSubmit fires
   └── params: { value, mode: 'ai', thinkingLevel: 'medium', contextChips: [...] }

2. chatDispatch(params) [new COP dispatch atom]
   ├── Creates UserBlockV3 → pushes to chatBlocksAtom
   │   └── { _tag: 'user', prompt: value, contextChips, timestamp: new Date() }
   │
   ├── Reads activeAgentAtom → agentId = "planner"
   │
   ├── Constructs system message with context:
   │   └── "You are a COP assistant. Current context: Plant Alpha. Focused panel: alarm-panel."
   │   └── "Available tools: query_work_orders, acknowledge_alarm, get_sensor_readings..."
   │
   └── Calls BlockTerminalService.executeAIQuery(prompt, systemMessage)
       └── Creates AIResponseBlockV3 with streamRef
       └── Pushes to chatBlocksAtom
       └── ai-core begins streaming → streamStateByIdAtom updates live

3. AI response streams in (ai-core SSEAdapter or fetch)
   └── Token by token: text accumulates in streamStateByIdAtom(requestId).text
   └── Tool call detected: { name: 'query_work_orders', args: { status: 'overdue', plant: 'alpha' } }
   │
   ├── Tool execution (Effect fiber):
   │   └── IIoTService.findWorkOrders(filter) → unified IIoT HttpApi query/entity flow
   │   └── (e.g., GET /api/queries/workorders + workorder entity routes)
   │   └── Returns Array<WorkOrderModel>
   │   └── Tool result serialized as JSON
   │
   └── Tool result rendered via ToolCallView registry:
       └── 'query_work_orders' → WorkOrderToolView
       └── WorkOrderToolView wraps result in json-render UIRenderer
           └── catalog: iiot-domain-catalog
           └── element: { type: 'WorkOrderListCard', props: { items: [...12 WOs] } }
           └── Rendered: RvnCard with priority badges, overdue bars

4. Conductor agent ("analyst") auto-triggered
   └── ConductorService observes tool result
   └── Spawns/drives analyst agent with: "Correlate sensors for WO-4821"
   └── Agent's PTY output stream:
       └── Stream subscription → each line creates/updates AgentOutputBlockV3
       └── Line by line: "Querying sensor correlations..." → "Temp sensor TMP-041: 127°C"
       └── chatBlocksAtom updated → React re-renders the block

5. User sees:
   └── Their message (UserBlock)
   └── AI response streaming (AIResponseBlock)
   └── Tool result: work order list as rich RVN card (JsonRenderBlock via ToolCallView)
   └── Agent analyst output streaming (AgentOutputBlock)
   └── Context chips updated: [📍 Plant Alpha] [🔧 WO-4821]
```

## json-render Catalog: IIoT Domain Components

The new `iiot-domain-catalog` registers these component types for AI tool output:

| Component Type | Props Schema | Renders As | Use Case |
|----------------|-------------|------------|----------|
| `WorkOrderListCard` | `{ items: WO[], title, count, filterStatus }` | RvnCard + priority rows + overdue bars | Tool: query_work_orders |
| `WorkOrderDetailCard` | `{ workOrder: WO, auditTrail: Event[], sensors: Sensor[] }` | Full detail panel with timeline | Breakout / drill-down |
| `AlarmSummaryCard` | `{ alarms: Alarm[], severityCounts, ackStatus }` | RvnCard + severity badges + counts | Tool: get_active_alarms |
| `SensorReadingsChart` | `{ sensorId, readings: Reading[], thresholds }` | ECharts sparkline + threshold lines | Tool: get_sensor_readings |
| `AssetTreeView` | `{ assets: Asset[], hierarchy, selectedId }` | Nested tree with status indicators | Tool: get_asset_hierarchy |
| `TimelineView` | `{ events: Event[], dateRange, entityFilter }` | Horizontal timeline + event cards | Tool: get_event_timeline |

These are registered via:

```typescript
// src/lib/json-render/catalog/iiot-domain-catalog.tsx
export const iiotDomainCatalog: DomainCatalog = {
  domain: 'iiot',
  components: {
    WorkOrderListCard: {
      schema: WorkOrderListCardPropsSchema,
      renderer: WorkOrderListCardRenderer,
      description: 'List of work orders with priority badges and overdue indicators',
      hasChildren: false,
      defaultEntrance: { type: 'fade-slide', direction: 'up', duration: 200 },
    },
    // ... more components
  },
}
```

## ToolCallView Registry Extensions

```typescript
// src/components/cop/tool-views/index.ts
import { registerToolComponent } from '@/lib/terminal/v3/components/ToolCallView/registry'

// Register COP-specific tool renderers
registerToolComponent('query_work_orders', WorkOrderToolView)
registerToolComponent('acknowledge_alarm', AlarmAckToolView)
registerToolComponent('get_sensor_readings', SensorReadingsToolView)
registerToolComponent('get_asset_hierarchy', AssetTreeToolView)
registerToolComponent('get_event_timeline', TimelineToolView)
registerToolComponent('escalate_work_order', EscalateToolView)
```

## Agent Output Stream Architecture

```
ConductorService                    COP Chat Panel
─────────────────                   ──────────────
  agentAtom(id)                       
  │ .sessionId ─────┐                
                     │                
  TerminalSessionMgr │                
  │ .getSession() ◄──┘               
  │ .output: Stream<string>           
  │                                   
  └── Stream.runForEach(line => {     
        // Create or update AgentOutputBlock
        const block = findOrCreate('agent-output', agentId)
        block.lines.push({
          text: line,
          timestamp: new Date(),
          severity: parseSeverity(line), // extract ■ CRITICAL etc.
        })
        Atom.set(chatBlocksAtom, [...blocks]) // trigger re-render
      })                              
```

## Streaming Indicator States

| State | Visual | Source |
|-------|--------|--------|
| AI streaming | `─── streaming ──` badge, animated dots | `streamState.status === 'streaming'` |
| AI complete | badge removed, checkmark | `streamState.status === 'complete'` |
| AI error | `─── error ──` red badge | `streamState.status === 'error'` |
| Agent working | `● working` green dot + "streaming" | `agentAtom(id).status === 'working'` |
| Agent idle | `○ idle` gray dot | `agentAtom(id).status === 'idle'` |
| Agent failed | `✕ failed` red dot | `agentAtom(id).status === 'failed'` |
| Tool executing | spinner + tool name | `toolCall.status === 'executing'` |
| Tool complete | ✓ checkmark + tool name | `toolCall.status === 'complete'` |
| Tool error | ✕ error + tool name + message | `toolCall.status === 'error'` |
