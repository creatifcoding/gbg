/**
 * Tab Registry
 *
 * Type-level mapping: ChartCategory → TabId[]
 * Enables compile-time enforcement of tab availability per category.
 *
 * @module charts/interactive-panel/schemas/tab-registry
 */

import type { ChartCategory } from '../../registry/definitions';
import type { TabId } from './tab-id';

/**
 * Type-level mapping: ChartCategory → TabId[]
 *
 * This type propagates at inference time, enabling:
 * - Compile-time enforcement of tab availability per category
 * - Exhaustive matching for tab renderers
 * - IDE autocompletion of valid tabs per category
 *
 * @example
 * ```ts
 * // TypeScript infers: 'style' | 'data' | 'series'
 * type TrendTabs = TabsForCategory<'trend'>;
 *
 * // This would be a type error (missing 'series'):
 * const tabs: TrendTabs = 'style' | 'data'; // Error!
 * ```
 */
export type TabsForCategory<C extends ChartCategory> =
  C extends 'comparison' ? 'style' | 'data' | 'axes' :
  C extends 'trend' ? 'style' | 'data' | 'series' :
  C extends 'part-to-whole' ? 'style' | 'data' | 'labels' :
  C extends 'distribution' ? 'style' | 'data' | 'statistics' :
  C extends 'ranking' ? 'style' | 'data' :
  C extends 'flow' ? 'style' | 'data' | 'nodes' :
  C extends 'correlation' ? 'style' | 'data' | 'regression' :
  C extends 'kpi' ? 'style' | 'data' | 'thresholds' :
  C extends 'text' ? 'style' | 'data' | 'words' :
  C extends 'hierarchical' ? 'style' | 'data' | 'hierarchy' :
  C extends 'network' ? 'style' | 'data' | 'layout' :
  C extends 'sparkline' ? 'style' :
  never;

/**
 * Runtime array mapping (mirrors type-level).
 * Used for iteration; type safety comes from TabsForCategory.
 *
 * @example
 * ```ts
 * const tabs = TABS_BY_CATEGORY['trend'];
 * // tabs: readonly ['style', 'data', 'series']
 *
 * tabs.forEach(tabId => {
 *   const renderer = TAB_RENDERERS[tabId];
 *   // TypeScript knows tabId is valid
 * });
 * ```
 */
export const TABS_BY_CATEGORY: Record<ChartCategory, readonly TabId[]> = {
  comparison: ['style', 'data', 'axes'],
  trend: ['style', 'data', 'series'],
  'part-to-whole': ['style', 'data', 'labels'],
  distribution: ['style', 'data', 'statistics'],
  ranking: ['style', 'data'],
  flow: ['style', 'data', 'nodes'],
  correlation: ['style', 'data', 'regression'],
  kpi: ['style', 'data', 'thresholds'],
  text: ['style', 'data', 'words'],
  hierarchical: ['style', 'data', 'hierarchy'],
  network: ['style', 'data', 'layout'],
  sparkline: ['style'],
} as const;

/**
 * Get tabs for a category (type-safe).
 *
 * @example
 * ```ts
 * const tabs = getTabsForCategory('trend');
 * // tabs: readonly TabId[] with type safety
 * ```
 */
export function getTabsForCategory<C extends ChartCategory>(
  category: C
): readonly TabsForCategory<C>[] {
  return TABS_BY_CATEGORY[category] as readonly TabsForCategory<C>[];
}

/**
 * Check if a tab is available for a category.
 *
 * @example
 * ```ts
 * isTabAvailable('trend', 'series'); // true
 * isTabAvailable('trend', 'axes'); // false
 * ```
 */
export function isTabAvailable(category: ChartCategory, tabId: TabId): boolean {
  return TABS_BY_CATEGORY[category].includes(tabId);
}

/**
 * Get the default tab for a category.
 * Always returns 'style' as it's universal.
 *
 * @example
 * ```ts
 * const defaultTab = getDefaultTab('trend');
 * // defaultTab: 'style'
 * ```
 */
export function getDefaultTab<C extends ChartCategory>(
  _category: C
): TabsForCategory<C> {
  return 'style' as TabsForCategory<C>;
}

/**
 * Categories that include a specific tab.
 *
 * @example
 * ```ts
 * const categories = getCategoriesWithTab('axes');
 * // categories: ['comparison']
 * ```
 */
export function getCategoriesWithTab(tabId: TabId): ChartCategory[] {
  return (Object.entries(TABS_BY_CATEGORY) as [ChartCategory, readonly TabId[]][])
    .filter(([_, tabs]) => tabs.includes(tabId))
    .map(([category]) => category);
}

/**
 * Tab contract for external registration (extends built-in tabs).
 * Used by plugins to register custom tabs.
 *
 * @example
 * ```ts
 * const customTab: TabContract = {
 *   id: 'custom-ai',
 *   label: 'AI Assistant',
 *   icon: 'Sparkles',
 *   priority: 10,
 *   categories: ['trend', 'comparison'],
 * };
 * ```
 */
export interface TabContract {
  /** Unique tab identifier */
  readonly id: string;
  /** Display label */
  readonly label: string;
  /** Icon name (lucide-react compatible) */
  readonly icon?: string;
  /** Priority for tab ordering (lower = first) */
  readonly priority?: number;
  /** Categories this tab applies to (empty = all categories) */
  readonly categories?: readonly ChartCategory[];
}

/**
 * Validate a tab contract.
 * Returns true if the contract is valid.
 */
export function isValidTabContract(contract: unknown): contract is TabContract {
  if (typeof contract !== 'object' || contract === null) return false;
  const c = contract as Record<string, unknown>;
  if (typeof c['id'] !== 'string' || (c['id'] as string).length === 0) return false;
  if (typeof c['label'] !== 'string' || (c['label'] as string).length === 0) return false;
  if (c['icon'] !== undefined && typeof c['icon'] !== 'string') return false;
  if (c['priority'] !== undefined && typeof c['priority'] !== 'number') return false;
  if (c['categories'] !== undefined && !Array.isArray(c['categories'])) return false;
  return true;
}
