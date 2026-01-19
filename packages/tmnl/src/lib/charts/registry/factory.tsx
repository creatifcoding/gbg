/**
 * Chart Registry Factory
 *
 * Factory functions to create ComponentDef entries from ChartDefinition.
 * Enables integration with the json-render CatalogService.
 *
 * Charts are wrapped in FoldablePanel for interactive usage.
 *
 * @module charts/registry/factory
 */

import type { ReactNode } from 'react';
import type {
  ComponentDef,
  ComponentRenderProps,
  DomainCatalog,
} from '@/lib/json-render/core/CatalogService';

import { CHART_DEFINITIONS, type ChartDefinition, type ChartCategory } from './definitions';
import { ChartRenderer } from '../components/ChartRenderer';
import { FoldablePanel, type PanelTag } from '@/lib/foldable-panel';
import { InteractiveChartPanel, getTabsForCategory } from '../interactive-panel';

// =============================================================================
// Panel Types
// =============================================================================

/**
 * Panel wrapper type for chart rendering
 *
 * - none: No wrapper, just the chart (default)
 * - foldable: Simple collapsible panel (FoldablePanel)
 * - interactive: Full settings panel with tabs (InteractiveChartPanel)
 */
export type ChartPanelType = 'none' | 'foldable' | 'interactive';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a renderer function for a chart type
 *
 * Charts can optionally be wrapped in panels for interactive usage.
 *
 * Panel types:
 * - 'none': No wrapper, just the chart (default)
 * - 'foldable': FoldablePanel with collapse/expand
 * - 'interactive': InteractiveChartPanel with tabs and settings
 *
 * Props passed through for panel/styling:
 * - chartId: Unique chart ID for per-chart style atoms
 * - stylePrompt: Triggers LLM styling agent on mount
 * - styleIntent: Guides palette selection (cyberpunk, minimal, etc.)
 * - panelType: Which wrapper to use ('none' | 'foldable' | 'interactive')
 * - interactive: (deprecated) Use panelType='foldable' instead
 * - badge: Custom badge object { tag: PanelTag, label: string }
 * - panelLabel: (deprecated) Use badge.label instead
 * - panelTag: (deprecated) Use badge.tag instead
 * - expandedHeight: Panel height when expanded (default: 320)
 * - collapsedHeight: Panel height when collapsed (default: 48)
 *
 * InteractiveChartPanel-specific props:
 * - category: Chart category for tab filtering (auto-resolved from chartType)
 * - availableTabs: Override available tabs for the panel
 * - initialTab: Initial active tab (default: 'style')
 *
 * Sizing props:
 * - height: Explicit chart height (number in px or string CSS value)
 * - fill: Whether chart fills parent container (default: true)
 */
