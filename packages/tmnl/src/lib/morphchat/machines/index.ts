// ── Machine Definition ──────────────────────────────────────
export {
  surfaceMachine,
  type SurfaceMachineContext,
  type SurfaceMachineEvent,
  type SurfaceMachineInput,
} from './surface-machine'

// ── Machine → Atom Bridge ───────────────────────────────────
export {
  type SurfaceActor,
  type SurfaceSnapshot,
  getOrCreateSurfaceActor,
  getSurfaceActor,
  sendSurfaceEvent,
  disposeSurfaceActor,
  disposeAllSurfaceActors,
  surfaceSnapshotFamily,
  surfaceStateValueFamily,
} from './surface-stx'
