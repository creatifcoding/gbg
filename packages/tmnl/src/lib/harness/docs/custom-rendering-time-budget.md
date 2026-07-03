# Custom Rendering Time Budget

## Purpose

Define a deterministic time budget for transforming streaming deltas/markers into renderable state, so custom pipelines stay responsive under burst load.

If we do not budget explicitly, pipelines drift into accidental O(n) work and frame-time collapse.

---

## 1) Budget model

Let:

- `F` = target frames per second (typically `60`)
- `Bf` = frame budget allocated to transform work (ms/frame)
- `R` = observed incoming deltas per second (events/s)

Then per-delta transform budget is:

\[
\text{perDeltaBudgetMs} = \frac{Bf \cdot F}{R}
\]

### Recommended baseline assumptions

- Target FPS: `60`
- Transform slice budget: `2ms/frame`
- Why `2ms`? It leaves room for reconciliation, layout/paint, and app-side work inside the 16.67ms frame envelope.

---

## 2) Worked budget table (60 FPS, 2ms transform slice)

| Incoming deltas/sec | Per-delta budget |
| ---: | ---: |
| 50 | 2.40 ms |
| 100 | 1.20 ms |
| 200 | 0.60 ms |
| 300 | 0.40 ms |
| 400 | 0.30 ms |
| 800 | 0.15 ms |

Interpretation:

- At modest rates (50–100/s), you can afford richer transforms.
- At burst rates (200–400/s), every delta must be near O(1), with little/no string rebuilding.
- At extreme rates (800+/s), only token append + coalesced frame flush should run hot.

---

## 3) Budget tiers

### Tier A — Normal stream
- `R <= 100/s`
- Budget target: `<= 1.2ms/delta`
- Allowed: lightweight semantic decorations, moderate partitioning

### Tier B — Bursty stream
- `100 < R <= 400/s`
- Budget target: `<= 0.3–0.6ms/delta`
- Allowed: append-only transforms, no full recompute

### Tier C — Flood conditions
- `R > 400/s`
- Budget target: `<= 0.3ms/delta`
- Allowed: minimal ingest only, defer all heavy parsing/formatting

---

## 4) What counts toward transform budget

Include in transform time:

- marker classification
- buffer append/coalesce
- view-model patch generation
- serialization/deserialization needed for pipeline state

Do **not** hide these costs in render time if they happen synchronously inside the event callback.

---

## 5) Common budget killers

1. Rebuilding full response text per delta (`full = full + delta` inside deep object churn)
2. Re-parsing markdown/AST on every token
3. Deep cloning model state at token cadence
4. Triggering multiple commits per frame
5. Synchronous diagnostic logging in hot callbacks

---

## 6) Budget control tactics

1. **Append-only hot state**
   - keep mutable chunk buffers for the active message
2. **Frame-coalesced flush**
   - flush once per `requestAnimationFrame`
3. **Stage heavy transforms**
   - run markdown/code-block/semantic transforms on `text_end` or `done`
4. **Backpressure mode**
   - if backlog exceeds threshold, temporarily disable expensive transforms
5. **Stable structures**
   - avoid reallocating large arrays/maps on every event

---

## 7) Practical decision rule

For each transform function `T`:

- measure `p95(T)` under expected burst `R`
- ensure `p95(T) <= perDeltaBudgetMs`

If it fails:
- move `T` to frame flush stage, or
- move `T` to terminal marker stage (`text_end` / `done`), or
- make `T` incremental.

---

## 8) Immediate target values

Use these as initial SLOs for custom harness renderers:

- Hot transform per event: `p50 <= 0.15ms`, `p95 <= 0.50ms`, `p99 <= 1.0ms`
- Frame flush transform batch: `p95 <= 2.0ms`
- Render commit phase: `p95 <= 4.0ms`
- Sustained backlog: `< 2 frames`

These are strict on purpose: stream UX fails fast when you violate them.
