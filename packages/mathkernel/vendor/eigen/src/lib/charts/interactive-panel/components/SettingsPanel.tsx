/**
 * InteractiveChartPanel SettingsPanel
 *
 * Animated settings drawer containing TabBar + Content.
 *
 * @module charts/interactive-panel/components/SettingsPanel
 */

import { useAtomValue } from '@effect-atom/atom-react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { usePanelContext } from '../context';
import { TabBar, type TabBarProps } from './TabBar';
import { Content, type ContentProps } from './Content';

export interface SettingsPanelProps {
  /** TabBar props */
  tabBarProps?: TabBarProps;
  /** Content props */
  contentProps?: ContentProps;
  /** Maximum height of the settings panel */
  maxHeight?: number | string;
  /** Animation duration in seconds */
  animationDuration?: number;
}

/**
 * SettingsPanel component for InteractiveChartPanel.
 *
 * Animated drawer that contains:
 * - TabBar for navigation
 * - Content for active tab
 *
 * Opens/closes based on settingsOpen atom.
 */
export function SettingsPanel({
  tabBarProps,
  contentProps,
  maxHeight = 300,
  animationDuration = 0.2,
}: SettingsPanelProps) {
  const { atoms } = usePanelContext();

  const settingsOpen = useAtomValue(atoms.settingsOpenAtom);
  const contentVisible = useAtomValue(atoms.contentVisibleAtom);

  // Don't render if panel is minimized
  if (!contentVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: animationDuration }}
          style={{
            overflow: 'hidden',
            borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
            background: VANTA_COLORS.surface.default,
            borderRadius: `0 0 ${VANTA_BORDERS.radius.md} ${VANTA_BORDERS.radius.md}`,
          }}
        >
          <div
            style={{
              maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
              overflowY: 'auto',
            }}
          >
            <TabBar {...tabBarProps} />
            <Content {...contentProps} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SettingsPanel;
