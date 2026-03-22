/**
 * InteractiveChartPanel Hooks
 *
 * @module charts/interactive-panel/hooks
 */

// Re-export atom-based hooks
export {
  usePanelActions,
  usePanelState,
  useActiveTab,
  useShowControls,
  useContentVisible,
  useIsStreaming,
} from '../atoms';

// Re-export context-based hooks
export {
  usePanelContext,
  usePanelContextSafe,
  usePanelAtoms,
  usePanelActionsFromContext,
  useChartId,
  useChartCategory,
  useAvailableTabs,
} from '../context';

// Dataplane integration
export {
  useChartPorts,
  useChartHasConnections,
  useChartConnectionCount,
  usePortIsConnected,
  useChartInputPorts,
  useChartOutputPorts,
  type ChartPortsState,
  type UseChartPortsOptions,
} from './useChartPorts';
