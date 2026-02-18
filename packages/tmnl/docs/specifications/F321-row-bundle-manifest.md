# F321 Packaging Manifest (Lane A)

Purpose: snap-in row bundle index for F316 adjudication.

## F317 rows
| Row | Required artifact(s) | Status |
|---|---|---|
| F317-A1 | `F317-A1-near-bottom-threshold-test.md` | ✅ present |
| F317-A1 | `F317-A1-tail-follow-demo.mp4` | ⏳ pending manual capture |
| F317-A2 | `F317-A2-state-transitions.ndjson` | ✅ present |
| F317-A2 | `F317-A2-scroll-pause-demo.mp4` | ⏳ pending manual capture |
| F317-A3 | `F317-A3-tail-mode-assertions.md` | ✅ present |
| F317-A3 | `F317-A3-resume-jump-demo.mp4` | ⏳ pending manual capture |
| F317-A4 | `F317-A4-copy-review.md` | ✅ present |
| F317-A4 | `F317-A4-ui-states.png` | ⏳ pending manual capture |

## F318 rows
| Row | Required artifact(s) | Status |
|---|---|---|
| F318-B1 | `F318-B1-raf-implementation.diff` | ✅ present |
| F318-B1 | `F318-B1-profiler-trace.json` | ⏳ pending manual capture |
| F318-B2 | `F318-B2-scroll-behavior-assertions.md` | ✅ present |
| F318-B2 | `F318-B2-jump-smooth-demo.mp4` | ⏳ pending manual capture |
| F318-B3 | `F318-B3-accessibility-checklist.md` | ✅ present |
| F318-B3 | `F318-B3-reduced-motion-demo.mp4` | ⏳ pending manual capture |
| F318-B4 | `F318-B4-load-profile.md` | ✅ present |
| F318-B4 | `F318-B4-long-frame-report.json` | ⏳ pending manual capture |

## F319 rows (Lane B)
| Row | Required artifact(s) | Status |
|---|---|---|
| F319-C1 | `src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts` | ✅ present |
| F319-C1 | `docs/specifications/F319-F320-laneB-evidence-index.md` | ✅ present |
| F319-C2 | invalid-regex deterministic test in `surface.querydsl.test.ts` | ✅ present |
| F319-C3 | operator-only query test in `surface.querydsl.test.ts` | ✅ present |
| F319-C4 | deterministic fixture assertions in `surface.querydsl.test.ts` | ✅ present |

## F320 rows (Lane B)
| Row | Required artifact(s) | Status |
|---|---|---|
| F320-D1 | `src/lib/agents/tasks/views/log-entry-row.tsx` + `log-entry-detail/*` | ✅ present |
| F320-D2 | copy feedback actions in detail compound subcomponents | ✅ present |
| F320-D3 | views barrel export + style safety notes | ✅ present |
| F320-D* | `docs/specifications/F319-F320-laneB-evidence-index.md` | ✅ present |

## F321 rows
| Row | Required artifact(s) | Status |
|---|---|---|
| F321-E1 | `F321-E1-continuous-stream-run.log` | ✅ present |
| F321-E1 | `F321-E1-5min-demo.mp4` | ⏳ pending manual capture |
| F321-E3 | `F321-E3-reduced-motion-checklist.md` | ✅ present |
| F321-E3 | `F321-E3-keyboard-walkthrough.mp4` | ⏳ pending manual capture |
| F321-E4 | `F321-E4-regression-matrix.md` | ✅ present (9/9 suite) |
| F321-E4 | `F321-E4-ci-report-url.txt` | ✅ present (local-run stub) |

## Companion docs
- `F317-F318-row-evidence-index.md`
- `F319-F320-laneB-evidence-index.md`
- `F321-handoff-inputs.md`
- `F316-pre-adjudication-status.md`
