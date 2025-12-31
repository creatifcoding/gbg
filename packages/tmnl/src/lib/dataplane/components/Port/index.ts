/**
 * @fileoverview Port Component System
 *
 * Compound component pattern for ports in the dataplane.
 * Uses stx pattern for state management (XState + effect-atom).
 *
 * @example
 * ```tsx
 * <PortProvider portId={port.id}>
 *   <PortItem>
 *     <PortLabel>{port.name}</PortLabel>
 *     <PortBadge status="connected" count={3} />
 *   </PortItem>
 * </PortProvider>
 * ```
 */

// =============================================================================
// Context & Provider
// =============================================================================

export { PortProvider, usePort, type PortContextValue } from './context';

// =============================================================================
// Types
// =============================================================================

export {
  type PortSize,
  type PortVisualState,
  type PortTabId,
  type PortEvent,
  type PortDirection,
  type PortDataType,
  PortDirection as PortDirectionEnum,
  PORT_SIZE_DIMENSIONS,
} from './types';

// =============================================================================
// Components (Phase 3 - Core)
// =============================================================================

export { PortItem, type PortItemProps } from './Item';
export { PortBadge } from './Badge';

// =============================================================================
// Components (Phase 4 - Compound)
// =============================================================================

export { Sidebar as PortSidebar, type PortSidebarProps } from './Sidebar';
export { Tab as PortTab, TabList as PortTabList, TabPanel as PortTabPanel, type PortTabProps, type PortTabListProps, type PortTabPanelProps } from './Tab';
export { Actions as PortActions, type PortActionsProps } from './Actions';
export { Action as PortAction, type PortActionProps } from './Action';
export { PortNode, type PortNodeData, type PortNodeProps } from './PortNode';

// =============================================================================
// State Machine (stx pattern)
// =============================================================================

export {
  // Machine
  portMachine,
  // Operations
  portOps,
  // Atoms
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
} from './port-stx';
