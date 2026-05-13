# Floating Panel System — Performance Expectation Spec

**Spec ID:** FPS-PERF-EXPECTATION-v1  
**Status:** Draft (Cycle-1 baseline ready)  
**Method:** Theory of Constraints (TOC), successive cycles  
**Primary Surface:** `PanelWorkspaceOverlay` (non-negotiable validation target)

---

## 1) Intent

Define a **wide** performance contract for the floating panel system so optimization work is strategic, measurable, and repeatable.

This spec sets:
- hard expectations (SLO/SLA-style targets),
- benchmark workloads,
- instrumentation requirements,
- TOC cycle mechanics for successive constraint removal.

---

## 2) Scope

Included:
- Floating/tiled panel interactions (drag, resize, focus, split, dock/undock, collapse/maximize)
- `PanelWorkspaceOverlay` rendering + interaction loop
- Mixed workload with live chat + split operations + drag operations
- Hotkey-driven operations and keyboard dispatch path

Excluded (for this spec revision):
- Network/provider model latency beyond UI plumbing impact
- Non-panel surfaces outside floating system ownership

---

## 3) Workload Profiles (Benchmark Suites)

### Suite A — Interaction Core
- 5 visible panels (3 tiled + 2 floating)
- 20s continuous drag + 20s resize + 20s focus switching

### Suite B — Mixed Workload (Primary)
- 5–8 panels
- Active MorphChat live panel streaming/tool output
- Concurrent drag/resize + split/dock actions

### Suite C — Stress Layout
- Repeated split/unsplit + tile/float transitions
- Panel tree churn and z-order churn

### Suite D — Idle Stability
- No user interaction for 2 minutes
- Checks unnecessary rerenders, memory creep, and timer churn

---

## 4) Performance Expectations (Wide Contract)

## 4.1 Frame & Interaction
- **Frame time p95:** `< 16.7ms` (60fps budget) in Suites A/B
- **Frame time p99:** `< 25ms` in Suites A/B
- **Input-to-visual latency p95:** `< 50ms` for drag/resize/hotkey actions
- **No visible hitch > 150ms** during continuous pointer operations

## 4.2 Operation Latency
- Spawn panel (warm): p95 `< 80ms`
- Dock/undock: p95 `< 100ms`
- Split operation: p95 `< 120ms`
- Maximize/restore: p95 `< 80ms`

## 4.3 Render Efficiency
- No full-map invalidation cascades for single-panel mutations
- Single-panel move should re-render only affected panel path + minimal overlays
- No render-loop warnings (`setState/update while rendering another component`)

## 4.4 Stability & Memory
- No unbounded listener/fiber accumulation across reconnects/reopens
- Heap growth in Suite D must plateau (no monotonic leak trend)
- No stale overlay artifacts during drag/dock previews

---

## 5) Guardrails (Must Preserve)

1. `PanelWorkspaceOverlay` behavior parity is mandatory.
2. Functional correctness outranks micro-optimizations.
3. Accessibility behavior must not regress (focus and keyboard affordances).
4. Any aggressive optimization must remain observable + testable.

---

## 6) Instrumentation Requirements

Required telemetry at minimum:
- `panel.drag.start|move|end`
- `panel.resize.start|move|end`
- `panel.split`
- `panel.dock`
- `panel.spawn`
- `panel.focus.change`
- `panel.render.commit` (count + duration)
- `panel.frame.time` (distribution)

Data shape expectations:
- timestamp
- panelId/surfaceId
- operation name
- durationMs (where applicable)
- contextual load markers (panel count, streaming active, layout mode)

---

## 7) TOC Execution Model (Successive Cycles)

Exactly one active primary constraint per cycle.

Cycle algorithm:
1. **Identify** constraint (largest p95 contribution)
2. **Exploit** it (smallest high-leverage change)
3. **Subordinate** adjacent paths (remove conflicting work)
4. **Elevate** if target still misses (structural change)
5. **Repeat** with next dominant constraint

Cycle output must include:
- before/after metric table,
- bottleneck evidence,
- regression check on `PanelWorkspaceOverlay`,
- next constraint candidate.

---

## 8) Cycle-1 Target (Current)

From kickoff decisions:
- Primary pain: **render spikes**
- Success metric: **frame time p95 < 16.7ms**
- Primary benchmark: **Mixed workload (Suite B)**
- Change posture: **aggressive**
- Preserve: **must validate with `PanelWorkspaceOverlay`**

Cycle-1 pass criteria:
- Meets frame-time p95 target in Suite B
- No render-cycle warnings
- No behavioral regression in overlay interactions

---

## 9) Acceptance & Reporting

A cycle is accepted only when all are true:
- target metric achieved or explicitly escalated with evidence,
- no correctness regressions,
- no new critical warnings/errors,
- report checked in with reproducible run notes.

Recommended report artifact per cycle:
- `src/lib/floating/docs/BENCHMARK_RESULTS.md` append section:
  - baseline vs post-change
  - constraint narrative
  - follow-up constraint shortlist

---

## 10) Change Control

Any proposal changing expectations in Section 4 requires:
- documented reason,
- comparative benchmark evidence,
- explicit tradeoff note (UX, complexity, or reliability).
