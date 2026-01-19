/**
 * Chart Registry Module
 *
 * Centralized registry for all 40 Ant Design chart types.
 * Provides definitions, factory, and lookup utilities.
 *
 * @module charts/registry
 */

// Definitions
export {
  CHART_DEFINITIONS,
  CHART_DEFINITIONS_BY_TYPE,
  getChartDefinition,
  getChartsByCategory,
  getChartsByDataShape,
  type ChartDefinition,
  type ChartCategory,
  type DataShape,
} from './definitions';

// Factory
export {
  createChartComponentDef,
  createChartDomainCatalog,
  chartDomainCatalog,
  getChartRecommendations,
  generateChartSelectionPrompt,
  type ChartPanelType,
} from './factory';
