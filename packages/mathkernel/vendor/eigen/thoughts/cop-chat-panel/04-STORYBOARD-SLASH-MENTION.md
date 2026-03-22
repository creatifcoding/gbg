# STORYBOARD 4: Slash Commands & @-mention Autocomplete

> Val's architecture note · COP Chat Panel · Command Palette + Entity Resolution
> Questionnaire source: `chat-panel-composition` → all 6 missing features selected including
> "Slash commands — /status, /alarm, /navigate, /query" and "Entity @-mention — reference work orders, alarms, sensors by ID"

## Visual: Slash Command Autocomplete

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 4a: Slash Command Autocomplete                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ CHAT ────────────────────────────────────────────────── ▾ ───────────┐  ║
║  │ ◆ COP ASSISTANT                              agent: planner ▼  │ │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  (previous blocks above...)                                           │  ║
║  │                                                                       │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  ┌─── SLASH COMMANDS ─────────────────────────────────────────────┐  │  ║
║  │  │                                                                 │  │  ║
║  │  │  ┌──────────────────────────────────────────────────────────┐  │  │  ║
║  │  │  │ ▶ /status         System status overview                 │  │  │  ║
║  │  │  │   /status:wo      Work order status summary              │  │  │  ║
║  │  │  │   /status:alm     Alarm status by severity               │  │  │  ║
║  │  │  │   /status:sensor  Sensor health dashboard                │  │  │  ║
║  │  │  ├──────────────────────────────────────────────────────────┤  │  │  ║
║  │  │  │   /start          Start a work order                     │  │  │  ║
║  │  │  │   /stop           Stop/pause a work order                │  │  │  ║
║  │  │  └──────────────────────────────────────────────────────────┘  │  │  ║
║  │  │  ↑ filtered by "/sta" input prefix                             │  │  ║
║  │  │  ↑ arrow keys navigate, Enter selects, Esc dismisses          │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                       │  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  /sta│                                                          │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │  [Terminal] [AI]  ◈ none  │  /cmd  @entity  📎  🎤       [Send]     │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Visual: @-mention Entity Autocomplete

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 4b: @-mention Entity Autocomplete                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ CHAT ────────────────────────────────────────────────── ▾ ───────────┐  ║
║  │ ◆ COP ASSISTANT                              agent: planner ▼  │ │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  (previous blocks above...)                                           │  ║
║  │                                                                       │  ║
║  ├───────────────────────────────────────────────────────────────────────┤  ║
║  │                                                                       │  ║
║  │  ┌─── ENTITIES ───── @WO-48 ──────────────────────────────────────┐  │  ║
║  │  │                                                                 │  │  ║
║  │  │  ┌──────────────────────────────────────────────────────────┐  │  │  ║
║  │  │  │                                                          │  │  │  ║
║  │  │  │  ▶ @WO-4821  Pump seal failure           ■ EMERGENCY    │  │  │  ║
║  │  │  │    Plant Alpha · Line 3 · STARTED · 14d overdue         │  │  │  ║
║  │  │  │                                                          │  │  │  ║
║  │  │  │    @WO-4819  Valve calibration            ■ URGENT      │  │  │  ║
║  │  │  │    Plant Alpha · Line 1 · SUBMITTED · 7d overdue        │  │  │  ║
║  │  │  │                                                          │  │  │  ║
║  │  │  │    @WO-4815  Bearing replacement          ■ HIGH        │  │  │  ║
║  │  │  │    Plant Alpha · Line 2 · APPROVED · 3d overdue         │  │  │  ║
║  │  │  │                                                          │  │  │  ║
║  │  │  │    @WO-4802  Filter replacement           ■ MEDIUM      │  │  │  ║
║  │  │  │    Plant Beta · Line 1 · CREATED · on schedule          │  │  │  ║
║  │  │  │                                                          │  │  │  ║
║  │  │  └──────────────────────────────────────────────────────────┘  │  │  ║
║  │  │  ↑ fuzzy search by ID + title                                  │  │  ║
║  │  │  ↑ shows entity type icon, status badge, location, age         │  │  ║
║  │  │  ↑ selecting inserts entity chip into input                    │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                       │  ║
║  │  context: [🔧 WO-4821]                        ← chip from selection  │  ║
║  │  ┌─────────────────────────────────────────────────────────────────┐  │  ║
║  │  │  escalate @WO-48│ to supervisor Martinez                        │  │  ║
║  │  └─────────────────────────────────────────────────────────────────┘  │  ║
║  │  [Terminal] [●AI]  ◈ med  │  /cmd  @WO  📎  🎤           [Send]     │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Visual: Multi-type @-mention (Alarms, Sensors)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 4c: Multi-type @-mention — Grouped by entity type                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─── ENTITIES ───── @TMP ────────────────────────────────────────────┐    ║
║  │                                                                     │    ║
║  │  SENSORS                                                            │    ║
║  │  ┌──────────────────────────────────────────────────────────────┐  │    ║
║  │  │  ▶ @TMP-041  Temperature · Pump 042-A       127°C ■ CRIT   │  │    ║
║  │  │    @TMP-039  Temperature · Pump 041-B        84°C ■ OK     │  │    ║
║  │  │    @TMP-044  Temperature · Compressor C2     91°C ■ WARN   │  │    ║
║  │  └──────────────────────────────────────────────────────────────┘  │    ║
║  │                                                                     │    ║
║  │  ALARMS                                                             │    ║
║  │  ┌──────────────────────────────────────────────────────────────┐  │    ║
║  │  │    @ALM-TMP-041-HIGH  Temp high on PUMP-042-A  ■ ACTIVE    │  │    ║
║  │  │    @ALM-TMP-044-WARN  Temp warning C2          ■ ACTIVE    │  │    ║
║  │  └──────────────────────────────────────────────────────────────┘  │    ║
║  │                                                                     │    ║
║  │  ↑ grouped by entity type: sensors, alarms, work orders, assets   │    ║
║  │  ↑ fuzzy matches across all types simultaneously                   │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Slash Command System Architecture

