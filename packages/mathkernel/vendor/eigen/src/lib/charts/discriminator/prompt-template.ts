/**
 * Chart Discriminator Prompt Template
 *
 * Full chart knowledge prompt for first-stage intent extraction.
 * This is the single point of chart expertise - downstream agents
 * receive only scoped mini-schemas.
 *
 * @module charts/discriminator/prompt-template
 */

import {
  allCharts,
  CATEGORY_DESCRIPTIONS,
  ALL_CATEGORIES,
} from '../composable/categories';
import { ChartCatalog } from '../composable/ComposableCatalog';
import type { SelectionConstraints } from './schemas';

// =============================================================================
// System Prompt Generation
// =============================================================================

/**
 * Generate the full system prompt for chart discrimination.
 *
 * This prompt contains:
 * 1. Role definition and task framing
 * 2. Complete category overview
 * 3. All chart types with descriptions and use cases
 * 4. Data shape guidance
 * 5. Output format specification
 */
export function generateSystemPrompt(constraints?: SelectionConstraints): string {
  // Determine which catalogs to include based on constraints
  let catalog: ChartCatalog = allCharts;

  if (constraints?.onlyTypes && constraints.onlyTypes.length > 0) {
    catalog = catalog.pick(...constraints.onlyTypes);
  }

  if (constraints?.excludeTypes && constraints.excludeTypes.length > 0) {
    catalog = catalog.omit(...constraints.excludeTypes);
  }

  if (constraints?.preferCategories && constraints.preferCategories.length > 0) {
    // Cast is safe: schema categories are a subset of ChartCategory
    const preferredSet = new Set(constraints.preferCategories);
    catalog = catalog.filter(def => preferredSet.has(def.category as typeof constraints.preferCategories[number]));
  }

  if (constraints?.excludeCategories && constraints.excludeCategories.length > 0) {
    const excludedSet = new Set(constraints.excludeCategories);
    catalog = catalog.filter(def => !excludedSet.has(def.category as typeof constraints.excludeCategories[number]));
  }

  if (constraints?.requiresHierarchical) {
    catalog = catalog.hierarchical();
  }

  if (constraints?.requiresSeriesSupport) {
    catalog = catalog.withSeriesSupport();
  }

  return `# Chart Discriminator Agent

You are a specialized chart selection agent. Your role is to analyze user visualization requests and recommend the most appropriate chart type(s) with configuration.

## Your Expertise

You have deep knowledge of ${catalog.size} chart types across ${ALL_CATEGORIES.length} categories. You understand:
- Which charts work best for different data shapes
- The visual affordances of each chart type
- Common use cases and best practices
- Required vs optional configuration fields

## Chart Categories

${generateCategorySection(catalog)}

## Available Chart Types

${generateChartTypesSection(catalog)}

## Data Shape Guidance

${DATA_SHAPE_GUIDANCE}

## Selection Process

When selecting a chart:

1. **Understand Intent**: What insight does the user want? Comparison? Trend? Distribution?
2. **Match Data Shape**: What structure does the data have? Categorical? Time-series? Hierarchical?
3. **Consider Audience**: Is this for a dashboard? Report? Exploration?
4. **Pick Category First**: Narrow to 1-2 relevant categories
5. **Select Chart Type**: Choose the most appropriate within category
6. **Configure Fields**: Map data fields to chart requirements

## Output Format

Respond with a JSON object matching this structure:

\`\`\`json
{
  "primary": {
    "chartType": "Line",
    "config": {
      "xField": "date",
      "yField": "value",
      "seriesField": "category"
    },
    "confidence": 0.9,
    "rationale": "User wants to see trends over time with multiple series",
    "expectedInsight": "Compare how different categories change over time"
  },
  "alternatives": [
    {
      "chartType": "Area",
      "config": {...},
      "confidence": 0.7,
      "rationale": "Could emphasize magnitude with filled areas",
      "expectedInsight": "See cumulative volume alongside trend"
    }
  ],
  "miniSchemas": [...],
  "consideredCategories": ["trend", "comparison"],
  "reasoning": "The user prompt mentions 'over time' indicating temporal data...",
  "wasAmbiguous": false
}
\`\`\`

## Handling Ambiguity

If the user's request is ambiguous:
1. Set \`wasAmbiguous: true\`
2. Add \`clarificationQuestions\` array with specific questions
3. Still provide a best-guess primary recommendation

## Important Rules

- Always provide at least one recommendation
- Confidence should reflect how well the chart matches the use case
- Rationale should explain WHY this chart fits
- ExpectedInsight should describe WHAT the user will learn
- MiniSchemas should include only the recommended chart types

## Panel Wrapping Options

Charts support three wrapper modes via the \`panelType\` prop:

### panelType: "none" (default)
No wrapper - bare chart for embedding in cards, grids, or custom containers.
Use when: Dashboard grids, card containers, inline visualizations.

### panelType: "foldable"
Simple collapsible FoldablePanel wrapper. Provides:
- Collapsible header with chart type badge
- Collapse/expand functionality
- Optional resize handle

Use when: Standalone charts needing space-saving collapse.

### panelType: "interactive"
Full InteractiveChartPanel with tabbed settings. Provides:
- Header with fold controls and settings toggle
- Tabbed settings panel (Style, Data, Axes, Series, etc.)
- Category-aware tab filtering (trend charts get trend-relevant tabs)
- Per-chart style atoms integration

Use when: Charts requiring user-configurable settings UI.

## Panel Configuration Props

\`\`\`json
{
  "panelType": "interactive",  // "none" | "foldable" | "interactive"
  "chartId": "unique-id",      // Required for styling/state
  "panelLabel": "Custom Label", // Header title
  "panelTag": "chart",         // Badge tag (foldable only)
  "category": "trend",         // Override category (interactive only)
  "availableTabs": ["style", "data", "axes"], // Override tabs (interactive only)
  "initialTab": "style",       // Starting tab (interactive only)
  "expandedHeight": 320,       // Panel height
  "collapsedHeight": 48        // Collapsed height (foldable only)
}
\`\`\`

## Decision Tree

1. **In dashboard grid?** → panelType: "none" (let grid handle layout)
2. **In card/container?** → panelType: "none" (avoid double-wrapping)
3. **Standalone, needs collapse?** → panelType: "foldable"
4. **Needs settings UI?** → panelType: "interactive"
`;
}

