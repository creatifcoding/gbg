'use client';

/**
 * ChartRenderer Component
 *
 * Dynamic chart renderer that selects the appropriate Ant Design chart
 * based on the chartType prop. Handles both inline data and dataPath references.
 *
 * @module charts/components/ChartRenderer
 */

import { type FC, Suspense, lazy, useMemo, useState, useEffect } from 'react';
import type { ChartType } from '../schemas/base';

// =============================================================================
// Types
// =============================================================================

export interface ChartRendererProps {
  /** Chart type to render */
  chartType: ChartType;
  /** Chart configuration (props for the specific chart type) */
  config: Record<string, unknown>;
  /** Whether data is loading */
  loading?: boolean;
  /** Override data (takes precedence over config.data) */
  data?: unknown[];
  /** Whether data is being streamed (enables debounced updates) */
  isStreaming?: boolean;
  /** CSS class for container */
  className?: string;
}

// =============================================================================
// Lazy-loaded Chart Components
// =============================================================================

/**
 * Lazy-load chart components to reduce initial bundle size.
 * Each chart is loaded only when first rendered.
 */
const ChartComponents = {
  // Statistical Charts
  Line: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Line }))),
  Bar: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Bar }))),
  Column: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Column }))),
  Area: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Area }))),
  Pie: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Pie }))),
  Scatter: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Scatter }))),
  Radar: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Radar }))),
  Rose: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Rose }))),
  Funnel: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Funnel }))),
  Gauge: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Gauge }))),
  Liquid: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Liquid }))),
  Heatmap: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Heatmap }))),
  DualAxes: lazy(() => import('@ant-design/charts').then(m => ({ default: m.DualAxes }))),
  Waterfall: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Waterfall }))),
  Treemap: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Treemap }))),
  Sankey: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Sankey }))),
  WordCloud: lazy(() => import('@ant-design/charts').then(m => ({ default: m.WordCloud }))),
  Box: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Box }))),
  Bullet: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Bullet }))),
  Histogram: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Histogram }))),
  RadialBar: lazy(() => import('@ant-design/charts').then(m => ({ default: m.RadialBar }))),
  Stock: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Stock }))),
  Sunburst: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Sunburst }))),
  Violin: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Violin }))),
  BidirectionalBar: lazy(() => import('@ant-design/charts').then(m => ({ default: m.BidirectionalBar }))),
  CirclePacking: lazy(() => import('@ant-design/charts').then(m => ({ default: m.CirclePacking }))),
  Venn: lazy(() => import('@ant-design/charts').then(m => ({ default: m.Venn }))),

  // Note: Tiny charts (TinyLine, TinyArea, etc.) were removed in @ant-design/charts v2
  // Use regular charts with compact sizing for similar effects

  // Relational Charts (from @ant-design/graphs)
  FlowGraph: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.FlowGraph }))),
  NetworkGraph: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.NetworkGraph }))),
  OrganizationChart: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.OrganizationChart }))),
  MindMap: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.MindMap }))),
  IndentedTree: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.IndentedTree }))),
  Dendrogram: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.Dendrogram }))),
  Fishbone: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.Fishbone }))),
  FlowDirectionGraph: lazy(() => import('@ant-design/graphs').then(m => ({ default: m.FlowDirectionGraph }))),
} as const;

// =============================================================================
// Loading Fallback
// =============================================================================

const ChartLoadingFallback: FC<{ className?: string }> = ({ className }) => (
  <div
    className={className}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      backgroundColor: 'var(--tmnl-bg-muted, #f5f5f5)',
      borderRadius: 'var(--tmnl-radius-md, 8px)',
      color: 'var(--tmnl-text-muted, #888)',
      fontSize: 'var(--tmnl-text-sm, 14px)',
    }}
  >
    Loading chart...
  </div>
);

// =============================================================================
// Error Fallback
// =============================================================================

const ChartErrorFallback: FC<{ chartType: string; className?: string }> = ({ chartType, className }) => (
  <div
    className={className}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      backgroundColor: 'var(--tmnl-bg-error, #fff0f0)',
      borderRadius: 'var(--tmnl-radius-md, 8px)',
      color: 'var(--tmnl-text-error, #dc2626)',
      fontSize: 'var(--tmnl-text-sm, 14px)',
      gap: 8,
      padding: 16,
    }}
  >
    <span style={{ fontWeight: 500 }}>Chart type not supported: {chartType}</span>
    <span style={{ opacity: 0.7 }}>Install @ant-design/charts and @ant-design/graphs</span>
  </div>
);

// =============================================================================
// ChartRenderer Component
// =============================================================================

/**
 * Dynamic chart renderer
 *
 * Renders the appropriate Ant Design chart based on chartType.
 * Supports all 40 chart types with lazy loading for performance.
 *
 * @example
 * ```tsx
 * <ChartRenderer
 *   chartType="Line"
 *   config={{
 *     data: [{ x: 1, y: 10 }, { x: 2, y: 20 }],
 *     xField: 'x',
 *     yField: 'y',
 *   }}
 * />
 * ```
 */
export const ChartRenderer: FC<ChartRendererProps> = ({
  chartType,
  config,
  loading,
  data,
  isStreaming,
  className,
}) => {
  // Resolve chart component
  const ChartComponent = ChartComponents[chartType as keyof typeof ChartComponents];

  // Handle streaming data with debounced updates
  // This prevents excessive re-renders during rapid data updates
  const effectiveData = data ?? (config['data'] as unknown[] | undefined);
  const [displayData, setDisplayData] = useState<unknown[] | undefined>(effectiveData);

  useEffect(() => {
    if (isStreaming) {
      // Debounce updates at ~60fps for smooth rendering during streaming
      const timer = setTimeout(() => setDisplayData(effectiveData), 16);
      return () => clearTimeout(timer);
    }
    // Immediate update when not streaming
    setDisplayData(effectiveData);
    return undefined;
  }, [effectiveData, isStreaming]);

  // Merge props with data override
  const chartProps = useMemo(() => {
    const props: Record<string, unknown> = { ...config };

    // Use display data (debounced during streaming)
    if (displayData !== undefined) {
      props['data'] = displayData;
    }

    // Default autoFit if not specified
    if (props['autoFit'] === undefined) {
      props['autoFit'] = true;
    }

    // Remove chartType from props (not needed by Ant Design)
    delete props['chartType'];

    // Add smooth appear animation for streaming data
    if (isStreaming && !props['animation']) {
      props['animation'] = { appear: { animation: 'fade-in', duration: 300 } };
    }

    return props;
  }, [config, displayData, isStreaming]);

  // Handle missing chart component
  if (!ChartComponent) {
    return <ChartErrorFallback chartType={chartType} className={className} />;
  }

  // Render with Suspense for lazy loading
  // Type assertion needed due to complex union type from lazy-loaded components
  const Chart = ChartComponent as FC<Record<string, unknown>>;

  // Determine loading state: show loading if explicitly loading, or streaming with no data
  const isLoading = loading || (isStreaming && (!displayData || displayData.length === 0));

  return (
    <div className={className} style={{ opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <Suspense fallback={<ChartLoadingFallback className={className} />}>
        <Chart {...chartProps} />
      </Suspense>
    </div>
  );
};

export default ChartRenderer;
