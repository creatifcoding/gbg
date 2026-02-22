# Pre-Splash Cleanup Audit — Remediation Plan

**Date**: 2026-02-19  
**Auditor**: Val  
**Pattern Registry IDs**: `pat-raf-cleanup`, `pat-timer-cleanup`, `pat-effect-fiber-cleanup`  
**Feature**: #F463 (Timer & Animation Frame Leak Audits)

---

## 1. requestAnimationFrame Leaks (`pat-raf-cleanup`)

**22 files** use rAF without `cancelAnimationFrame` cleanup.

### Priority 1 — High Risk (continuous loops, 2+ rAF calls)

| File | rAF Count | Risk | Fix |
|------|-----------|------|-----|
| `src/lib/terminal/GhosttyTerminal.tsx` | 3 | 🔴 Terminal render loop | Store ID, cancel in cleanup |
| `src/lib/file-index/atoms/index.tsx` | 2 | 🔴 File scan animation | Store ID, cancel in cleanup |
| `src/lib/scroll/useNestedScrollController.ts` | 2 | 🔴 Scroll tracking | Store ID, cancel in cleanup |
| `src/lib/screensaver/components/ScreensaverOverlay.tsx` | 2 | 🔴 Screensaver anim | Store ID, cancel in cleanup |
| `src/lib/session/hooks/useSessionRestore.tsx` | 2 | 🔴 Restore animation | Store ID, cancel in cleanup |
| `src/lib/chat/shell/thread-band/thread-band-root.tsx` | 2 | 🔴 Scroll-to-bottom | Store ID, cancel in cleanup |

### Priority 2 — Medium Risk (one-shot, 1 rAF)

| File | Notes |
|------|-------|
| `src/lib/chat/composer/composer-root.tsx` | Focus management |
| `src/lib/chat/shell/header-band/model-selector.tsx` | Layout measurement |
| `src/lib/scroll/use-tail-follow.tsx` | Scroll position |
| `src/lib/cursor/hooks/useCursorPersistence.ts` | Cursor save |
| `src/lib/agents/tasks/views/view-navigator.tsx` | Navigation |
| `src/lib/minibuffer/v2/components/MinibufferContent.tsx` | Focus |
| `src/lib/geoint/components/TimelineControlsV2.tsx` | Timeline |
| `src/components/tldraw/shapes/data-grid-shape.tsx` | Grid render |
| `src/components/affordances/SelectionRing.tsx` | Selection ring |
| `src/lib/transfer/hooks/useTransferDraggable.ts` | Drag |
| `src/lib/transfer/v2/hooks/useDragHandlers.ts` | Drag v2 |
| `src/lib/rvn/chat/shell/thread-band/thread-band-root.tsx` | Scroll |
| `src/lib/terminal/v2/components/BlockInput.tsx` | Input |
| `src/lib/chat-shell/ChatInput.tsx` | Input |

**Fix pattern** (identical for all):
```tsx
useEffect(() => {
  let rafId: number;
  const tick = () => { /* work */ rafId = requestAnimationFrame(tick); };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}, [deps]);
```

**Estimate**: ~1.5 hours (mechanical, could be a codemod)

---

## 2. setInterval/setTimeout Leaks (`pat-timer-cleanup`)

### setInterval without clearInterval — 4 files (all testbed/playground)

| File | Count | Risk |
|------|-------|------|
| `src/components/playground/streams/panels/HypothesisPanel.tsx` | 1 | 🟡 Dev only |
| `src/components/testbed/DataGridVariantTestbedV2.tsx` | 2 | 🟡 Dev only |
| `src/components/testbed/DataGridVariantTestbed.tsx` | 2 | 🟡 Dev only |
| `src/lib/dataplane/services/PipelineBuilder.ts` | 1 | 🟠 Production code |

### setTimeout without clearTimeout — 25+ files

**Higher risk** (stream timeouts, could fire after unmount):
- `src/hooks/use-toast.ts`
- `src/lib/genifer/react/hooks.ts`
- `src/lib/genifer/react/useUIStreamCluster.ts`
- `src/lib/agents/tasks/views/view-navigator.tsx`
- `src/lib/testbed/IsolationChat.tsx`

**Lower risk** (UI transitions 100-300ms):
- Various editor, geoint, modal components

**Estimate**: ~1 hour for setInterval fixes, ~2 hours for setTimeout cleanup

---

## 3. Effect Fiber Orphans (`pat-effect-fiber-cleanup`)

**17 files** with `Effect.runFork` in React hooks, **0 with fiber.interrupt cleanup**.  
**0 uses** of `Supervisor.track` in the entire codebase.

### Priority 1 — Heavy forkers (5+ runFork calls)

| File | Forks | Risk |
|------|-------|------|
| `src/lib/genifer/react/hooks.ts` | 8 | 🔴 Streaming fibers |
| `src/lib/morph-card/hooks/useDurableStreamPatches.tsx` | 7 | 🔴 Durable stream |
| `src/lib/genifer/react/useUIStreamCluster.ts` | 5 | 🔴 Cluster streaming |
| `src/lib/dataplane/hooks/usePortTransfer.ts` | 5 | 🔴 Data transfer |
| `src/lib/overlays/hooks/useEventStream.tsx` | 5 | 🔴 Event streaming |
| `src/components/testbed/DataManagerTestbed.tsx` | 5 | 🟡 Dev only |

### Priority 2 — Medium forkers (2-4)

| File | Forks | Risk |
|------|-------|------|
| `src/lib/charts/hooks/useStreamingStyle.ts` | 4 | 🟠 Charting |
| `src/lib/egui/eventBus.ts` | 3 | 🟠 Event bus |
| `src/lib/genifer/react/GenerativeContainer.tsx` | 3 | 🟠 Gen container |
| `src/components/testbed/SearchTestbed.tsx` | 3 | 🟡 Dev only |
| `src/lib/editor/v3/hooks/useDocuments.tsx` | 2 | 🟠 Editor |
| `src/lib/data-grid/hooks/useMockStream.ts` | 2 | 🟡 Dev only |
| `src/components/testbed/charting/hooks/useStreamingSciChart.ts` | 2 | 🟡 Dev only |

### Priority 3 — Single forkers (4 files, lower risk)

### Recommended approach

1. **Create `useEffectFork` hook** — wraps runFork with auto-interrupt:
```tsx
function useEffectFork(effectFn: () => Effect.Effect<void, any, any>, deps: any[]) {
  useEffect(() => {
    const fiber = Effect.runFork(effectFn());
    return () => { Effect.runFork(Fiber.interrupt(fiber)); };
  }, deps);
}
```

2. **Add `Supervisor.track` to main runtime** — fleet-level fiber monitoring

3. **Migrate 17 files** to use `useEffectFork` or manual interrupt pattern

**Estimate**: ~1 hour for hook creation, ~3-4 hours for migration

---

## Summary

| Category | Violations | Severity | Estimate |
|----------|-----------|----------|----------|
| rAF leaks | 22 files | High | 1.5h |
| setInterval leaks | 4 files | Medium | 1h |
| setTimeout leaks | 25+ files | Low-Med | 2h |
| Fiber orphans | 17 files (58 forks) | Critical | 4h |
| **Total** | **68+ files** | | **~8.5h** |

### Recommended execution order

1. **Create `useEffectFork` hook** (unlocks fiber fixes)
2. **Fix rAF leaks** (mechanical, high impact)
3. **Fix setInterval leaks** (4 files, quick)
4. **Migrate fiber-leaking hooks** to `useEffectFork`
5. **Add Supervisor.track** to runtime
6. **setTimeout cleanup** (lowest priority, most files)
