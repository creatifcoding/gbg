# F321 Handoff Inputs (for gate adjudication)

## Completed machine-verifiable inputs
1. **Typecheck gate candidate**
   - Command: `bunx tsc --noEmit --pretty false`
   - Result: pass (no output)
2. **Targeted regression matrix**
   - Command:
     ```bash
     bunx vitest run src/lib/agents/tasks/services/__tests__/MockTransportService.test.ts src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx src/lib/agents/tasks/views/__tests__/inline-task-log-view.integration.test.tsx src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts
     ```
   - Result: 9/9 tests passed
   - Artifact: `docs/specifications/F321-E4-regression-matrix.md`
3. **Continuous stream proof**
   - Artifact: `docs/specifications/F321-E1-continuous-stream-run.log`
4. **Row evidence index (F317/F318)**
   - Artifact: `docs/specifications/F317-F318-row-evidence-index.md`
5. **Lane B row evidence index (F319/F320)**
   - Artifact: `docs/specifications/F319-F320-laneB-evidence-index.md`

## Pending manual artifacts before full F316 PASS
- Video/screenshot captures required by checklist:
  - `F317-A1-tail-follow-demo.mp4`
  - `F317-A2-scroll-pause-demo.mp4`
  - `F317-A3-resume-jump-demo.mp4`
  - `F317-A4-ui-states.png`
  - `F318-B2-jump-smooth-demo.mp4`
  - `F318-B3-reduced-motion-demo.mp4`
- Profiling captures:
  - `F318-B1-profiler-trace.json`
  - `F318-B4-long-frame-report.json`

## Coordination notes for Lane B merge
- Interface drift accounted for and now merged:
  - `unreadCountFamily` on atom surface
  - `unreadCountOverride` on `LogTailControls`
- Lane B delivered QueryDSL bridge + row detail compound evidence:
  - `src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts`
  - `docs/specifications/F319-F320-laneB-evidence-index.md`
- Compatibility anchors remain:
  - `src/lib/agents/tasks/views/inline-task-log-view.tsx`
  - `src/lib/agents/tasks/views/log-tail-controls.tsx`
  - `src/lib/agents/tasks/atoms/surface.ts`
