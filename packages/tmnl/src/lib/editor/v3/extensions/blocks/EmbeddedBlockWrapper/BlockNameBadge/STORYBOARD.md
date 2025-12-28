# BlockNameBadge State Storyboard

> Design specification for the BlockNameBadge component state transitions.

## State Machine Flow

```
                                    ┌─────────────────┐
                                    │                 │
                                    ▼                 │
┌─────────────┐  double-click  ┌─────────────┐       │
│   DISPLAY   │ ─────────────► │   EDITING   │       │
└─────────────┘                └─────────────┘       │
      ▲                              │               │
      │                              │ enter/blur    │
      │                              ▼               │
      │                        ┌─────────────┐       │
      │         after 500ms    │ SUBMITTING  │       │
      │       ◄──────────────  └─────────────┘       │
      │       │                      │               │
      │       │                      ├── success ────┤
      │       │                      │               │
      │  ┌────┴────┐           ┌─────┴─────┐        │
      │  │ SUCCESS │           │   ERROR   │────────┘
      │  └─────────┘           └───────────┘  retry
      │       │
      └───────┘ auto-transition (icon slides out)
```

---

## STATE 1: DISPLAY (Idle)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   @sensor-hub-alpha                                          │
│   ─────────────────                                          │
│   blk_7f3a2c                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Typography

- **Name**: Geist Sans, 13px, weight 450, letter-spacing: -0.01em
- **ID**: Geist Mono, 10px, muted (40% opacity), uppercase tracking
- **"@" prefix**: slightly dimmed, feels like a handle/mention

### Interaction

- Hover: subtle brightness lift (opacity 0.7 → 1.0)
- Cursor: text (invites editing)
- Double-click → EDITING

### Unnamed Variant

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   untitled                                                   │
│   ────────                                                   │
│   blk_7f3a2c                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- "untitled" in italic, 50% opacity
- Invites naming

---

## TRANSITION: DISPLAY → EDITING

```
Frame 0 (0ms)        Frame 1 (80ms)       Frame 2 (150ms)
─────────────        ─────────────        ─────────────

@sensor-hub-alpha    @sensor-hub-alpha    |sensor-hub-alpha
─────────────────    ═══════════════      ═════════════════
blk_7f3a2c           blk_7f3a2c           blk_7f3a2c
                                          ▲
                                          caret appears
```

### Animation

- Name text holds position (no layout shift)
- "@" fades out, caret fades in (crossfade)
- Underline intensifies: muted → cyan accent
- Block ID stays anchored
- **Duration**: 150ms ease-out

---

## STATE 2: EDITING

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   sensor-hub-alpha|                                          │
│   ════════════════                                           │
│   blk_7f3a2c                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Input Styling

- No borders, no background
- Single 1px underline in accent cyan
- Caret: cyan, subtle pulse animation
- Text inherits same font as display (seamless morph)
- Placeholder: "block-name" in 30% opacity if empty

### Interactions

- **Enter** → SUBMITTING
- **Escape** → DISPLAY (revert)
- **Blur** → SUBMITTING (commit)
- **Empty + blur** → DISPLAY (no-op)

### Validation Error (inline)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   sensor hub alpha|     ← spaces not allowed                 │
│   ════════════════                                           │
│   blk_7f3a2c        ▲ underline turns rose                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## TRANSITION: EDITING → SUBMITTING

```
Frame 0 (0ms)        Frame 1 (100ms)      Frame 2 (200ms)
─────────────        ─────────────        ─────────────

sensor-hub-beta|     sensor-hub-beta      sensor-hub-beta
════════════════     ═══════•════════     ════•════════•═══
blk_7f3a2c           blk_7f3a2c           blk_7f3a2c
```

### Animation

- Caret fades out
- Underline: solid → animated gradient sweep
- Subtle "processing" feel via traveling highlight
- Text dims slightly (80% opacity)

---

## STATE 3: SUBMITTING

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   sensor-hub-beta                                            │
│   ═══════•═══════════•═══════                               │
│   blk_7f3a2c          ▲ traveling highlight                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Animation

