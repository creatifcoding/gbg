# Conductor Chat RVN Design Decomposition v1

Date: 2026-02-11  
Owner: Val  
Source Design Basis: `src/lib/conductor/integrate/react-app.js`

## Objective

Decompose the design-basis chat UI into explicit, buildable component surfaces for the new `ConductorAgentChat` implementation.

This is a **visual-first reverse-spec** (not a runtime architecture). Functional requirements are separated into the mapping/gap doc.

---

## Surface 0 — Frame + Shell

### Latent components
1. **ChatWorkbenchFrame**
   - Full-height white panel
   - Strong brutal border and hard shadow
   - Corner-bracket decorations
2. **GridBackdropLayer**
   - Subtle tactical grid under the thread

### Visual traits to preserve
- hard border geometry (no radius)
- offset shadow “block print” look
- technical backdrop texture (low opacity)

---

## Surface 1 — Header Band

### Latent components
1. **SessionTitleBlock**
   - Primary: `COP ASSISTANT`
   - Secondary system strip (L2/system context)
2. **ConnectionChipsCluster**
   - `connecting` pulse chip
   - `idle` passive chip
3. **HeaderControlRail**
   - Collapse
   - Reset Session
   - Close
   - Agent Select trigger

### Visual traits to preserve
- uppercase, compact tracking
- narrow industrial control density
- explicit border-separated controls

---

## Surface 2 — Command Rail

### Latent components
1. **QuickCommandChip** (`/status`, `/alarm`, `@WO-4821`)
2. **SystemModeTelemetryBadge** (right-side monitor badge)

### Visual traits to preserve
- command chips read as physical toggles
- low-height strip with high contrast dividers

---

## Surface 3 — Thread / Conversation Field

### Latent components
1. **SystemMessageRow**
2. **UserMessageRow**
3. **AgentMessageRow**
4. **AnalysisCardPayload** (rich card embedded in agent row)
5. **ConnectionInterruptionBanner**
6. **EmptyThreadHintRow**

### Visual traits to preserve
- asymmetric left rail iconography by role
- timestamp/label micro-meta above message body
- embedded rich “artifact card” in assistant response
- warm warning banner tone for interruptions

---

## Surface 4 — Composer Stack

### Latent components
1. **ComposerInputWell**
   - Large writing field
   - Corner notch treatment
2. **ModeToggleGroup**
   - Terminal / AI
3. **ThinkingLevelControl**
   - MED style discrete chip
4. **InsertActionsGroup**
   - `/cmd`, `@entity`, voice
5. **TransportControlsGroup**
   - Reconnect
   - Send

### Visual traits to preserve
- tall composer footprint (authoring-first)
- transport controls as heavy, physical buttons
- toolbar segmented by role (mode / insert / transport)

---

## Surface 5 — Micro-ornamentation

### Latent components
1. **FrameCornerCaps** (4 corners)
2. **PingDotAnimation** for connecting status
3. **Subtle pattern overlays** (grid + radial dots)

### Visual traits to preserve
- small, purposeful tactical ornamentation
- not decorative noise; each motif supports system feel

---

## Canonical decomposition for implementation slots

Use this exact slot topology for the new chat compound:

1. `ConductorAgentChat.Frame`
2. `ConductorAgentChat.Header`
3. `ConductorAgentChat.CommandRail`
4. `ConductorAgentChat.Thread`
5. `ConductorAgentChat.Composer`
6. `ConductorAgentChat.Ornaments`

This keeps the original design silhouette intact while letting behavior be wired cleanly in Effect/Atom state.