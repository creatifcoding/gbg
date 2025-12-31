/**
 * @fileoverview Port Tab Components
 *
 * Tab and TabList components for the port sidebar.
 */

import React, { memo, createContext, useContext, useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { usePort } from './context';
import { portMachineActiveTabAtom, portOps } from './port-stx';
import type { PortTabId } from './types';

// =============================================================================
// Tab Context
// =============================================================================

interface TabContextValue {
  activeTab: PortTabId;
  setActiveTab: (id: PortTabId) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

function useTabContext() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('Tab must be used within a TabList');
  return ctx;
}

// =============================================================================
// Tab Component
// =============================================================================

export interface PortTabProps {
  /** Unique tab identifier */
  id: PortTabId;
  /** Tab label */
  label: string;
  /** Tab content */
  children: React.ReactNode;
}

/**
 * Individual tab with content.
 * Must be used within a Sidebar component.
 */
export const Tab = memo(function PortTab({
  id,
  label,
  children,
}: PortTabProps) {
  const { portId } = usePort();
  const activeTab = useAtomValue(portMachineActiveTabAtom(portId));
  const isActive = activeTab === id;

  const handleClick = () => {
    portOps.selectTab(portId, id);
  };

  return (
    <div className="flex flex-col">
      {/* Tab Header */}
      <button
        type="button"
        onClick={handleClick}
        className={`
          px-3 py-2
          font-mono text-left
          border-b transition-colors
          ${isActive
            ? 'bg-surface-2 border-cyan-500/30 text-foreground'
            : 'bg-surface-1 border-surface-3 text-muted-foreground hover:text-foreground hover:bg-surface-2'
          }
        `}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </button>

      {/* Tab Content */}
      {isActive && (
        <div
          className="p-3 overflow-y-auto"
          style={{ maxHeight: '300px' }}
        >
          {children}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// TabList Component
// =============================================================================

export interface PortTabListProps {
  /** Tab components */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Container for Tab components.
 * Provides tab switching context.
 */
export const TabList = memo(function PortTabList({
  children,
  className,
}: PortTabListProps) {
  const { portId } = usePort();
  const activeTab = useAtomValue(portMachineActiveTabAtom(portId));

  const contextValue = useMemo(
    () => ({
      activeTab,
      setActiveTab: (id: PortTabId) => portOps.selectTab(portId, id),
    }),
    [portId, activeTab]
  );

  return (
    <TabContext.Provider value={contextValue}>
      <div className={`flex flex-col ${className ?? ''}`}>{children}</div>
    </TabContext.Provider>
  );
});

// =============================================================================
// TabPanel Component
// =============================================================================

export interface PortTabPanelProps {
  /** Tab ID this panel belongs to */
  tabId: PortTabId;
  /** Panel content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Panel content for a specific tab.
 */
export const TabPanel = memo(function PortTabPanel({
  tabId,
  children,
  className,
}: PortTabPanelProps) {
  const { portId } = usePort();
  const activeTab = useAtomValue(portMachineActiveTabAtom(portId));

  if (activeTab !== tabId) return null;

  return (
    <div className={`p-3 ${className ?? ''}`}>
      {children}
    </div>
  );
});

export default Tab;
