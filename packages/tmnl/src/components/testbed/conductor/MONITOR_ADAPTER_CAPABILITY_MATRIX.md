# Conductor Monitor Adapter Capability Matrix

Status: draft synthesis from experiments `#296` + `#297` (EDIN / minimal cadence)

## Capability Legend

- `subscribe`: stream events/state changes
- `getSnapshot`: read current state on demand
- `runCommand`: perform side-effectful action
- `describeSchema`: expose payload/command contracts
- `dispose`: teardown listeners/observers/loops

## Adapter Slots

| Slot | Surface | Capabilities | Priority | Notes |
| --- | --- | --- | --- | --- |
| `ConductorStateAtomsAdapter` | Core registry atoms in `ConductorTestbed` | subscribe, getSnapshot, runCommand | P0 | Highest leverage for nodes, viewport, selection, logs, workflow state.
| `CanvasDragAdapter` | DnD drag lifecycle | subscribe, runCommand | P0 | Position writes are high-frequency and user-visible.
| `MicroHitboxAtomsAdapter` | `MicrointeractionHitbox` atoms/families | subscribe, getSnapshot, runCommand, dispose | P0 | Hover/armed/open are excellent intent signals; throttle required.
| `TagRackAnimationAdapter` | Tag descriptor layout choreography | subscribe, runCommand, dispose | P0 | Critical seam for `#232` entrance/switch/close correctness.
| `InspectorActionsAdapter` | Inline inspector controls | subscribe, runCommand, describeSchema | P1 | Connects user intent to node command execution.
| `CanvasViewportAdapter` | Pan/zoom + wheel policy | subscribe, getSnapshot, runCommand | P1 | Must preserve browser zoom suppression behavior.
| `FloatingUiLifecycleAdapter` | Floating overlays / `autoUpdate` | subscribe, dispose | P1 | Observer + raf cleanup correctness.
| `ContextMenuAdapter` | Context menu open/close + actions | subscribe, runCommand | P2 | Lower volume but useful for UX telemetry.
| `AnimeFxAdapter` | anime.js procedural effects (node chrome, rail, etc.) | subscribe, dispose | P2 | Avoid duplicating authority with layout orchestration.
| `ConductorDerivedAtomsAdapter` | Derived read atoms (counts, active node) | subscribe, getSnapshot | P2 | Cheap to add once core state adapter exists.

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Atom write storms during drag/hover | UI jank, noisy telemetry | High | Sample + aggregate; event coalescing by animation frame.
| Dual animation authority (layout + style transforms) | visual artifacts, race conditions | High | Single authority per surface; TagRack transitions routed through one scope method.
| Lifecycle leaks (`autoUpdate`, looped anime instances) | memory/CPU creep | Medium | Require `dispose` capability in adapter contract; enforce teardown in tests.
| Command payload drift | brittle monitor/control integration | Medium | Add `describeSchema` per command-capable adapter.
| Scope mismatch (global defaults vs local augment) | inconsistent behavior across overlays | Medium | Layered scope policy: global defaults, local additive overrides only.

## Recommended Bring-up Sequence

1. Implement `ConductorStateAtomsAdapter` + `CanvasDragAdapter`.
2. Add `MicroHitboxAtomsAdapter` with frame-bounded emission.
3. Add `TagRackAnimationAdapter` after `#232` acceptance gate.
4. Wire `InspectorActionsAdapter` with explicit command schema map.
5. Add lower-priority lifecycle adapters (`FloatingUi`, `ContextMenu`, `AnimeFx`).

## Contract Sketch (TypeScript)

```ts
export type MonitorCapability =
  | 'subscribe'
  | 'getSnapshot'
  | 'runCommand'
  | 'describeSchema'
  | 'dispose'

export interface MonitorAdapterSlot {
  id: string
  capabilities: ReadonlyArray<MonitorCapability>
  subscribe?: (onEvent: (event: unknown) => void) => () => void
  getSnapshot?: () => unknown
  runCommand?: (command: unknown) => Promise<unknown> | unknown
  describeSchema?: () => unknown
  dispose?: () => void
}
```

## Exit Criteria for `#298`

- [x] Named adapter slots and priorities defined
- [x] Capability matrix drafted
- [x] Initial risk register captured
- [ ] Linked into provider implementation plan (`#299`+)
