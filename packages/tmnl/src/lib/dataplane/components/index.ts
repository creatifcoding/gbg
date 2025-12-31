/**
 * @fileoverview Dataplane Components
 *
 * React components for dataplane visualization.
 */

// =============================================================================
// Port Compound Component
// =============================================================================

export {
  // Main compound export
  Port,
  // Individual components
  PortContainer,
  PortItem,
  PortIcon,
  PortLabel,
  PortBadge,
  PortActions,
  PortAction,
  PortTooltip,
  PortSidebar,
  PortTab,
  PortTabList,
  PortTabPanel,
  // Context & hooks
  PortProvider,
  usePort as usePortContext,
  usePortContext as usePortContextAlias,
  // Types
  PortDirection,
  type PortSize,
  type PortVisualState,
  type PortTabId,
  type PortEvent,
  // State machine
  portMachine,
  portOps,
  portStateValueAtom,
  portCanExpandAtom,
  portMachineActiveTabAtom,
  portLinkTargetAtom,
  portMachineContextAtom,
  getOrCreatePortActor,
  disposePortActor,
  disposeAllPortActors,
  sendPortEvent,
  getPortActor,
  getPortSnapshot,
  type PortActor,
  type PortSnapshot,
  type PortMachineContext,
  type PortMachineEvent,
  // Atoms
  portStateAtom,
  portSnapshotAtom,
  portExpandedAtom,
  portHoveredAtom,
  portLinkingAtom,
  portActiveTabAtom,
} from './Port';

// =============================================================================
// Port Indicators (Legacy)
// =============================================================================

export {
  LinkPortIndicator,
  type LinkPortIndicatorProps,
} from './LinkPortIndicator';

// =============================================================================
// React Flow Components
// =============================================================================

export {
  DataplaneVisualizer,
  type DataplaneVisualizerProps,
  type VisualizerMode,
  type VisualizerScope,
} from './DataplaneVisualizer';

export {
  BidirectionalEdge,
  type BidirectionalEdgeData,
  type BidirectionalEdgeProps,
} from './BidirectionalEdge';

export {
  LinkPortNode,
  type LinkPortNodeData,
  type LinkPortNodeProps,
} from './LinkPortNode';

// =============================================================================
// Settings & Configuration
// =============================================================================

export {
  LinkSettingsPanel,
  type LinkSettingsPanelProps,
} from './LinkSettingsPanel';

// =============================================================================
// Debug & Development
// =============================================================================

export {
  DataplaneDebugPanel,
  type DataplaneDebugPanelProps,
} from './DataplaneDebugPanel';
