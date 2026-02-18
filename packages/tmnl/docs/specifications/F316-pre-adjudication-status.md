# F316 Pre-Adjudication Status (Lane A)

This file is a fast triage map for gate closure, not final signoff.

## Ready to adjudicate now
- **F317-A1** threshold logic + boundary test evidence (doc + test)
- **F317-A2** pause semantics + state transitions evidence (ndjson + test)
- **F317-A3** jump-to-latest resume evidence (doc + test)
- **F317-A4** UI copy clarity evidence (copy review)
- **F318-B1** RAF coalescing evidence (implementation diff)
- **F318-B2** smooth jump behavior assertions (doc + source anchors)
- **F318-B3** reduced-motion degradation (checklist + source anchors)
- **F318-B4** sustained stream strategy (load profile doc; profiler capture pending)
- **F319-C1..C4** QueryDSL bridge + deterministic tests (lane-B evidence index + querydsl test file)
- **F320-D1..D3** row-detail compound integration + copy actions + style/barrel safety (lane-B evidence index)
- **F321-E1** continuous stream log evidence
- **F321-E3** reduced-motion + keyboard checklist
- **F321-E4** local regression matrix + local ci-report stub (9/9 pass suite)

## Pending manual capture artifacts (block full PASS)
- video/screenshot captures for F317-A1/A2/A3/A4, F318-B2/B3
- profiler trace / long-frame report for F318-B1/B4

## Gate status snapshot
- F316 gate 0 (typecheck): passed
- F316 gate 1 (log-view tests): passed
- F316 gate 2 (UX acceptance matrix): pending manual adjudication
