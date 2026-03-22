/** @module connection-capsule — public API */

// Component
export { ConnectionCapsule } from './connection-capsule'

// Sub-components (for composition)
export { LatencySparkline } from './latency-sparkline'
export { SmartDot } from './smart-dot'

// Atoms (for external consumers: metrics panel, session card, debug overlay)
export {
  latencyHistoryFamily,
  smartDotFamily,
  endpointFamily,
  errorMessageFamily,
  uptimeFamily,
  viewModeFamily,
  blurringFamily,
  syncCapsuleAtoms,
  pushLatencyReading,
} from './atoms'

// Utilities
export { latencyColor, latencyGlow } from './latency-color'

// Types
export type { ViewMode } from './view-modes'
export type { PhaseStyle } from './phase-styles'
