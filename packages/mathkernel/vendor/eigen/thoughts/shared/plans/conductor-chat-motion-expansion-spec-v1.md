# Conductor Chat L3 — Motion & Expansion Geometry Spec v1

Owner: Val  
Date: 2026-02-10

## 1) Scope

Defines how node expansion to L3 behaves spatially and temporally.

## 2) Expansion Geometry

### Base rule
- L3 target is ~4x area relative to L1 node footprint.
- Practical mapping: ~2x width x ~2x height.

### Anchoring
- Adaptive:
  - in-place morph when space is available
  - dock to fixed safe viewport region when constrained

### Inspector
- Hidden in L3 (focus chat surface only).

## 3) Motion Engine

- Use `motion.dev` for L2 -> L3 and L3 -> L2 transitions.
- Avoid anime.js in this surface.

## 4) Timing + Easing

- Baseline duration: **240ms**
- Easing: **easeOut**
- Character: snappy brutalist (fast, clear, non-elastic)

## 5) Choreography Sequence

1. Freeze interaction on source node frame.
2. Elevate node shell to transition layer.
3. Expand frame to L3 target bounds.
4. Fade in sticky header/composer micro-offset.
5. Activate thread scroll region and focus composer.

Reverse on collapse:
- remove L3 focus ring
- collapse shell to prior bounds
- restore prior layout mode and interaction targets

## 6) Visual Shell Rules During Motion

- Hard outer frame remains present through transition.
- Interior sections stay calmer and do not over-animate.
- Hybrid separators persist (hard outside, soft inside).
- No rounded transition masks.

## 7) Focus + Accessibility Rules

- On L3 enter: focus composer contenteditable.
- On L3 exit: restore focus to originating node chat control.
- Respect reduced motion setting by reducing transform distance and duration.

## 8) Acceptance Gates

1. Transition remains under 250ms baseline.
2. Enter and exit retain node identity (no perceived swap).
3. Focus is deterministic on enter/exit.
4. Layout fallback to docked region triggers only on actual constraints.

## 9) Addendum — Inline Task Thread reveal motion (v1.1)

Source: questionnaire `inline-task-thread-motion-expectations-v1`

- Expansion model: hybrid.
  - non-L3: accordion-style inline expansion.
  - L3: drawer-style reveal.
- Trigger contract:
  - explicit chevron/button,
  - row click,
  - keyboard activation,
  - auto-open while streaming.
- Motion profile:
  - snappy (~140–180ms).
- Reduced-motion policy:
  - opacity-only fade.
- State ownership:
  - per-message expansion state.