- Underline has a "scanning" shimmer effect
- Gradient pulse travels left → right, loops
- Text is non-editable, slightly dimmed
- **Duration**: until SUCCESS or ERROR

---

## TRANSITION: SUBMITTING → SUCCESS

```
Frame 0 (0ms)        Frame 1 (150ms)      Frame 2 (300ms)
─────────────        ─────────────        ─────────────

sensor-hub-beta      ✓                    ✓  →  @sensor-hub-beta
═══════════════      ═══════════════           ─────────────────
blk_7f3a2c           blk_7f3a2c                blk_7f3a2c

                     ▲ checkmark scales   ▲ check slides left,
                       in from center       new name slides in
```

### Animation Sequence

1. Text collapses/fades (100ms)
2. Checkmark scales up from 0 → 1 with bounce (150ms)
3. Checkmark holds (200ms)
4. Checkmark slides left + fades (150ms)
5. New "@name" slides in from right (150ms)

- **Total**: ~600ms
- **Easing**: spring(1, 80, 10) for checkmark

---

## STATE 4: SUCCESS (momentary)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│         ✓                                                    │
│   ═══════════════   (emerald glow)                          │
│   blk_7f3a2c                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Checkmark Styling

- Color: Emerald green (#34d399)
- Scale: 1.0, centered where text was
- Subtle glow/shadow in emerald
- SVG stroke animation: draws itself

**Duration**: 400ms before auto-transition to DISPLAY

---

## TRANSITION: SUCCESS → DISPLAY

```
Frame 0 (0ms)        Frame 1 (150ms)      Frame 2 (300ms)
─────────────        ─────────────        ─────────────

      ✓                   ✓←              @sensor-hub-beta
═══════════════      ═══════════════      ─────────────────
blk_7f3a2c           blk_7f3a2c           blk_7f3a2c

                     ▲ check moves        ▲ name appears,
                       left, shrinks        pushed in from right
```

### Animation

- Checkmark: translateX(-20px), scale(0.5), opacity(0)
- New name: translateX(20px → 0), opacity(0 → 1)
- Creates "pushed aside" feeling
- Underline: accent → muted (fades back)

---

## STATE 5: ERROR

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   sensor-hub-beta        ✕ failed                            │
│   ════════════════  (rose underline)                         │
│   blk_7f3a2c                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Error Styling

- Underline turns rose (#f43f5e)
- Small "✕ failed" or error message appears right of text
- Text gets subtle shake animation on enter

### Interactions

- **Click text** → back to EDITING (retry)
- **Escape** → DISPLAY (abandon)
- **Auto-dismiss** after 3s → DISPLAY

---

## TRANSITION: ERROR → EDITING (retry)

```
Frame 0 (0ms)        Frame 1 (100ms)      Frame 2 (200ms)
─────────────        ─────────────        ─────────────

sensor-hub-beta ✕    sensor-hub-beta      sensor-hub-beta|
════════════════     ════════════════     ════════════════
(rose)               (rose → cyan)        (cyan)
```

### Animation

- Error indicator fades out
- Underline color transitions rose → cyan
- Caret reappears
- Text becomes editable again

---

## Component Hierarchy

```
<BlockNameBadge>
  ├── <AnimatePresence mode="wait">
  │   │
  │   ├── [display] ────────────────────────────────────
  │   │   <motion.div key="display">
  │   │     <span className="name">@{name}</span>
  │   │     <span className="block-id">{blockId}</span>
  │   │   </motion.div>
  │   │
  │   ├── [editing] ────────────────────────────────────
  │   │   <motion.div key="editing">
  │   │     <input
  │   │       autoFocus
  │   │       className="hairline-input"
  │   │     />
  │   │     <motion.div className="underline" />
  │   │     <span className="block-id">{blockId}</span>
  │   │   </motion.div>
  │   │
  │   ├── [submitting] ─────────────────────────────────
  │   │   <motion.div key="submitting">
  │   │     <span className="name-pending">{inputValue}</span>
  │   │     <motion.div className="underline-shimmer" />
  │   │     <span className="block-id">{blockId}</span>
  │   │   </motion.div>
  │   │
  │   ├── [success] ────────────────────────────────────
  │   │   <motion.div key="success">
  │   │     <motion.svg className="checkmark" />
  │   │     <span className="block-id">{blockId}</span>
  │   │   </motion.div>
  │   │
  │   └── [error] ──────────────────────────────────────
  │       <motion.div key="error">
  │         <span className="name-error">{inputValue}</span>
  │         <span className="error-msg">✕ {error}</span>
  │         <motion.div className="underline-error" />
  │         <span className="block-id">{blockId}</span>
  │       </motion.div>
  │
  └── <Tooltip.Root> (wraps display state only)
        "Double-click to rename"
```

---

## Typography Spec

```css
.name {
  font-family: var(--font-geist-sans), system-ui;
  font-size: 13px;
  font-weight: 450;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

.name-prefix {
  opacity: 0.6;
}

.block-id {
  font-family: var(--font-geist-mono), monospace;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.hairline-input {
  /* Inherits .name styles */
  font-family: var(--font-geist-sans), system-ui;
  font-size: 13px;
  font-weight: 450;
  letter-spacing: -0.01em;
  background: transparent;
  border: none;
  outline: none;
  caret-color: var(--color-accent-cyan);
  color: var(--color-text-primary);
}

.hairline-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.3;
}

.underline {
  height: 1px;
  background: var(--color-accent-cyan);
  transform-origin: left;
}

.underline-muted {
  height: 1px;
  background: var(--color-border-subtle);
  opacity: 0.3;
}

.underline-error {
  height: 1px;
  background: var(--color-accent-rose);
}

.underline-shimmer {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-accent-cyan) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

---

## Color Tokens

| Token                    | Value                       | Usage                  |
| ------------------------ | --------------------------- | ---------------------- |
| `--color-text-primary`   | `rgba(255, 255, 255, 0.95)` | Name text              |
| `--color-text-muted`     | `rgba(255, 255, 255, 0.5)`  | Block ID, placeholders |
| `--color-accent-cyan`    | `#22d3ee`                   | Edit underline, caret  |
| `--color-accent-emerald` | `#34d399`                   | Success checkmark      |
| `--color-accent-rose`    | `#f43f5e`                   | Error state            |
| `--color-border-subtle`  | `rgba(255, 255, 255, 0.1)`  | Idle underline         |

---

## Animation Tokens

| Token               | Value                            | Usage                    |
| ------------------- | -------------------------------- | ------------------------ |
| `--duration-fast`   | `100ms`                          | Micro-interactions       |
| `--duration-normal` | `150ms`                          | State transitions        |
| `--duration-slow`   | `300ms`                          | Complex animations       |
| `--ease-out`        | `cubic-bezier(0.16, 1, 0.3, 1)`  | Enter animations         |
| `--ease-in-out`     | `cubic-bezier(0.45, 0, 0.55, 1)` | Symmetric transitions    |
| `--spring`          | `spring(1, 80, 10)`              | Bouncy success checkmark |

---

## Implementation Notes

### Tech Stack

- **Framer Motion**: `AnimatePresence`, `motion.div` for state transitions
- **XState**: State machine (existing `blockNameMachine.ts`)
- **Radix Tooltip**: Hint on display state
- **anime.js**: Shimmer/traveling highlight effects (optional, can use CSS)

### Key Behaviors

1. **No layout shift**: Container maintains consistent width during transitions
2. **Seamless morph**: Display text → input text should feel like the same element
3. **Block ID anchored**: Always visible, provides stability during transitions
4. **Keyboard accessible**: Tab to focus, Enter to edit, Escape to cancel

### Edge Cases

- Very long names: truncate with ellipsis, full name in tooltip
- Rapid double-clicks: debounce or ignore if already editing
- Network timeout: show error after 5s, allow retry
- Concurrent edits: last-write-wins, but show conflict indicator if detected
