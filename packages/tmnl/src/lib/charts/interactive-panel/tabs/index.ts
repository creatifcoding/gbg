/**
 * Tab Registry
 *
 * Effect-native tab resolution using Match.exhaustive.
 * Components use Schema.is guards for runtime tabId validation.
 *
 * @module charts/interactive-panel/tabs
 */

import { Match } from 'effect';
import type { TabId } from '../schemas';
import type { TabComponent } from './types';

// =============================================================================
// Tab Component Imports
// =============================================================================

import { StyleTab } from './StyleTab';
import { DataTab } from './DataTab';
import { AxesTab } from './AxesTab';
import { SeriesTab } from './SeriesTab';
import { LabelsTab } from './LabelsTab';
import { StatisticsTab } from './StatisticsTab';
import { NodesTab } from './NodesTab';
import { RegressionTab } from './RegressionTab';
import { ThresholdsTab } from './ThresholdsTab';
import { WordsTab } from './WordsTab';
import { HierarchyTab } from './HierarchyTab';
import { LayoutTab } from './LayoutTab';

// =============================================================================
// Tab Renderer Registry
// =============================================================================

/**
 * Static map of TabId → TabComponent.
 * Use this for direct lookups when TabId is known.
 */
export const TAB_RENDERERS: Record<TabId, TabComponent> = {
  style: StyleTab,
  data: DataTab,
  axes: AxesTab,
  series: SeriesTab,
  labels: LabelsTab,
  statistics: StatisticsTab,
  nodes: NodesTab,
  regression: RegressionTab,
  thresholds: ThresholdsTab,
  words: WordsTab,
  hierarchy: HierarchyTab,
  layout: LayoutTab,
};

/**
 * Match-based exhaustive tab resolver.
 *
 * Uses Effect's Match for compile-time enforcement that all TabIds are handled.
 * If a new TabId is added to the schema, this will cause a compile error
 * until a matching case is added.
 *
 * @example
 * ```ts
 * const Component = resolveTabRenderer('style');
 * ```
 */
export const resolveTabRenderer = Match.type<TabId>().pipe(
  Match.when('style', () => StyleTab),
  Match.when('data', () => DataTab),
  Match.when('axes', () => AxesTab),
  Match.when('series', () => SeriesTab),
  Match.when('labels', () => LabelsTab),
  Match.when('statistics', () => StatisticsTab),
  Match.when('nodes', () => NodesTab),
  Match.when('regression', () => RegressionTab),
  Match.when('thresholds', () => ThresholdsTab),
  Match.when('words', () => WordsTab),
  Match.when('hierarchy', () => HierarchyTab),
  Match.when('layout', () => LayoutTab),
  Match.exhaustive
);

/**
 * Get a tab component for a given TabId.
 *
 * This is the primary entry point for rendering tabs.
 * Uses Match.exhaustive for compile-time safety.
 *
 * @param tabId - The tab ID to resolve
 * @returns The tab component for the given ID
 *
 * @example
 * ```tsx
 * const TabComponent = getTabComponent('style');
 * return <TabComponent tabId="style" panelId="..." chartId="..." />;
 * ```
 */
export function getTabComponent(tabId: TabId): TabComponent {
  return resolveTabRenderer(tabId);
}

/**
 * Check if a tab component exists for the given ID.
 * Always returns true for built-in tabs (enforced by schema).
 *
 * @param tabId - The tab ID to check
 */
export function hasTabComponent(tabId: TabId): boolean {
  return tabId in TAB_RENDERERS;
}

// =============================================================================
// Re-exports
// =============================================================================

export type { TabProps, TabComponent } from './types';
export {
  isStyleTab,
  isDataTab,
  isAxesTab,
  isSeriesTab,
  isLabelsTab,
  isStatisticsTab,
  isNodesTab,
  isRegressionTab,
  isThresholdsTab,
  isWordsTab,
  isHierarchyTab,
  isLayoutTab,
  createTabGuard,
} from './types';

// Export individual tab components for direct imports
export {
  StyleTab,
  DataTab,
  AxesTab,
  SeriesTab,
  LabelsTab,
  StatisticsTab,
  NodesTab,
  RegressionTab,
  ThresholdsTab,
  WordsTab,
  HierarchyTab,
  LayoutTab,
};
