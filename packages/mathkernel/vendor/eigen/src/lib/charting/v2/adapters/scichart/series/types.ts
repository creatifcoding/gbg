import type { ChartSpec } from '../../../schemas';

export type SciChartRenderableSeriesInput = {
  scichart: {
    FastLineRenderableSeries: new (
      wasmContext: unknown,
      options: Record<string, unknown>
    ) => unknown;
    FastMountainRenderableSeries: new (
      wasmContext: unknown,
      options: Record<string, unknown>
    ) => unknown;
    XyScatterRenderableSeries: new (
      wasmContext: unknown,
      options: Record<string, unknown>
    ) => unknown;
    EllipsePointMarker: new (
      wasmContext: unknown,
      options: Record<string, unknown>
    ) => unknown;
  };
  wasmContext: unknown;
  dataSeries: unknown;
  spec: ChartSpec;
  strokeWidth: number;
};
