/**
 * Port Compound Component
 *
 * DynamicIsland-inspired port visualization for DataplaneVisualizer.
 * Fixed sizing, expandable sidebar, morphing content per tabs.
 *
 * @example
 * ```tsx
 * <Port.Container portId={port.id}>
 *   <Port.Item>
 *     <Port.Icon direction="in" />
 *     <Port.Label>Data Input</Port.Label>
 *     <Port.Badge status="connected" count={3} />
 *   </Port.Item>
 * </Port.Container>
 * ```
 *
 * @module
 */

// Context & Provider
export { PortProvider, usePort, usePortContext } from './context';

// Compound Components
import { PortContainer } from './Container';
import { PortItem } from './Item';
import { Icon as PortIcon } from './Icon';
import { PortLabel } from './Label';
import { PortBadge } from './Badge';
// Phase 4: Interaction
import { Actions as PortActions } from './Actions';
import { Action as PortAction } from './Action';
import { PortTooltip } from './Tooltip';
// Phase 5: Expansion
import { Sidebar as PortSidebar } from './Sidebar';
import { Tab as PortTab } from './Tab';
import { TabList as PortTabList } from './TabList';
import { TabPanel as PortTabPanel } from './TabPanel';

// Re-export individual components
export { PortContainer } from './Container';
export { PortItem } from './Item';
export { Icon as PortIcon } from './Icon';
export { PortLabel } from './Label';
export { PortBadge } from './Badge';
// Phase 4: Interaction
export { Actions as PortActions } from './Actions';
export { Action as PortAction } from './Action';
export { PortTooltip } from './Tooltip';
// Phase 5: Expansion
export { Sidebar as PortSidebar } from './Sidebar';
export { Tab as PortTab } from './Tab';
export { TabList as PortTabList } from './TabList';
export { TabPanel as PortTabPanel } from './TabPanel';

// Types
export type { PortSize, PortVisualState, PortTabId, PortEvent } from './types';
export { PortDirection } from './types';

// State Machine (stx)
export {
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
} from './port-stx';

// Atoms
export {
  portStateAtom,
  portSnapshotAtom,
  portExpandedAtom,
  portHoveredAtom,
  portLinkingAtom,
  portActiveTabAtom,
} from './atoms';

/**
 * Port Compound Component
 *
 * Object.assign pattern for compound component API:
 * ```tsx
 * <Port.Container portId="...">
 *   <Port.Tooltip>
 *     <Port.Item>
 *       <Port.Icon direction="in" />
 *       <Port.Label>Data Input</Port.Label>
 *       <Port.Badge status="connected" count={3} />
 *     </Port.Item>
 *   </Port.Tooltip>
 *   <Port.Actions>
 *     <Port.Action icon={Link} onClick={onLink} label="Link" />
 *     <Port.Action icon={Settings} onClick={onConfigure} label="Configure" />
 *     <Port.Action icon={Trash2} onClick={onDelete} label="Delete" variant="destructive" />
 *   </Port.Actions>
 *   <Port.Sidebar>
 *     <Port.Tab id="info" label="Info">
 *       <PortInfoPanel />
 *     </Port.Tab>
 *     <Port.Tab id="config" label="Config">
 *       <PortConfigPanel />
 *     </Port.Tab>
 *   </Port.Sidebar>
 * </Port.Container>
 * ```
 */
export const Port = Object.assign(PortContainer, {
  // Core
  Container: PortContainer,
  Item: PortItem,
  Icon: PortIcon,
  Label: PortLabel,
  Badge: PortBadge,
  // Interaction
  Actions: PortActions,
  Action: PortAction,
  Tooltip: PortTooltip,
  // Expansion
  Sidebar: PortSidebar,
  Tab: PortTab,
  TabList: PortTabList,
  TabPanel: PortTabPanel,
});