// =============================================================================
// Section Generators
// =============================================================================

function generateCategorySection(catalog: ChartCatalog): string {
  const lines: string[] = [];

  for (const category of ALL_CATEGORIES) {
    const categoryCharts = catalog.byCategory(category);
    if (categoryCharts.size > 0) {
      const chartNames = categoryCharts.getTypeNames().join(', ');
      const description = CATEGORY_DESCRIPTIONS[category] || '';

      lines.push(`### ${formatCategoryName(category)}`);
      lines.push(description);
      lines.push(`**Charts:** ${chartNames}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateChartTypesSection(catalog: ChartCatalog): string {
  const lines: string[] = [];

  for (const def of catalog) {
    lines.push(`### ${def.type}`);
    lines.push(def.description);
    lines.push(`- **Category:** ${formatCategoryName(def.category)}`);
    lines.push(`- **Data shapes:** ${def.dataShapes.join(', ')}`);
    lines.push(`- **Use cases:** ${def.useCases.join(', ')}`);

    if (def.requiredFields && def.requiredFields.length > 0) {
      lines.push(`- **Required fields:** ${def.requiredFields.join(', ')}`);
    }

    if (def.seriesField) {
      lines.push(`- **Supports series grouping:** Yes`);
    }

    if (def.hasChildren) {
      lines.push(`- **Supports hierarchical data:** Yes`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// Data Shape Guidance
// =============================================================================

const DATA_SHAPE_GUIDANCE = `
### Categorical Data \`{ category, value }\`
Best charts: **Bar**, **Column**, **Pie**, **Radar**, **Rose**
Example: Survey results, feature comparison, market share

### Time-Series Data \`{ date, value }\`
Best charts: **Line**, **Area**, **Stock**, **Column**
Example: Stock prices, metrics over time, sensor readings

### Hierarchical Data \`{ id, parent, children, value }\`
Best charts: **Treemap**, **Sunburst**, **CirclePacking**, **OrganizationChart**, **MindMap**
Example: File systems, org charts, nested categories

### Network Data \`{ nodes[], edges[] }\`
Best charts: **NetworkGraph**, **FlowGraph**, **FlowDirectionGraph**, **Sankey**
Example: Social networks, workflows, data pipelines

### Distribution Data \`[numbers]\`
Best charts: **Histogram**, **Box**, **Violin**, **Scatter**
Example: Test scores, salary distribution, age demographics

### Multi-Series Data \`{ x, y, series }\`
Best charts: **Line**, **Area**, **Bar**, **Column** (with seriesField)
Example: Multiple product sales over time, A/B test results

### Single Value \`0-1\`
Best charts: **Gauge**, **Liquid**, **Bullet**
Example: Completion percentage, performance score, fill level

### Range/OHLC Data \`{ date, open, high, low, close }\`
Best charts: **Stock**, **Waterfall**
Example: Financial data, inventory changes
`;

// =============================================================================
// Mini-Schema Generation
// =============================================================================

/**
 * Generate mini-schema for a specific chart type.
 *
 * Used to provide scoped knowledge to downstream agents.
 */
export function generateMiniSchema(chartType: string): string | null {
  const def = allCharts.get(chartType);
  if (!def) return null;

  const miniSchema = {
    type: def.type,
    description: def.description,
    category: def.category,
    dataShapes: def.dataShapes,
    requiredFields: def.requiredFields || [],
    supportsSeriesGrouping: def.seriesField ?? false,
    usageHint: def.useCases.join('; '),
  };

  return JSON.stringify(miniSchema, null, 2);
}

/**
 * Generate mini-schemas for multiple chart types.
 */
export function generateMiniSchemas(chartTypes: string[]): string {
  const schemas = chartTypes
    .map(generateMiniSchema)
    .filter((s): s is string => s !== null);

  return schemas.join('\n\n---\n\n');
}

/**
 * Generate scoped prompt for downstream agents.
 *
 * Contains only the chart types that were recommended.
 */
export function generateScopedPrompt(chartTypes: string[]): string {
  const subset = allCharts.pick(...chartTypes);

  return `# Chart Configuration Guide

You are configuring one of these chart types:

${subset.generateMiniSchema()}

## Configuration Rules

1. All required fields MUST be provided
2. Field names must match the data structure exactly
3. Series field enables grouping/comparison
4. Color field enables categorical coloring

## Example Configuration

\`\`\`json
{
  "chartType": "Line",
  "xField": "date",
  "yField": "value",
  "seriesField": "category",
  "smooth": true
}
\`\`\`
`;
}
