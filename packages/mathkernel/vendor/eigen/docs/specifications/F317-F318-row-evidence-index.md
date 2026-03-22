# F317/F318 Row-Mapped Evidence Index

Prepared for F316 gate adjudication.

## F317
- **F317-A1** near-bottom threshold
  - ✅ `docs/specifications/F317-A1-near-bottom-threshold-test.md`
  - ✅ `src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx` (threshold boundary test)
  - ⏳ `F317-A1-tail-follow-demo.mp4` (manual capture pending)
- **F317-A2** pause-on-scroll without yank
  - ✅ `docs/specifications/F317-A2-state-transitions.ndjson`
  - ✅ `src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx`
  - ⏳ `F317-A2-scroll-pause-demo.mp4` (manual capture pending)
- **F317-A3** jump-to-latest resume semantics
  - ✅ `docs/specifications/F317-A3-tail-mode-assertions.md`
  - ✅ `src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx`
  - ⏳ `F317-A3-resume-jump-demo.mp4` (manual capture pending)
- **F317-A4** unambiguous LIVE/PAUSED UI
  - ✅ `docs/specifications/F317-A4-copy-review.md`
  - ✅ `src/lib/agents/tasks/views/log-tail-controls.tsx`
  - ⏳ `F317-A4-ui-states.png` (manual capture pending)

## F318
- **F318-B1** RAF-coalesced append scroll
  - ✅ `docs/specifications/F318-B1-raf-implementation.diff`
  - ✅ `src/lib/agents/tasks/views/inline-task-log-view.tsx`
  - ⏳ `F318-B1-profiler-trace.json` (manual capture pending)
- **F318-B2** smooth jump/resume (motion allowed)
  - ✅ `docs/specifications/F318-B2-scroll-behavior-assertions.md`
  - ✅ `src/lib/agents/tasks/views/inline-task-log-view.tsx`
  - ⏳ `F318-B2-jump-smooth-demo.mp4` (manual capture pending)
- **F318-B3** reduced-motion disables smooth animation
  - ✅ `docs/specifications/F318-B3-accessibility-checklist.md`
  - ✅ `src/lib/agents/tasks/views/inline-task-log-view.tsx`
  - ⏳ `F318-B3-reduced-motion-demo.mp4` (manual capture pending)
- **F318-B4** sustained streaming no visible jank
  - ✅ `docs/specifications/F318-B4-load-profile.md`
  - ⏳ `F318-B4-long-frame-report.json` (manual capture pending)

## Regression runs
- ✅ `docs/specifications/F321-E4-regression-matrix.md`
- ✅ `docs/specifications/F321-E1-continuous-stream-run.log`
