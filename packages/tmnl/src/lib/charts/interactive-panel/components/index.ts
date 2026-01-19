/**
 * InteractiveChartPanel Components
 *
 * Compound components for interactive chart panels.
 *
 * @module charts/interactive-panel/components
 */

// Main compound component
export {
  InteractiveChartPanel,
  type InteractiveChartPanelProps,
} from './InteractiveChartPanel';

// Sub-components (also available as InteractiveChartPanel.X)
export { Header, type HeaderProps } from './Header';
export { TabBar, type TabBarProps } from './TabBar';
export { Content, type ContentProps } from './Content';
export { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';