const createChartRenderer = (chartType: string, chartCategory: ChartCategory) => {
  return function ChartComponentRenderer(
    props: ComponentRenderProps
  ): ReactNode {
    const elementProps = props.element.props;

    // Extract panel-specific props
    const chartId =
      (elementProps['chartId'] as string | undefined) ?? props.element.key;

    // Panel type - supports new prop and deprecated 'interactive' boolean
    const panelTypeProp = elementProps['panelType'] as ChartPanelType | undefined;
    const interactiveProp = elementProps['interactive'] as boolean | undefined;
    const panelType: ChartPanelType = panelTypeProp ??
      (interactiveProp === true ? 'foldable' : 'none');

    // Badge configuration - supports full badge object or individual props
    const badgeProp = elementProps['badge'] as
      | { tag?: PanelTag; label?: string }
      | undefined;
    const panelTag =
      badgeProp?.tag ??
      (elementProps['panelTag'] as PanelTag | undefined) ??
      'chart';
    const panelLabel =
      badgeProp?.label ??
      (elementProps['panelLabel'] as string | undefined) ??
      chartType;

    // Panel dimensions
    const expandedHeight =
      (elementProps['expandedHeight'] as number | undefined) ?? 320;
    const collapsedHeight =
      (elementProps['collapsedHeight'] as number | undefined) ?? 48;

    // Chart sizing - default to intrinsic height, not fill
    const chartHeight = elementProps['height'] as number | string | undefined;
    const chartFill = (elementProps['fill'] as boolean | undefined) ?? false;

    // InteractiveChartPanel-specific props
    const category = (elementProps['category'] as ChartCategory | undefined) ?? chartCategory;
    const availableTabs = elementProps['availableTabs'] as string[] | undefined;
    const initialTab = elementProps['initialTab'] as string | undefined;

    // Core chart element
    const chartElement = (
      <ChartRenderer
        chartType={chartType as any}
        config={elementProps}
        loading={props.loading}
        chartId={chartId}
        height={chartHeight}
        fill={chartFill}
        stylePrompt={elementProps['stylePrompt'] as string | undefined}
        styleIntent={elementProps['styleIntent'] as string | undefined}
      />
    );

    // Return unwrapped chart if panelType='none'
    if (panelType === 'none') {
      return chartElement;
    }

    // InteractiveChartPanel wrapper
    if (panelType === 'interactive') {
      const tabs = availableTabs ?? getTabsForCategory(category);
      return (
        <InteractiveChartPanel
          panelId={`${chartId}-panel`}
          chartId={chartId}
          category={category}
          availableTabs={tabs as any}
          initialTab={initialTab as any}
        >
          <InteractiveChartPanel.Header title={panelLabel} />
          {chartElement}
          <InteractiveChartPanel.SettingsPanel maxHeight={expandedHeight} />
        </InteractiveChartPanel>
      );
    }

    // FoldablePanel wrapper (panelType='foldable')
    return (
      <FoldablePanel
        panelId={chartId}
        badge={{ tag: panelTag, label: panelLabel }}
        expandedHeight={expandedHeight}
        collapsedHeight={collapsedHeight}
        initialFoldState="expanded"
        showDragHandle={false}
        isEditable={false}
      >
        {chartElement}
      </FoldablePanel>
    );
  };
};

/**
 * Create a ComponentDef from a ChartDefinition
 *
 * Maps the chart definition to the json-render catalog format,
 * creating a renderer that delegates to ChartRenderer.
 */
export const createChartComponentDef = (
  definition: ChartDefinition
): ComponentDef => ({
  schema: definition.schema,
  description: formatDescription(definition),
  hasChildren: definition.hasChildren ?? false,
  defaultEntrance: definition.defaultEntrance,
  renderer: createChartRenderer(definition.type, definition.category),
});

/**
 * Format description with metadata for AI generation
 */
const formatDescription = (def: ChartDefinition): string => {
  const parts = [def.description];

  if (def.useCases.length > 0) {
    parts.push(`Use cases: ${def.useCases.join(', ')}.`);
  }

  if (def.requiredFields && def.requiredFields.length > 0) {
    parts.push(`Required fields: ${def.requiredFields.join(', ')}.`);
  }

  if (def.seriesField) {
    parts.push('Supports seriesField for multi-series grouping.');
  }

  // Add panel documentation with decision tree
  parts.push(
    'PANEL WRAPPING: Use panelType prop to control wrapper: "none" (default, unwrapped), "foldable" (collapsible), "interactive" (tabs + settings).'
  );
  parts.push(
    'Use panelType="interactive" when: (1) Chart needs per-chart settings UI, (2) User customizes style/data/axes in panel, (3) Chart is standalone with full controls.'
  );
  parts.push(
    'Use panelType="foldable" when: (1) Chart needs simple collapse/expand, (2) No settings tabs needed, (3) Space-saving required.'
  );
  parts.push(
    'Keep panelType="none" (unwrapped) when: (1) Chart in dashboard grid, (2) Chart in card/container, (3) Inline visualization, (4) Chart already wrapped by parent.'
  );
  parts.push(
    'Badge props (for foldable): badge={tag:"chart",label:"Custom"} or panelTag/panelLabel.'
  );
  parts.push(
    'Tags: chart (emerald), map (cyan), 3d (purple), data-grid (orange), media (rose), custom (slate).'
  );
  parts.push(
    'InteractiveChartPanel props: category (auto), availableTabs (override tabs), initialTab (default: "style").'
  );

  // Add sizing props documentation
  parts.push(
    'SIZING: Charts use intrinsic height by default. Set height=300 for explicit height, or fill=true to expand to parent.'
  );
  parts.push(
    'For responsive layouts, use fill=true with a parent that has defined height.'
  );

  // Add styling props documentation
  parts.push(
    'LLM styling: Pass chartId + stylePrompt to trigger AI styling agent.'
  );
  parts.push(
    'Intents: cyberpunk, minimal, emphasize-trend, highlight-outliers, data-dense.'
  );

  return parts.join(' ');
};

