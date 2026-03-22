# Conductor Chat UX v1 — Regression Matrix Run (PR-06 prep)

Owner: Val  
Date: 2026-02-11

## Scope

Canonical chat UX regression sweep for:
- interaction precedence
- failure/status visibility
- stream-first hard-cut invariants
- node-local chat UI behavior in Conductor surfaces

## Commands Executed

```bash
bunx tsc --noEmit -p tsconfig.json
bunx vitest run src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
```

## Result Summary

- Typecheck: ✅ PASS
- Regression tests: ✅ PASS (8/8)

## Matrix Coverage

| Matrix Area | Contract Source | Validation | Status |
|---|---|---|---|
| Header state surface | `conductor-chat-layout-state-spec-v1.md` | `ConductorAgentChat.regression.test.tsx` (`renders canonical connection/message/session chips`) | ✅ |
| Quick action visibility rule | `conductor-chat-interaction-precedence-matrix-v1.md` | `ConductorAgentChat.regression.test.tsx` (`hides quick actions while draft has content`) | ✅ |
| Escape precedence | `conductor-chat-interaction-precedence-matrix-v1.md` | `ConductorAgentChat.regression.test.tsx` (`close suggestions first, then pause`) | ✅ |
| Reconnect keyboard reachability | `conductor-chat-interaction-precedence-matrix-v1.md` | `ConductorAgentChat.regression.test.tsx` (`Escape focuses reconnect`) | ✅ |
| Suggestion arbitration (Tab apply) | `conductor-chat-interaction-precedence-matrix-v1.md` | `ConductorAgentChat.regression.test.tsx` (`Tab applies slash suggestion`) | ✅ |
| Stream-first hard cut invariants | `conductor-chat-ux-governance-lock-policy-v1.md` | `chat-v2-hardcut.test.ts` (legacy poll/settle paths absent in conductor send flow) | ✅ |
| Chat-v2 session/snapshot path | `conductor-chat-layout-state-spec-v1.md` | `chat-v2-hardcut.test.ts` (open/resume/getSnapshot path present) | ✅ |
| Legacy gateway retirement marker | governance lock policy | `chat-v2-hardcut.test.ts` + service marker string | ✅ |

## Notes

- This run is UI/UX-focused and does not assert runtime governance unlock gates directly.
- Runtime-gated tasks remain separate under #F214/#F209 unlock policy.
