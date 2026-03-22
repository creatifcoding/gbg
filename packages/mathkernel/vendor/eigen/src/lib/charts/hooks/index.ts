/**
 * Chart Hooks Module
 *
 * React hooks for chart styling and state management.
 *
 * @module charts/hooks
 */

export {
  // Hooks
  useChartWithStyle,
  useSystemTheme,
  useDefaultChartTheme,
  // Registry
  chartStyleRegistry,
  // Provider
  ChartStyleRegistryProvider,
  // Types
  type UseChartWithStyleOptions,
  type UseChartWithStyleResult,
} from './useChartWithStyle';

export {
  // Streaming hook
  useStreamingStyle,
  // Types
  type UseStreamingStyleOptions,
  type UseStreamingStyleResult,
} from './useStreamingStyle';
