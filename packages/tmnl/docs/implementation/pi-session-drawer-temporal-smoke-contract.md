# Pi Session Drawer — Temporal Smoke + Attention Contract

**Feature:** #F1278 (EDIN / Validate)  
**Tasks:** #4632 → #4635  
**Date:** 2026-06-08

---

## 1) Objective

Validate the pi session drawer loading experience as a **temporal attention contract**, not merely a DOM state.

The drawer is a focused-task support surface. It must reassure the operator that session indexing is happening without stealing attention from the active conversation, editor, or command loop.

Prime, the goal is not spinner theater. It is calm instrumentation.

---

## 2) Perceptual Principles

1. **Immediate orientation beats decorative delay.**  
   The drawer shell, search, filters, and refresh controls should appear immediately so the user knows where they are.

2. **Motion should read as system breathing, not emergency.**  
   Loading texture may shimmer/pulse subtly, but must not demand foveal attention.

3. **Skeletons preserve spatial memory.**  
   Placeholder rows should approximate final session card geometry to prevent visual re-layout when real rows arrive.

4. **Status copy should be operational, not emotional.**  
   Prefer `[session.fetch] indexing session ledger…` over vague “Loading…” copy.

5. **Fast paths are allowed to skip drama.**  
   If the list resolves before the skeleton is perceptible, that is success. Smoke may use controlled test latency, but production must not add latency for aesthetics.

---

## 3) Temporal Envelope

### Phase A — 0–100ms: Orientation Frame

**Expected user perception:**
- Drawer opens with stable chrome.
- Header, search, filters, diagnostics strip, and close/new controls are visible.
- No blank panel.

**Pass criteria:**
- Drawer width animation is smooth and short.
- No large empty black void before content state.
- Controls are visually stable even while session data is pending.

**Failure signs:**
- Blank drawer body with no affordance.
- Header/control layout shifts after data arrives.
- Any text below 12px.

### Phase B — 100–300ms: Quiet Indexing Texture

**Expected user perception:**
- If data is still pending, a subtle skeleton row stack appears.
- The status strip communicates the actual operation.
- Motion is low-contrast and ambient.

**Pass criteria:**
- Skeleton card heights match final session-card rhythm closely enough to avoid row jump.
- Shimmer/pulse remains peripheral; no hard flashing, no rapid oscillation.
- Loading affordance is visible but not louder than the active task surface.

**Failure signs:**
- Aggressive shimmer bands.
- High-contrast spinner cluster.
- Placeholder geometry noticeably diverges from final cards.

### Phase C — >300ms: Reassurance / Extended Wait

**Expected user perception:**
- User understands indexing is still alive.
- Interface remains calm.
- Refresh remains available.

**Pass criteria:**
- Status remains specific: `[session.fetch] indexing session ledger…`.
- Refresh icon indicates activity.
- If an error occurs, copy pivots to actionable operator guidance.

**Failure signs:**
- Silent indefinite skeleton.
- Spinner-only loading with no semantic status.
- Error state that blames the user or hides the next action.

---

## 4) Motion.dev Technique Contract

Grounding:
- Motion.dev `AnimatePresence` controls exit states for conditionally rendered surfaces.
- Motion.dev `useReducedMotion()` lets the component replace spatial movement with opacity-only state changes.
- Motion transitions accept cubic bezier tuples, so Emil's drawer curve maps cleanly to `[0.32, 0.72, 0, 1]`.
- Motion animation props should favor `transform` + `opacity`; skeleton shimmer should move a composited overlay (`x`) rather than layout, width, margin, or padding.

Applied techniques:
- Drawer entrance: short tween with iOS-style curve, still under 300ms for focused desktop work.
- Skeleton entrance: small opacity/translateY reveal with staggered rows under 200ms.
- Skeleton shimmer: low-contrast `motion.div` overlay animating `x` only.
- Reduced motion: no spinner rotation; shimmer becomes low-amplitude opacity breathing.
- Smoke targeting: `data-tmnl-session-skeleton` and `data-tmnl-session-list` attributes provide deterministic agent-browser selectors.

---

## 5) Aesthetic Contract

### Palette

Use the existing Vantablack / low-chroma system:
- container: near-black `oklch(0.04–0.07 0 0)`
- skeleton bars: `oklch(0.09–0.14 0 0)`
- accent only in tiny doses: cyan-ish `oklch(... 195)`

### Motion

Allowed:
- slow shimmer or pulse, ~1.2–1.8s cycle
- single spinner in the status row
- drawer width transition ~140ms

Avoid:
- multiple independent spinners
- high-contrast wave bands
- motion that continues loudly after data has arrived
- layout bounce

### Typography

- Absolute floor: `var(--tmnl-text-xs, 12px)`.
- Do not use 10px fallbacks.
- Status copy should be monospace and short.

---

## 6) Smoke Scenario

The smoke should collect evidence for both **transient loading** and **settled list** states.

### Setup

1. Start TMNL dev with the existing `scripts/dev.sh` flow.
2. Use `agent-browser`, not Playwright, for UI smoke.
3. Open `http://127.0.0.1:1420/`.
4. Confirm title is `TMNL`.

### Interactions

1. Open the session drawer.
2. Trigger session refresh.
3. Capture:
   - immediate drawer snapshot
   - transient skeleton screenshot/snapshot if visible
   - settled session list screenshot/snapshot
4. Dump console/snapshot metadata for:
   - `aria-busy="true"` when skeleton is visible
   - session card count once settled
   - absence of horizontal/vertical layout thrash indicators where available

### If the skeleton is too fast to capture

Use a controlled smoke-only delay or fixture hook. Acceptable mechanisms:
- test/dev-only environment variable
- local smoke route / harness fixture
- debug flag that delays session-list resolution

Unacceptable:
- adding production delay
- making the real fast path slower so the skeleton is easier to admire

---

## 7) Evidence Checklist

Smoke evidence should include:

- [ ] URL/title confirmation
- [ ] screenshot: drawer open / skeleton or immediate settled state
- [ ] screenshot: settled session list
- [ ] snapshot JSON path
- [ ] timing observation for initial list fetch
- [ ] note on whether skeleton appeared naturally or required controlled delay
- [ ] note on typography floor compliance
- [ ] note on motion subtlety / attention impact

---

## 8) Acceptance for #4632

- [x] Temporal envelope documented
- [x] Aesthetic constraints documented
- [x] Smoke scenario documented
- [x] Evidence checklist documented

---

## 9) Next Work

- #4633: implement/run the agent-browser smoke scenario.
- #4634: capture and review temporal evidence.
- #4635: tune only if evidence shows a perception failure.
