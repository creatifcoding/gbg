/**
 * @fileoverview Dataplane Components Barrel Export
 */

// =============================================================================
// Port Compound Component
// =============================================================================

export {
  // Context & Provider
  PortProvider,
  usePort,
  type PortContextValue,
  // Types
  type PortSize,
  type PortVisualState,
  type PortTabId,
  type PortEvent,
  type PortDirection,
  type PortDataType,
  PortDirectionEnum,
  PORT_SIZE_DIMENSIONS,
  // Components (Core)
  PortItem,
  type PortItemProps,
  PortBadge,
  // Components (Compound)
  PortSidebar,
  type PortSidebarProps,
  PortTab,
  PortTabList,
  PortTabPanel,
  type PortTabProps,
  type PortTabListProps,
  type PortTabPanelProps,
  PortActions,
  type PortActionsProps,
  PortAction,
  type PortActionProps,
  PortNode,
  type PortNodeData,
  type PortNodeProps,
  // State machine
  portMachine,
  portOps,
  portSnapshotAtom,
  portStateValueAtom,
  portCanExpandAtom,
  portMachineActiveTabAtom,
  portLinkTargetAtom,
  portMachineContextAtom,
  // Actor management
  getOrCreatePortActor,
  getPortActor,
  getPortSnapshot,
  sendPortEvent,
  disposePortActor,
  disposeAllPortActors,
  // Types
  type PortMachineContext,
  type PortMachineEvent,
  type PortActor,
  type PortSnapshot,
} from './Port';

// =============================================================================
// React Flow Components
// =============================================================================

export {
  BidirectionalEdge,
  type BidirectionalEdgeData,
  type BidirectionalEdgeProps,
} from './BidirectionalEdge';

export {
  DataplaneVisualizer,
  type DataplaneVisualizerProps,
  type VisualizerMode,
  type VisualizerScope,
} from './DataplaneVisualizer';

export {
  LinkPortNode,
  type LinkPortNodeData,
  type LinkPortNodeProps,
} from './LinkPortNode';

// =============================================================================
// Port Indicators & Settings
// =============================================================================

export {
  LinkPortIndicator,
  type LinkPortIndicatorProps,
} from './LinkPortIndicator';

export {
  LinkSettingsPanel,
  type LinkSettingsPanelProps,
} from './LinkSettingsPanel';
