/**
 * Port TabList Component
 *
 * Horizontal tab buttons. Usually embedded in Sidebar,
 * but can be used standalone for custom layouts.
 */

import { useAtomValue } from '@effect-atom/atom-react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { usePort } from './context';
import { portMachineActiveTabAtom, portOps } from './port-stx';
import type { PortTabId } from './types';

interface TabItem {
  readonly id: PortTabId;
  readonly label: string;
  readonly icon?: React.ReactNode;
}

interface TabListProps {
  /** Array of tab definitions */
  readonly tabs: readonly TabItem[];
  /** Custom className */
  readonly className?: string;
}

/**
 * PortTabList
 *
 * Renders horizontal tab buttons.
 * Clicking sends SELECT_TAB to port machine.
 */
export function TabList({ tabs, className }: TabListProps) {
  const { portId } = usePort();
  const activeTab = useAtomValue(portMachineActiveTabAtom(portId));

  const handleTabChange = (tabId: string) => {
    portOps.selectTab(portId, tabId as PortTabId);
  };

  return (
    <Tabs.List
      className={cn(
        'flex border-b border-surface-2',
        'bg-surface-2/30',
        className
      )}
    >
      {tabs.map((tab) => (
        <Tabs.Trigger
          key={tab.id}
          value={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5',
            'flex-1 px-3 py-1.5',
            'text-xs font-mono',
            'border-b-2 border-transparent',
            'text-muted-foreground',
            'transition-colors duration-150',
            activeTab === tab.id && 'text-foreground border-cyan-400',
            'hover:text-foreground',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent'
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}
