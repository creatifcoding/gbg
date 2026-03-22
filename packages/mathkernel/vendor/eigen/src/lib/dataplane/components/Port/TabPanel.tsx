/**
 * Port TabPanel Component
 *
 * Content area for active tab.
 * Usually handled by Sidebar, but available for custom layouts.
 */

import type { ReactNode } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { usePort } from './context';
import { portMachineActiveTabAtom } from './port-stx';
import type { PortTabId } from './types';

interface TabPanelProps {
  /** Tab ID this panel belongs to */
  readonly id: PortTabId;
  /** Panel content */
  readonly children: ReactNode;
  /** Custom className */
  readonly className?: string;
}

/**
 * PortTabPanel
 *
 * Renders content when its tab is active.
 * Includes fade-in animation.
 */
export function TabPanel({ id, children, className }: TabPanelProps) {
  const { portId } = usePort();
  const activeTab = useAtomValue(portMachineActiveTabAtom(portId));

  // Only render when this tab is active
  if (activeTab !== id) {
    return null;
  }

  return (
    <Tabs.Content
      value={id}
      forceMount
      className={cn(
        'p-3',
        'focus:outline-none',
        'animate-in fade-in-0 duration-150',
        className
      )}
    >
      {children}
    </Tabs.Content>
  );
}
