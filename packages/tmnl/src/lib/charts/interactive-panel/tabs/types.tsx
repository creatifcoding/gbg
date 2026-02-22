/**
 * Tab Types
 *
 * Effect Schema-based types for tab components.
 * Uses Schema.is for runtime validation of tabId.
 *
 * @module charts/interactive-panel/tabs/types
 */

import { Schema } from 'effect';
import { TabId } from '../schemas';

/**
 * Tab props as Effect Schema.
 * Single type - tabId discriminates at runtime via Schema.is.
 */
export const TabProps = Schema.Struct({
  /** The tab ID this component is rendering */
  tabId: TabId,
  /** The panel ID this tab belongs to */
  panelId: Schema.String,
  /** The chart ID for style/data operations */
  chartId: Schema.String,
  /** Optional chart type for type-specific settings */
  chartType: Schema.optional(Schema.String),
});

/**
 * TabProps type extracted from schema.
 */
export type TabProps = typeof TabProps.Type;

/**
 * Tab component type - accepts TabProps, uses tabId for discrimination.
 */
export type TabComponent = React.ComponentType<TabProps>;

// =============================================================================
// TabId Guards (Schema.is)
// =============================================================================

/**
 * Schema.is guards for each TabId.
 * Use these in components to validate the expected tabId.
 *
 * @example
 * ```tsx
 * export function StyleTab(props: TabProps) {
 *   if (!isStyleTab(props.tabId)) {
 *     return <InvalidTabError expected="style" received={props.tabId} />;
 *   }
 *   // props.tabId is now narrowed to 'style'
 * }
 * ```
 */
export const isStyleTab = Schema.is(Schema.Literal('style'));
export const isDataTab = Schema.is(Schema.Literal('data'));
export const isAxesTab = Schema.is(Schema.Literal('axes'));
export const isSeriesTab = Schema.is(Schema.Literal('series'));
export const isLabelsTab = Schema.is(Schema.Literal('labels'));
export const isStatisticsTab = Schema.is(Schema.Literal('statistics'));
export const isNodesTab = Schema.is(Schema.Literal('nodes'));
export const isRegressionTab = Schema.is(Schema.Literal('regression'));
export const isThresholdsTab = Schema.is(Schema.Literal('thresholds'));
export const isWordsTab = Schema.is(Schema.Literal('words'));
export const isHierarchyTab = Schema.is(Schema.Literal('hierarchy'));
export const isLayoutTab = Schema.is(Schema.Literal('layout'));

/**
 * Generic tabId guard factory.
 * Creates a guard for any TabId value.
 *
 * @example
 * ```ts
 * const isMyTab = createTabGuard('style');
 * if (isMyTab(props.tabId)) { ... }
 * ```
 */
export function createTabGuard<T extends typeof TabId.Type>(expected: T) {
  return Schema.is(Schema.Literal(expected));
}
