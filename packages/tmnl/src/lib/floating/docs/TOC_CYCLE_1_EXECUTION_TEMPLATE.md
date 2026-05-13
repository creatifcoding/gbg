# TOC Cycle-1 Execution Template — Floating Panels

**Cycle:** 1  
**Primary constraint hypothesis:** Render spikes under mixed workload  
**Primary target:** Frame time p95 `< 16.7ms`  
**Primary validation surface:** `PanelWorkspaceOverlay`

---

## 0) Run Metadata (fill first)

- Date:
- Branch / commit (baseline):
- Branch / commit (candidate):
- Operator:
- Machine: CPU / RAM / display refresh rate
- OS + browser version:
- Build mode used: `preview` (required for final numbers)

---

## 1) Preflight Commands

```bash
# from packages/tmnl
bun install
bunx tsc --noEmit
bun run panel:smoke
```

---

## 2) Start Runtime (Terminal A/B)

### Terminal A — app preview (production)
```bash
cd packages/tmnl
bun run build
bun run preview -- --host 0.0.0.0 --port 1420
```

### Terminal B — harness runtime (for mixed live chat)
```bash
cd packages/tmnl
bun run harness:remote-ws
```

---

## 3) Repro Protocol (must follow)

- Warmup: 30s
- Sample window: 60s per run
- Replicates: 5 runs per suite
- If p95 variance > 15%, rerun suite
- Keep unrelated tabs/processes closed

---

## 4) Workload Execution Matrix

## Suite A — Interaction Core
Route: `http://localhost:1420/window?testbed=floating`

Actions per run (60s):
1. Continuous drag operations
2. Continuous resize operations
3. Focus switching (Alt+H/J/K/L + arrows)

## Suite B — Mixed Workload (Primary)
Route: `http://localhost:1420/window?testbed=floating`

Actions per run (60s):
1. Spawn `+ Chat (Live)`
2. Send at least 3 prompts while streaming
3. During streaming: split/dock/drag/resize concurrently
4. Confirm overlay behavior remains correct

## Suite C — Stress Layout
Suggested command:
```bash
cd packages/tmnl
bun run panel:regression -- --fuzz 5 20
```

## Suite D — Idle Stability
Route: `http://localhost:1420/window?testbed=floating`

Actions per run:
- Leave session idle for 2 minutes
- Capture frame-time + memory trend

---

## 5) Required Evidence Artifacts

For baseline and candidate:
- commit SHA
- exact commands used
- raw metrics export (p50/p95/p99)
- profiler/flame snapshot
- `PanelWorkspaceOverlay` behavior check note

---

## 6) Metric Table (fill)

| Metric | Baseline | Candidate | Delta | Pass/Fail |
|---|---:|---:|---:|---|
| Frame time p95 (Suite B) |  |  |  |  |
| Frame time p99 (Suite B) |  |  |  |  |
| Input latency p95 |  |  |  |  |
| Spawn p95 |  |  |  |  |
| Dock/undock p95 |  |  |  |  |
| Split p95 |  |  |  |  |
| Maximize/restore p95 |  |  |  |  |
| Render warnings count |  |  |  |  |
| Overlay regressions |  |  |  |  |

---

## 7) TOC Decision Log (Cycle 1)

### Identify
- Dominant bottleneck observed:
- Evidence:

### Exploit
- Minimal high-leverage change:
- Scope:

### Subordinate
- Supporting reductions / gates applied:

### Elevate (only if needed)
- Structural change:
- Why exploit/subordinate was insufficient:

### Outcome
- Target met? (Y/N):
- If no, next constraint candidate:

---

## 8) Regression Gate Checklist (must all pass)

- [ ] `bunx tsc --noEmit`
- [ ] `bun run panel:smoke`
- [ ] No render-loop warnings in console
- [ ] `PanelWorkspaceOverlay` parity verified
- [ ] No listener/fiber accumulation symptoms

---

## 9) Append-to-Results Snippet

When cycle completes, append this to:
`src/lib/floating/docs/BENCHMARK_RESULTS.md`

```md
## TOC Cycle-1 — <date>

### Constraint
<one-sentence bottleneck>

### Before vs After
<metric table>

### Changes Applied
- ...

### Overlay Validation
- PanelWorkspaceOverlay: PASS/FAIL (+ notes)

### Next Constraint
- ...
```