### Command Registry (Effect.Service pattern)

```typescript
// src/components/cop/services/SlashCommandRegistry.ts

import { Context, Effect, Layer } from 'effect'
import { Schema } from 'effect'

// Command definition
const SlashCommandDef = Schema.Struct({
  /** Command name (e.g., "status") */
  name: Schema.String,
  /** Optional sub-command (e.g., "wo" in /status:wo) */
  subCommand: Schema.optional(Schema.String),
  /** Human-readable description */
  description: Schema.String,
  /** Category for grouping in autocomplete */
  category: Schema.Literal('query', 'action', 'navigation', 'system'),
  /** Does this command need arguments? */
  requiresArgs: Schema.Boolean,
  /** Argument pattern (for help text) */
  argsPattern: Schema.optional(Schema.String),
})

// Command result
const SlashCommandResult = Schema.TaggedStruct('slash-result', {
  command: Schema.String,
  success: Schema.Boolean,
  /** Rendered as a block in chat */
  output: Schema.Unknown,
  /** Optional entity IDs affected */
  affectedEntities: Schema.optional(Schema.Array(Schema.String)),
})

// Service interface
interface SlashCommandRegistryShape {
  /** Register a command handler */
  register(def: SlashCommandDef, handler: (args: string) => Effect.Effect<SlashCommandResult>): void
  /** Execute a command */
  execute(input: string): Effect.Effect<SlashCommandResult>
  /** Search commands by prefix */
  search(prefix: string): SlashCommandDef[]
  /** Get all registered commands */
  all(): SlashCommandDef[]
}

class SlashCommandRegistry extends Context.Tag('cop/SlashCommandRegistry')<
  SlashCommandRegistry,
  SlashCommandRegistryShape
>() {}
```

### Built-in Commands

