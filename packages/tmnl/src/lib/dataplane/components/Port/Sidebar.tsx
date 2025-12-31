/**
 * Port Sidebar Component
 *
 * Expandable panel with tabs that slides out from port.
 * Uses Radix Tabs for tab management.
 */

import { Children, isValidElement, useMemo, type ReactNode } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { usePort } from './context';
import { portStateValueAtom, portMachineActiveTabAtom, portOps } from './port-stx';
import type { PortTabId } from './types';

interface SidebarProps {
  /** Tab children - each should be a Port.Tab */
  readonly children: ReactNode;
  /** Width of sidebar when expanded */
  readonly width?: number;
  /** Custom className */
  readonly className?: string;
}

interface TabChild {
  id: PortTabId;
  label: string;
  content: ReactNode;
}

/**
 * Extract tab data from Port.Tab children
 */
function extractTabs(children: ReactNode): readonly TabChild[] {
  const tabs: TabChild[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.props.id) {
      tabs.push({
        id: child.props.id as PortTabId,
        label: child.props.label ?? child.props.id,
        content: child.props.children,
      });
    }
  });

  return tabs;
}

/**
 * PortSidebar
 *
 * Expandable panel that slides out when port is expanded.
 * - Shows only in 'expanded' state
 * - Contains tabs for different content views
 * - Animates with smooth transition
 */
export function Sidebar({ children, width = 200, className }: SidebarProps) {
  const { portId } = usePort();
  const state = useAtomValue(portStateValueAtom(portId));
  const activeTab = useAtomValue(portMachineActiveTabAtom(portId));

  // Extract tab definitions from children
  const tabs = useMemo(() => extractTabs(children), [children]);

  // Only render when expanded
  if (state !== 'expanded') {
    return null;
  }

  // Default to first tab if none selected
  const currentTab = activeTab ?? tabs[0]?.id ?? 'info';

  const handleTabChange = (tabId: string) => {
    portOps.selectTab(portId, tabId as PortTabId);
  };

  return (
    <div
      className={cn(
        'absolute left-full top-0 ml-2',
        'bg-surface-1 border border-surface-2 rounded-lg',
        'shadow-lg overflow-hidden',
        'animate-in slide-in-from-left-2 fade-in-0 duration-200',
        className
      )}
      style={{ width }}
      data-port-sidebar
    >
      <Tabs.Root value={currentTab} onValueChange={handleTabChange}>
        {/* Tab List */}
        <Tabs.List
          className={cn(
            'flex border-b border-surface-2',
            'bg-surface-2/30'
          )}
        >
          {tabs.map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'flex-1 px-3 py-1.5',
                'text-xs font-mono',
                'border-b-2 border-transparent',
                'text-muted-foreground',
                'transition-colors duration-150',
                'data-[state=active]:text-foreground',
                'data-[state=active]:border-cyan-400',
                'hover:text-foreground',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent'
              )}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab Panels */}
        {tabs.map((tab) => (
          <Tabs.Content
            key={tab.id}
            value={tab.id}
            className={cn(
              'p-3',
              'focus:outline-none',
              'animate-in fade-in-0 duration-150'
            )}
          >
            {tab.content}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}
