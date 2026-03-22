/**
 * InteractiveChartPanel Content
 *
 * Main content area that renders the active tab.
 *
 * @module charts/interactive-panel/components/Content
 */

import { useAtomValue } from '@effect-atom/atom-react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  VANTA_COLORS,
  VANTA_SPACING,
} from '@/components/portal/tokens';
import { usePanelContext } from '../context';
import { getTabComponent, type TabProps } from '../tabs';

export interface ContentProps {
  /** Custom content (overrides tab rendering) */
  children?: React.ReactNode;
  /** Animation duration in seconds */
  animationDuration?: number;
  /** Disable tab content animation */
  disableAnimation?: boolean;
}

/**
 * Content component for InteractiveChartPanel.
 *
 * Renders the active tab component with:
 * - AnimatePresence for tab transitions
 * - Props forwarding to tab components
 * - Fallback to children if provided
 */
export function Content({
  children,
  animationDuration = 0.15,
  disableAnimation = false,
}: ContentProps) {
  const { atoms, panelId, chartId } = usePanelContext();

  const activeTab = useAtomValue(atoms.activeTabAtom);
  const contentVisible = useAtomValue(atoms.contentVisibleAtom);

  // Don't render if minimized
  if (!contentVisible) {
    return null;
  }

  // Use custom children if provided
  if (children) {
    return (
      <div
        style={{
          padding: VANTA_SPACING['3'],
          background: VANTA_COLORS.surface.default,
        }}
      >
        {children}
      </div>
    );
  }

  // Resolve tab component
  const TabComponent = getTabComponent(activeTab);

  // Build props for tab component
  const tabProps: TabProps = {
    tabId: activeTab,
    panelId,
    chartId,
  };

  // Render with or without animation
  const content = <TabComponent {...tabProps} />;

  if (disableAnimation) {
    return (
      <div
        style={{
          padding: VANTA_SPACING['3'],
          background: VANTA_COLORS.surface.default,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: VANTA_SPACING['3'],
        background: VANTA_COLORS.surface.default,
        overflow: 'hidden',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: animationDuration }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default Content;