| Command | Category | Args | Description | Implementation |
|---------|----------|------|-------------|----------------|
| `/status` | query | none | System overview — agent count, alarm counts, WO stats | Reads conductor + IIoT atoms |
| `/status:wo` | query | `[filter]` | Work order summary — counts by status/priority | `IIoTService.getWorkOrderStats()` |
| `/status:alm` | query | `[severity]` | Alarm summary — active by severity | `IIoTService.getAlarmStats()` |
| `/status:sensor` | query | `[asset]` | Sensor health — readings by asset | `IIoTService.getSensorHealth()` |
| `/alarm` | query | `[filter]` | Active alarms list | `IIoTService.findAlarms(filter)` |
| `/alarm:ack` | action | `<alarm-id>` | Acknowledge alarm | `IIoTService.acknowledgeAlarm(id)` |
| `/start` | action | `<wo-id>` | Start work order | `IIoTService.transitionWorkOrder(id, 'start')` |
| `/stop` | action | `<wo-id>` | Pause work order | `IIoTService.transitionWorkOrder(id, 'pause')` |
| `/close` | action | `<wo-id>` | Complete work order | `IIoTService.transitionWorkOrder(id, 'complete')` |
| `/escalate` | action | `<wo-id> [supervisor]` | Escalate work order | `IIoTService.escalateWorkOrder(id, opts)` |
| `/navigate` | navigation | `<location>` | Fly-to on map | `GeointService.flyTo(location)` |
| `/focus` | navigation | `<entity-id>` | Focus map + panels on entity | Dataplane cross-panel focus |
| `/clear` | system | none | Clear chat history | `Atom.set(chatBlocksAtom, [])` |
| `/agents` | system | none | List active conductor agents | Reads `agentListAtom` |
| `/help` | system | `[command]` | Show command help | Reads command registry |

### Command Execution Flow

```
User types: "/status:wo overdue"
User presses Enter

1. ChatInput.onSubmit receives: { value: "/status:wo overdue", mode: 'terminal' | 'ai' }

2. chatDispatch detects slash command prefix "/"
   └── Mode override: slash commands execute regardless of mode (ai or terminal)
   └── Parses: { command: "status", subCommand: "wo", args: "overdue" }

3. SlashCommandRegistry.execute("/status:wo overdue")
   └── Looks up: "status:wo" handler
   └── Runs handler Effect:
       └── IIoTService.getWorkOrderStats({ filter: 'overdue' })
       └── Returns: { total: 12, emergency: 3, urgent: 4, high: 5, overdue: true }

4. Creates SlashCommandBlockV3 in chatBlocksAtom:
   └── { _tag: 'slash-command', command: '/status:wo overdue', result: {...}, timestamp }

5. Block renders as a system card:
   ┌─ /status:wo ──────────────────────────────── ✓ ───┐
   │  WORK ORDERS: OVERDUE                               │
   │  ■ Emergency: 3  ■ Urgent: 4  ■ High: 5  Total: 12│
   │  Oldest overdue: WO-4821 (14 days)                  │
   └─────────────────────────────────────────────────────┘
```

### Autocomplete Popup Component

```
SlashCommandPopup
├── triggered by: "/" typed as first character in ChatInput.TextArea
├── positioned: above input bar (popover, floating)
├── filtered by: text after "/" (fuzzy match on name + description)
├── grouped by: category (query, action, navigation, system)
├── navigation: ↑↓ arrow keys, Enter to select, Esc to dismiss, Tab to complete
├── rendering:
│   ├── each item: icon + command name + description
│   ├── highlighted match characters (fuzzy)
│   ├── category headers (gray, uppercase, 12px)
│   └── max visible: 8 items, scrollable
└── on select:
    ├── replaces input text with: "/command "
    ├── if command.requiresArgs: cursor after space, awaiting args
    └── if !command.requiresArgs: auto-submit immediately
```

## @-mention System Architecture

### Entity Resolution Service

```typescript
// src/components/cop/services/EntityMentionService.ts

interface EntityMentionResult {
  /** Entity type */
  type: 'work-order' | 'alarm' | 'sensor' | 'asset'
  /** Entity ID (e.g., "WO-4821") */
  id: string
  /** Display label (e.g., "Pump seal failure") */
  label: string
  /** Status badge info */
  status: { text: string, severity: 'critical' | 'warning' | 'ok' | 'info' }
  /** Secondary info (location, age, etc.) */
  secondary: string
  /** Icon component */
  icon: ComponentType
}

interface EntityMentionServiceShape {
  /** Search entities by prefix across all types */
  search(query: string): Effect.Effect<EntityMentionResult[]>
  /** Resolve a specific entity by type + ID */
  resolve(type: string, id: string): Effect.Effect<EntityMentionResult | null>
}
```

