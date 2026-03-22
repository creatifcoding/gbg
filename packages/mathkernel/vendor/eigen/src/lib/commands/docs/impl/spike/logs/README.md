# NuCmdk Spike Logs Index

| Run ID | File | Status | Notes |
|---|---|---|---|
| spike-0001 | `2026-02-13-spike-0001-baseline.jsonl` | bootstrapped | Initial baseline registration, metrics schema + objective framing wired |
| spike-0002 | `2026-02-13-spike-0002-iteration-1.jsonl` | pilot-simulated | Iteration 1 candidate comparison (baseline vs neighbor-a), winner selected |
| spike-0002-note | `2026-02-13-spike-0002-iteration-1-comparison.md` | analysis | Human-readable hillclimb decision summary |
| spike-0002-runtime | `2026-02-14-spike-0002-iteration-1.jsonl` | runtime-scripted | Script-generated candidate comparison using actor harness |
| spike-0002-runtime-note | `2026-02-14-spike-0002-iteration-1-comparison.md` | analysis | Runtime-scripted summary |
| spike-0003-runtime | `2026-02-14-spike-0003-iteration-1.jsonl` | runtime-scripted | Retry run after cancel-latency edge fix |
| spike-0003-runtime-note | `2026-02-14-spike-0003-iteration-1-comparison.md` | analysis | Runtime-scripted summary |
| spike-0004-runtime | `2026-02-14-spike-0004-iteration-1.jsonl` | runtime-scripted | Slice-module-backed harness run (not inline-only script logic) |
| spike-0004-runtime-note | `2026-02-14-spike-0004-iteration-1-comparison.md` | analysis | Runtime-scripted summary |
| spike-0005-runtime | `2026-02-14-spike-0005-iteration-2.jsonl` | runtime-scripted | Iteration 2 heavy neighborhood run (3 candidates, expanded scenarios) |
| spike-0005-runtime-note | `2026-02-14-spike-0005-iteration-2-comparison.md` | analysis | Iteration 2 candidate comparison and winner |
| spike-0006-runtime | `2026-02-14-spike-0006-iteration-2.jsonl` | runtime-scripted | Iteration 2 rerun using broker-backed scenario dispatch |
| spike-0006-runtime-note | `2026-02-14-spike-0006-iteration-2-comparison.md` | analysis | Broker-backed runtime summary |

## Rules

1. Append-only index.
2. Every run file must include `run.start` and `run.summary` records.
3. Rejected runs are still retained and indexed.
