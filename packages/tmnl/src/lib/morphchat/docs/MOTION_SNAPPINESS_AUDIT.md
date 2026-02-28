# Motion Snappiness Audit (No New Instrumentation)

**Date:** 2026-02-26  
**Scope:** MorphChat runtime surfaces + shared drawer/overlay paths + high-frequency streaming/drag paths

---

## Executive Summary

The UI feels unsnappy primarily because we are compounding motion systems on top of hot render/update paths.

- We currently use **multiple animation engines in parallel** on core surfaces:
  - `framer-motion` in **69 files**
  - `motion/react` in **49 files**
  - `animejs` in **70 files**
  - `gsap` in **12 files**
- We have high global animation density:
  - `duration-200+` utility usage in classnames: **85** occurrences
  - Infinite loops (`repeat: Infinity` / `repeat: -1`): **73** occurrences
- Core UX taxors are mostly **not visual polish**, but **hot-path churn + layered motion**.

Recommendation: keep a **Balanced** policy, but aggressively trim non-semantic motion and unify drawer/chat motion semantics.

---

## Top Offenders (Ranked)

### 1) `src/lib/scroll/use-tail-follow.tsx`
**Issue:** MutationObserver + ResizeObserver + RAF-based scroll writes on streaming path.  
**Why it hurts:** This runs on the hottest interaction lane (incoming stream + scroll follow).  
**Action:** Gate observers to active streaming tail mode only; disable `characterData` path outside active stream windows.

### 2) `src/lib/morphchat/components/thread-view.tsx`
**Issue:** Thread render path remains dense during streaming; several view modes share runtime path.  
**Why it hurts:** Mixed rendering concerns under frequent update cadence.
**Action:** Harden fast path for streaming mode: minimize per-row reactive work and skip non-essential adornments while status=`streaming`.

### 3) `src/lib/chat/msg/body-content/body-content-root.tsx`
**Issue:** Streaming markdown path (`Streamdown`) in the same lane as frequent deltas.  
**Why it hurts:** Rich parsing/render in a fast update loop increases UI pressure.
**Action:** Use reduced-render mode while streaming (plain text / low-cost markdown subset), then full enrich on settle.

### 4) `src/lib/chat/msg/shared/use-throttled-highlight.ts`
**Issue:** Shiki `codeToHtml` still runs during stream updates.  
**Why it hurts:** Expensive syntax highlighting in-flight.
**Action:** For long blocks, defer highlight until pause/end; keep immediate plain-code fallback.

### 5) `src/lib/morphchat/components/surface-content.tsx`
**Issue:** 7-band morph choreography with stagger and spring bound transitions (`MORPH_DURATION=333ms`).  
**Why it hurts:** High multiplicity for everyday state changes.
**Action:** Reduce morph to semantic-only (state transitions), shorten to 140–180ms, remove stagger for routine transitions.

### 6) `src/lib/morphchat/components/session-drawer/SessionDrawer.tsx` + `SessionCard.tsx`
**Issue:** Drawer shell + list card animations layered on management surface.  
**Why it hurts:** UI admin action path feels slower than necessary.
**Action:** Animate container only; disable per-card layout animation under normal operation.

### 7) `src/lib/drawer/Drawer.tsx`
**Issue:** Separate drawer implementation with stack animation lifecycle.  
**Why it hurts:** Duplicate motion semantics and maintenance overhead.
**Action:** Consolidate to one drawer animation authority.

### 8) `src/lib/overlays/visual/renderers/drawer/DrawerRendererBase.tsx`
**Issue:** Another animated drawer renderer (`AnimatePresence` + directional springs).  
**Why it hurts:** Same surface category, second motion stack.
**Action:** Hard-cut one system or define one as the canonical adapter path only.

### 9) `src/components/tldraw/overlays/DragReticleOverlay.tsx`
**Issue:** Decorative drag emanations and corner effects during interaction.
**Why it hurts:** Drag should prioritize pointer fidelity, not effects.
**Action:** Keep only intent affordance; gate extra effects behind high-fx mode.

### 10) `src/components/tldraw/shapes/data-grid-shape.tsx`
**Issue:** GSAP highlight animations inside row-drag lifecycle + `animateRows={true}`.  
**Why it hurts:** Drag responsiveness competes with decorative tweening.
**Action:** Disable row animation during drag, shorten all drag-related tweens, and prefer CSS state styling.

---

## Semantic vs Decorative Cut Matrix

- **Keep (semantic):**
  - press/release acknowledgment
  - hover/focus affordance
  - drawer/panel open-close (single engine, short)
  - drag/drop intent feedback
  - loading/skeleton transitions
  - streaming reveal (batched, not token-by-token flourish)

- **Cut/Gate (decorative):**
  - repeated or infinite looping effects on operational surfaces
  - multi-band stagger choreography for routine transitions
  - redundant drawer animation stacks
  - drag-time decorative emanations on performance-critical paths

---

## Proposed Policy (Phased)

### Phase A — Immediate Snappiness (no architecture churn)
1. Trim morph durations to strict budget ranges and remove stagger on routine transitions.
2. Reduce session drawer list animations to container-level only.
3. Gate drag decorative effects.
4. Suspend expensive markdown/highlight behavior while streaming.

### Phase B — Hot-Path Hardening
1. Tail-follow observer gating and stream-window scoping.
2. Thread view fast path for streaming state.
3. Tighten chat render workloads under streaming status.

### Phase C — Consolidation
1. Choose one drawer animation system.
2. Remove overlapping motion engines from the same interaction category.
3. Standardize motion tokens for semantic interactions only.

---

## Bottom Line

You do **not** need more latency instrumentation to justify action. We already have enough evidence to reduce motion multiplicity and improve perceived responsiveness immediately.

The best move is: **semantic-only motion, shorter durations, fewer concurrent animation systems, and hot-path simplification first.**