### Data Sources for @-mention

| Entity Type | Prefix | Atom Source | Query Method |
|-------------|--------|------------|--------------|
| Work Orders | `@WO-` | `workOrderListAtom` (Fermion) | Fuzzy match on ID + title; hydrated via unified IIoT HttpApi |
| Alarms | `@ALM-` | `alarmListAtom` (Fermion, TBD) | Fuzzy match on alarm ID + description; hydrated via IIoT query endpoints |
| Sensors | `@TMP-`, `@VIB-`, `@PRS-`, `@FLW-` | `sensorListAtom` (Fermion) | Fuzzy match on sensor ID + name; hydrated via IIoT query endpoints |
| Assets | `@PUMP-`, `@COMP-`, `@TANK-` | `assetListAtom` (Fermion, TBD) | Fuzzy match on asset ID + name; hydrated via IIoT query endpoints |

### @-mention Insertion Mechanics

```
1. User types "@" in ChatInput.TextArea
   └── Triggers: EntityMentionPopup appears

2. User continues typing: "@WO-48"
   └── EntityMentionService.search("WO-48")
   └── Returns: [WO-4821, WO-4819, WO-4815, WO-4802] (fuzzy)
   └── Popup shows results grouped by entity type

3. User selects WO-4821 (Enter or click)
   └── TextArea: "@WO-48" replaced with entity token (styled inline)
   └── Context chip created: { type: 'entity', entityType: 'work-order', entityId: 'WO-4821', label: 'WO-4821' }
   └── Chip appears above TextArea in ChatInput.ContextChips

4. On submit:
   └── ChatInputSubmitParams includes:
       └── contextChips: [{ type: 'entity', entityType: 'work-order', entityId: 'WO-4821' }]
   └── AI receives system message with: "Referenced entities: WO-4821 (Pump seal failure, EMERGENCY, STARTED)"
   └── AI has full context without user needing to type details
```

### Autocomplete Popup Component

```
EntityMentionPopup
├── triggered by: "@" typed anywhere in ChatInput.TextArea
├── positioned: above cursor position (floating, caret-anchored)
├── filtered by: text after "@" (fuzzy across ID + title + description)
├── grouped by: entity type (WORK ORDERS, ALARMS, SENSORS, ASSETS)
├── navigation: ↑↓ arrow keys, Enter to select, Esc to dismiss
├── each item rendering:
│   ├── Row 1: icon + entityId + title + status badge
│   ├── Row 2: location + age/overdue + secondary info
│   └── highlighted match characters (fuzzy)
├── max visible: 6 items per group, 3 groups visible, scrollable
└── debounced: 150ms after last keystroke (prevents flicker on fast typing)
```

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `/` (first char) | TextArea empty or at line start | Open slash command popup |
| `@` | Anywhere in TextArea | Open entity mention popup |
| `↑` `↓` | Popup open | Navigate items |
| `Enter` | Popup open + item focused | Select item |
| `Tab` | Popup open | Complete to common prefix |
| `Esc` | Popup open | Dismiss popup |
| `Ctrl+/` | Anytime | Focus TextArea + insert "/" |
| `Ctrl+@` | Anytime | Focus TextArea + insert "@" |

## Design Token Compliance

| Element | Token | Value |
|---------|-------|-------|
| Command name in popup | `--tmnl-text-sm` | 14px, font-mono, bold |
| Command description | `--tmnl-text-xs` | 12px, muted |
| Category header | `--tmnl-text-xs` | 12px, uppercase, muted, letter-spacing |
| Entity ID in mention popup | `--tmnl-text-sm` | 14px, font-mono |
| Entity title | `--tmnl-text-sm` | 14px |
| Entity secondary info | `--tmnl-text-xs` | 12px, muted |
| Status badges | `--tmnl-text-xs` | 12px, colored per severity |
| Popup background | `bg-neutral-900` | Dark, matches chat |
| Popup border | `border-neutral-700` | Subtle separation |
| Highlighted match chars | `text-cyan-400` | TMNL accent color |
| border-radius | none | 0 — RVN brutalist |
