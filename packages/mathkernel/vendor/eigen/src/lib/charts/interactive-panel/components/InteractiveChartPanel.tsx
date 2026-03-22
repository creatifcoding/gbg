/**
 * InteractiveChartPanel
 *
 * Domain-specific compound component wrapper for interactive charts.
 * Provides panel state management, tab navigation, and chart controls.
 *
 * @module charts/interactive-panel/components/InteractiveChartPanel
 */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAtomValue } from '@effect-atom/atom-react';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import type { ChartCategory } from '../../registry/definitions';
import type { TabId } from '../schemas';
import { getTabsForCategory } from '../schemas';
import { PanelProvider, usePanelContext } from '../context';

import { Header, type HeaderProps } from './Header';
import { TabBar, type TabBarProps } from './TabBar';
import { Content, type ContentProps } from './Content';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';

// =============================================================================
// Types
// =============================================================================

export interface InteractiveChartPanelProps {
  /** Unique panel identifier */
  panelId: string;
  /** Chart ID this panel controls */
  chartId: string;
  /** Chart category for tab filtering */
  category: ChartCategory;
  /** Initial active tab (defaults to first available) */
  initialTab?: TabId;
  /** Override available tabs (defaults to category-based) */
  availableTabs?: readonly TabId[];
  /** Children components (use compound components) */
  children: ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Panel width */
  width?: number | string;
  /** Disable panel shadow */
  disableShadow?: boolean;
}

// =============================================================================
// Root Component
// =============================================================================

/**
 * Root component for InteractiveChartPanel.
 *
 * Wraps children in PanelProvider and applies container styling.
 * Use compound components for structure:
 *
 * @example
 * ```tsx
 * <InteractiveChartPanel
 *   panelId="chart-1-panel"
 *   chartId="chart-1"
 *   category="trend"
 * >
 *   <InteractiveChartPanel.Header title="Price Trend" />
 *   <InteractiveChartPanel.SettingsPanel />
 * </InteractiveChartPanel>
 * ```
 */
function InteractiveChartPanelRoot({
  panelId,
  chartId,
  category,
  initialTab,
  availableTabs: customTabs,
  children,
  className,
  width = '100%',
  disableShadow = false,
}: InteractiveChartPanelProps) {
  // Resolve available tabs from category or custom list
  const availableTabs = customTabs ?? getTabsForCategory(category);

  // Default to first available tab if not specified
  const resolvedInitialTab = initialTab ?? availableTabs[0] ?? 'style';

  return (
    <PanelProvider
      panelId={panelId}
      chartId={chartId}
      category={category}
      availableTabs={availableTabs}
      initialTab={resolvedInitialTab}
    >
      <PanelContainer
        className={className}
        width={width}
        disableShadow={disableShadow}
      >
        {children}
      </PanelContainer>
    </PanelProvider>
  );
}

// =============================================================================
// Container (Internal)
// =============================================================================

interface PanelContainerProps {
  children: ReactNode;
  className?: string;
  width: number | string;
  disableShadow: boolean;
}

/**
 * Internal container component that reads panel state for styling.
 */
function PanelContainer({
  children,
  className,
  width,
  disableShadow,
}: PanelContainerProps) {
  const { atoms } = usePanelContext();
  const foldState = useAtomValue(atoms.foldStateAtom);
  const isMinimized = foldState === 'minimized';

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{
        opacity: isMinimized ? 0.7 : 1,
      }}
      transition={{ duration: 0.15 }}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        background: VANTA_COLORS.surface.default,
        border: `1px solid ${VANTA_COLORS.surface.border}`,
        borderRadius: VANTA_BORDERS.radius.md,
        boxShadow: disableShadow ? 'none' : VANTA_BORDERS.shadow.card,
        overflow: 'hidden',
      }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// Compound Component Assembly
// =============================================================================

/**
 * InteractiveChartPanel compound component.
 *
 * Provides domain-specific chart panel with:
 * - Header: Fold controls, settings toggle, stream status
 * - TabBar: Horizontal tab navigation
 * - Content: Active tab renderer
 * - SettingsPanel: Animated drawer with tabs
 *
 * @example
 * ```tsx
 * // Full panel with settings drawer
 * <InteractiveChartPanel panelId="p1" chartId="c1" category="trend">
 *   <InteractiveChartPanel.Header title="Market Trends" />
 *   <InteractiveChartPanel.SettingsPanel />
 * </InteractiveChartPanel>
 *
 * // Minimal panel with direct content
 * <InteractiveChartPanel panelId="p2" chartId="c2" category="comparison">
 *   <InteractiveChartPanel.Header showSettingsButton={false} />
 *   <InteractiveChartPanel.TabBar />
 *   <InteractiveChartPanel.Content />
 * </InteractiveChartPanel>
 *
 * // Custom content per tab
 * <InteractiveChartPanel panelId="p3" chartId="c3" category="distribution">
 *   <InteractiveChartPanel.Header />
 *   <InteractiveChartPanel.SettingsPanel
 *     contentProps={{ children: <CustomTabContent /> }}
 *   />
 * </InteractiveChartPanel>
 * ```
 */
export const InteractiveChartPanel = Object.assign(InteractiveChartPanelRoot, {
  /**
   * Panel header with fold controls and settings toggle.
   * @see HeaderProps
   */
  Header,

  /**
   * Horizontal tab navigation bar.
   * @see TabBarProps
   */
  TabBar,

  /**
   * Main content area that renders active tab.
   * @see ContentProps
   */
  Content,

  /**
   * Animated settings drawer containing TabBar + Content.
   * @see SettingsPanelProps
   */
  SettingsPanel,
});

// =============================================================================
// Re-exports
// =============================================================================

export type { HeaderProps, TabBarProps, ContentProps, SettingsPanelProps };
export { Header, TabBar, Content, SettingsPanel };
