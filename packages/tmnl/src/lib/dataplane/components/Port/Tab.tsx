/**
 * Port Tab Component
 *
 * Declarative tab definition for Port.Sidebar.
 * Children become the tab panel content.
 *
 * @example
 * <Port.Sidebar>
 *   <Port.Tab id="info" label="Info">
 *     <PortInfoPanel />
 *   </Port.Tab>
 *   <Port.Tab id="config" label="Config">
 *     <PortConfigPanel />
 *   </Port.Tab>
 * </Port.Sidebar>
 */

import type { ReactNode } from 'react';
import type { PortTabId } from './types';

interface TabProps {
  /** Unique tab identifier */
  readonly id: PortTabId;
  /** Tab label shown in TabList */
  readonly label?: string;
  /** Tab content (rendered in TabPanel) */
  readonly children: ReactNode;
}

/**
 * PortTab
 *
 * Declarative tab definition. This component is parsed by Sidebar
 * to extract tab metadata; it doesn't render anything directly.
 *
 * The children are rendered inside the Radix TabPanel by Sidebar.
 */
export function Tab({ children }: TabProps) {
  // This component is parsed by Sidebar.extractTabs()
  // It doesn't render directly - children are extracted and rendered by Sidebar
  return <>{children}</>;
}

// Mark as tab component for runtime detection
Tab.displayName = 'PortTab';
