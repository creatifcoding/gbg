// ── Machine Definition ──────────────────────────────────────
export {
  surfaceMachine,
  type SurfaceMachineContext,
  type SurfaceMachineEvent,
  type SurfaceMachineInput,
  type SurfaceEmittedEvent,
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
  // Parallel region atoms
  connectionStateFamily,
  streamingStateFamily,
  presentationStateFamily,
  contentViewFamily,
  streamingMessageIdFamily,
  connectionErrorFamily,
  shouldAutoCollapseFamily,
} from './surface-stx'
