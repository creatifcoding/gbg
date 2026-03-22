# Conductor Chat RVN CSS Class Contract v1

Date: 2026-02-11  
Owner: Val

## Goal

Adopt the `react-app.js` aesthetic nearly verbatim **without** style-tag injection and **without** ad-hoc inline style sprawl.

Use:
- RVN/TMNL tokens via CSS variables
- explicit class contract
- dedicated stylesheet(s)

---

## File strategy

1. `src/components/testbed/conductor/styles/conductor-agent-chat.rvn.css`
2. `src/components/testbed/conductor/styles/conductor-agent-chat.thread.css`
3. `src/components/testbed/conductor/styles/conductor-agent-chat.composer.css`

(Optional: collapse to one file if preferred, keep sectioned by comments.)

---

## Class naming convention

Use stable BEM-like namespace:
- root: `.rvn-chat`
- element: `.rvn-chat__header`
- modifier: `.rvn-chat--l3`, `.rvn-chat__chip--connecting`
- runtime/a11y attrs remain: `data-state`, `data-role`, `data-tone`

### Canonical class map

- `.rvn-chat`
- `.rvn-chat__frame`
- `.rvn-chat__header`
- `.rvn-chat__title`
- `.rvn-chat__subtitle`
- `.rvn-chat__status-cluster`
- `.rvn-chat__status-chip`
- `.rvn-chat__status-chip--connecting`
- `.rvn-chat__controls`
- `.rvn-chat__command-rail`
- `.rvn-chat__command-chip`
- `.rvn-chat__thread`
- `.rvn-chat__message`
- `.rvn-chat__message-meta`
- `.rvn-chat__message-body`
- `.rvn-chat__message-footer`
- `.rvn-chat__artifact-card`
- `.rvn-chat__alert-row`
- `.rvn-chat__empty-state`
- `.rvn-chat__composer`
- `.rvn-chat__composer-input`
- `.rvn-chat__toolbar`
- `.rvn-chat__mode-group`
- `.rvn-chat__insert-group`
- `.rvn-chat__transport-group`
- `.rvn-chat__send`
- `.rvn-chat__reconnect`
- `.rvn-chat__corners`

---

## Token contract (no hardcoded brand literals)

Define local chat skin vars on `.rvn-chat`:

- `--cchat-bg`
- `--cchat-surface`
- `--cchat-border`
- `--cchat-text`
- `--cchat-text-muted`
- `--cchat-accent-warn`
- `--cchat-accent-info`
- `--cchat-shadow`

Default each to RVN/TMNL vars, e.g.:
- `var(--rvn-surface)`
- `var(--rvn-border)`
- `var(--rvn-shadow)`
- `var(--tmnl-text-xs, 12px)`

---

## Font equivalence plan (design-basis -> TMNL)

Reference uses Space Mono + JetBrains Mono. TMNL equivalents:

### Primary recommendation
- **Header/display:** `var(--font-heading)` (`Space Grotesk`)
- **Body/meta/composer:** `var(--font-data)` (`Share Tech Mono`)

### RVN provider override (conductor scope only)
At conductor chat boundary:
- `--rvn-font-sans: var(--font-heading)`
- `--rvn-font-mono: var(--font-data)`

This preserves the technical vibe while using local TMNL fonts.

---

## Responsive sizing contract (MorphCard-aware)

Do not pin fixed heights in chat skin.

Use clamp/minmax contract:
- root: `block-size: clamp(360px, 68vh, 860px)` in L3
- thread row: `minmax(0, 1fr)`
- composer: `min-block-size: clamp(140px, 24vh, 280px)`

Rules:
1. No fixed pixel-only L3 panel heights.
2. Internal scroll only on thread and composer input.
3. Header/rails fixed rows; content rows flex.

---

## Styling governance rules

1. No inline visual constants except runtime geometry (positioning/measure).
2. No style-tag injection.
3. No font sizes under `var(--tmnl-text-xs, 12px)`.
4. No border radius.
5. State-driven modifiers via classes + `data-*` attrs.

---

## Migration sequence (safe)

1. Introduce class names in parallel with existing inline styles.
2. Move static visual blocks inline -> css class-by-class.
3. Keep behavior tests green while visual migration proceeds.
4. Remove remaining inline visual styles after parity review.

This keeps runtime behavior stable while converging to RVN aesthetic unity.