// =============================================================================
// Catalog Creation
// =============================================================================

/**
 * Create the chart domain catalog for json-render integration
 *
 * @example
 * ```ts
 * import { createChartDomainCatalog } from '@/lib/charts/registry/factory'
 * import { createCatalogLayer } from '@/lib/json-render/core/CatalogService'
 *
 * const CatalogLive = createCatalogLayer(
 *   layoutDomainCatalog,
 *   createChartDomainCatalog()
 * )
 * ```
 */
export const createChartDomainCatalog = (): DomainCatalog => ({
  name: 'TMNL Charts',
  components: Object.fromEntries(
    CHART_DEFINITIONS.map((def) => [def.type, createChartComponentDef(def)])
  ),
});

/**
 * Pre-built chart domain catalog instance
 *
 * Use this directly when you don't need to customize the catalog.
 */
export const chartDomainCatalog: DomainCatalog = createChartDomainCatalog();

// =============================================================================
// AI Generation Helpers
// =============================================================================

/**
 * Get chart recommendations based on data shape
 *
 * Used by AI to suggest appropriate chart types based on the data structure.
 */
export const getChartRecommendations = (
  dataShape:
    | 'categorical'
    | 'time-series'
    | 'hierarchical'
    | 'network'
    | 'distribution'
    | 'single-value'
): readonly ChartDefinition[] => {
  return CHART_DEFINITIONS.filter((def) => def.dataShapes.includes(dataShape));
};

/**
 * Generate data-first chart selection guidance for AI
 */
export const generateChartSelectionPrompt = (): string => {
  const categoryDescriptions: Record<string, string> = {
    comparison: 'Comparing values across categories',
    trend: 'Showing change over time or sequence',
    'part-to-whole': 'Showing proportions and compositions',
    distribution: 'Showing statistical distribution and spread',
    ranking: 'Showing ordered/ranked data',
    flow: 'Showing process flow and transitions',
    correlation: 'Showing relationships between variables',
    kpi: 'Showing single metrics and progress',
    text: 'Visualizing text frequency and importance',
    hierarchical: 'Showing tree structures and hierarchies',
    network: 'Showing node-edge relationships',
    sparkline: 'Compact inline visualizations',
  };

  const lines = [
    '# Chart Selection Guide (Data-First Approach)',
    '',
    'Choose charts based on what you want to show, not what looks cool.',
    '',
  ];

  for (const [category, description] of Object.entries(categoryDescriptions)) {
    const charts = CHART_DEFINITIONS.filter((d) => d.category === category);
    lines.push(
      `## ${
        category.charAt(0).toUpperCase() + category.slice(1)
      }: ${description}`
    );
    lines.push('');
    for (const chart of charts) {
      lines.push(`- **${chart.type}**: ${chart.description.split('.')[0]}`);
    }
    lines.push('');
  }

  return lines.join('\n');
};
