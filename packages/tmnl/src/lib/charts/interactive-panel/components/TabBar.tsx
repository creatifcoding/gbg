/**
 * InteractiveChartPanel TabBar
 *
 * Horizontal tab navigation for panel settings.
 *
 * @module charts/interactive-panel/components/TabBar
 */

import { useAtomValue } from '@effect-atom/atom-react';
import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { usePanelContext } from '../context';
import { TAB_META } from '../schemas/tab-id';
import type { TabId } from '../schemas';

export interface TabBarProps {
  /** Custom tab order (overrides default) */
  tabOrder?: readonly TabId[];
  /** Compact mode (icons only) */
  compact?: boolean;
}

/**
 * TabBar component for InteractiveChartPanel.
 *
 * Renders horizontal tabs based on:
 * - Available tabs from context (filtered by category)
 * - Tab metadata for labels and icons
 * - Active tab state from atoms
 */
export function TabBar({ tabOrder, compact = false }: TabBarProps) {
  const { atoms, actions, availableTabs } = usePanelContext();
  const activeTab = useAtomValue(atoms.activeTabAtom);

  // Use custom order or default from context
  const tabs = tabOrder ?? availableTabs;

  return (
    <div
      style={{
        display: 'flex',
        gap: VANTA_SPACING['1'],
        padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
        borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
        background: VANTA_COLORS.surface.default,
        overflowX: 'auto',
      }}
    >
      {tabs.map((tabId) => {
        const meta = TAB_META[tabId];
        const isActive = activeTab === tabId;

        return (
          <TabButton
            key={tabId}
            tabId={tabId}
            label={meta.label}
            isActive={isActive}
            compact={compact}
            onClick={() => actions.setActiveTab(tabId)}
          />
        );
      })}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface TabButtonProps {
  tabId: TabId;
  label: string;
  isActive: boolean;
  compact: boolean;
  onClick: () => void;
}

function TabButton({ tabId, label, isActive, compact, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      title={compact ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['1'],
        padding: compact
          ? `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`
          : `${VANTA_SPACING['1']} ${VANTA_SPACING['3']}`,
        background: isActive ? VANTA_COLORS.accent.cyanGlow : 'transparent',
        border: 'none',
        borderRadius: VANTA_BORDERS.radius.sm,
        color: isActive ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...VANTA_TYPOGRAPHY.preset.micro,
        fontWeight: isActive ? 600 : 400,
        transition: 'all 150ms ease',
      }}
    >
      {!compact && label}
    </button>
  );
}

export default TabBar;
