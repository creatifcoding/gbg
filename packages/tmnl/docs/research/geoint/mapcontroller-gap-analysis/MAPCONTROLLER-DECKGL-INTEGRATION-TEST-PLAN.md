# MapController ↔ GeointMap Integration Test Plan

## Scope

Validate the panel-scoped camera loop between:

- `MapController.flyTo(...)` / `cancelAnimation()`
- `flyToTargetAtom` + `isAnimatingAtom`
- `GeointMap` DeckGL transition handling (`FlyToInterpolator` path)
- fallback timeout behavior when no map consumer clears animation state

This plan targets deterministic integration tests (Vitest + RTL), not e2e browser snapshots.

---

## Deterministic Harness Setup (Vitest + RTL)

### Test runtime

- Use `vi.useFakeTimers()` in every integration suite.
- Freeze baseline wall-clock with `vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))`.
- Restore timers in `afterEach`.

### Mount strategy

- Mount `GeointMap` inside panel context with explicit `panelId`.
- Use unique panel IDs per test (`panel-a`, `panel-b`) for isolation assertions.

### DeckGL seam

- Add a test seam to capture requested `viewState` transitions from `GeointMap` (mock or spy wrapper around DeckGL props).
- Assert transition props are emitted only when `flyToTargetAtom` is non-null.
- Assert map-side completion clears `flyToTargetAtom` and flips `isAnimatingAtom` false.

### Atom assertions

- Read and assert panel atoms via `getPanelAtoms(panelId)` + `geointRegistry.get(...)`.
- Never inspect unrelated default/global atoms in panel tests.

---

## Matrix A — FlyTo / Viewport Sync Loop

| ID | Scenario | Setup | Action | Expected |
|---|---|---|---|---|
| A1 | Basic flyTo dispatch | panel A mounted | `controllerA.flyTo({...})` | `flyToTargetAtom(A)` set; `isAnimatingAtom(A)=true`; DeckGL receives transition viewState |
| A2 | flyTo completion clears state | panel A mounted with completion callback path | advance timers / trigger transition end | `flyToTargetAtom(A)=null`; `isAnimatingAtom(A)=false`; viewport(A) equals target |
| A3 | multiple flyTo sequential | panel A mounted | issue two flyTo calls | second target wins; final viewport equals second target; no stale animation flag |
| A4 | flyTo with partial fields | panel A has custom pitch/bearing | flyTo without pitch/bearing | unspecified fields preserved from current viewport |

---

## Matrix B — Panel-Scoped Isolation

| ID | Scenario | Setup | Action | Expected |
|---|---|---|---|---|
| B1 | flyTo on panel A does not affect panel B | panels A+B mounted | `controllerA.flyTo(...)` | only A atoms change; B atoms unchanged |
| B2 | cancel on panel A leaves panel B animation untouched | A+B with active B animation | `controllerA.cancelAnimation()` | A canceled, B continues |
| B3 | fallback snap in A does not mutate B viewport | A has no map consumer; B mounted | advance fallback timeout | only viewport(A) snaps |

---

## Matrix C — Cancellation Race Conditions

| ID | Scenario | Setup | Action | Expected |
|---|---|---|---|---|
| C1 | cancel immediately after flyTo | mounted panel | call `flyTo` then `cancelAnimation` same tick | no viewport jump to stale target; target cleared |
| C2 | cancel mid-transition | mounted panel with transition in progress | advance partial time then cancel | animation stops; final viewport remains at last committed state |
| C3 | cancel near timeout fallback boundary | no map consumer | cancel at `t = duration - 1ms` then advance | fallback does not re-enable animation or overwrite canceled state |
| C4 | cancel + new flyTo | mounted panel | cancel old animation, issue new flyTo | new target active and completed correctly |

---

## Matrix D — Fallback Timeout Behavior

| ID | Scenario | Setup | Action | Expected |
|---|---|---|---|---|
| D1 | no consumer fallback snap | controller-only (no GeointMap) | `flyTo(duration=750)` + advance timers | viewport snaps to target at timeout; animation false; target null |
| D2 | consumer present prevents fallback overwrite | GeointMap mounted and completes before timeout | `flyTo(duration=1200)` + complete transition at 400ms + advance to 1200ms | no double-commit; final state stable |
| D3 | default duration path | no duration passed | `flyTo(...)` + advance 1200ms | fallback uses default timeout and converges to target |
| D4 | repeated fallback runs | no consumer | issue 3 flyTo calls with short durations | each run converges cleanly; no leaked timers |

---

## Recommended Test Files

1. `src/lib/geoint/components/__tests__/GeointMap.integration.test.tsx`
   - A/B panel mounting
   - DeckGL prop/transition observation
   - atom loop assertions

2. `src/lib/geoint/map/__tests__/MapController.integration.test.ts`
   - controller-only fallback behavior
   - cancellation race matrices

3. Keep unit-level behavior in existing:
   - `src/lib/geoint/map/__tests__/MapController.test.ts`

---

## Suggested Utilities

- `mountPanelMap(panelId: PanelId)` helper
- `readPanelCameraState(panelId)` helper returning `{ viewport, flyToTarget, isAnimating }`
- `advanceAndFlush(ms)` helper (`vi.advanceTimersByTime(ms)` + microtask flush)

---

## Gate Criteria (Pass/Fail)

All of the following must pass before closing integration lane:

- A1–A4 green
- B1–B3 green
- C1–C4 green
- D1–D4 green
- No leaked interval/timer warnings after suite run
- No cross-panel atom mutation in any isolation test

---

## Notes

- Keep DeckGL dependencies mocked/stubbed at seam level where needed for deterministic timing.
- Preserve existing `FlyToInterpolator` behavior contract from current unification work.
- Do not introduce global singleton state in integration tests; panel scope is the contract.