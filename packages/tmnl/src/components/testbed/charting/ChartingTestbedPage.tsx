import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, BarChart3, LineChart, ScatterChart } from 'lucide-react';
import type { ChartSpec } from '@/lib/charting/v2';
import { VantaCard, VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';
import { SectionLabel } from '@/components/testbed/shared';
import {
  makeBarSeries,
  makeScatterSeries,
  makeSignalSeries,
} from './data/series-factories';
import { ChartRuntimeMount } from './runtime/ChartRuntimeMount';
import {
  LifecycleOpsCard,
  SignalGalleryCard,
  StreamingSciChartCard,
} from './cards';

export function ChartingTestbedPage() {
  const lineSpec = useMemo<ChartSpec>(
    () => ({
      id: 'chart-gallery-line',
      kind: 'LINE',
      renderer: 'ECHARTS',
      title: 'Signal Line',
      projection: 'TY',
      strokeWidth: 2,
    }),
    []
  );

  const barSpec = useMemo<ChartSpec>(
    () => ({
      id: 'chart-gallery-bar',
      kind: 'BAR',
      renderer: 'ECHARTS',
      title: 'Load Bars',
      projection: 'TY',
    }),
    []
  );

  const scatterSpec = useMemo<ChartSpec>(
    () => ({
      id: 'chart-gallery-scatter',
      kind: 'SCATTER',
      renderer: 'ECHARTS',
      title: 'Noise Scatter',
      projection: 'XY',
    }),
    []
  );

  const lineSeries = useMemo(
    () =>
      makeSignalSeries({
        pointCount: 160,
        frequency: 2.6,
        amplitude: 0.8,
        noise: 0.12,
      }),
    []
  );
  const barSeries = useMemo(() => makeBarSeries(), []);
  const scatterSeries = useMemo(() => makeScatterSeries(72), []);

  return (
    <div
      className="min-h-screen w-screen"
      style={{ backgroundColor: VANTA_COLORS.surface.void }}
    >
      <ChartRuntimeMount />

      <header
        className="border-b sticky top-0 z-10"
        style={{
          borderColor: VANTA_COLORS.surface.border,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              style={{ color: VANTA_COLORS.text.muted }}
              className="hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1
                style={{
                  ...VANTA_TYPOGRAPHY.preset.cardTitle,
                  color: VANTA_COLORS.text.primary,
                  fontSize: VANTA_TYPOGRAPHY.size.sm,
                }}
              >
                Charting Testbed
              </h1>
              <p
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.text.muted,
                  marginTop: '2px',
                }}
              >
                Charting v2 • runtime + atoms • ECharts + SciChart
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/testbed/data-grid"
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.muted,
              }}
              className="hover:text-white transition-colors"
            >
              GRID
            </Link>
            <Link
              to="/testbed/data-manager"
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.muted,
              }}
              className="hover:text-white transition-colors"
            >
              DATA
            </Link>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: VANTA_COLORS.accent.cyan }}
              />
              <span
                style={{
                  ...VANTA_TYPOGRAPHY.preset.label,
                  color: VANTA_COLORS.text.muted,
                }}
              >
                CHARTING v2
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        <section>
          <SectionLabel variant="gradient">Lifecycle + Ops</SectionLabel>
          <div className="grid grid-cols-1 gap-6">
            <LifecycleOpsCard />
          </div>
        </section>

        <section>
          <SectionLabel variant="gradient">Signal Gallery</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SignalGalleryCard
              spec={lineSpec}
              title="LINE SIGNAL"
              subtitle="Sine + noise (TY projection)"
              icon={<LineChart size={14} style={{ color: VANTA_COLORS.accent.cyan }} />}
              data={lineSeries}
            />
            <SignalGalleryCard
              spec={barSpec}
              title="BAR LOAD"
              subtitle="Static bar series"
              icon={<BarChart3 size={14} style={{ color: VANTA_COLORS.accent.amber }} />}
              data={barSeries}
            />
            <SignalGalleryCard
              spec={scatterSpec}
              title="SCATTER NOISE"
              subtitle="XY projection scatter"
              icon={
                <ScatterChart size={14} style={{ color: VANTA_COLORS.accent.rose }} />
              }
              data={scatterSeries}
            />
          </div>
        </section>

        <section>
          <SectionLabel variant="gradient">Streaming Stress</SectionLabel>
          <div className="grid grid-cols-1 gap-6">
            <StreamingSciChartCard />
          </div>
        </section>

        <section>
          <SectionLabel variant="gradient">API Reference</SectionLabel>
          <VantaCard variant="ghost">
            <VantaCard.Header>
              <VantaCard.Title>V2 QUICKSTART</VantaCard.Title>
            </VantaCard.Header>
            <pre
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.secondary,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {`// Create via chartOps
const create = useAtomSet(chartOps.create, { mode: 'promiseExit' })
await create({ id: 'chart-1', kind: 'LINE', renderer: 'ECHARTS' })

// Mount when container is ready
const mount = useAtomSet(chartOps.mount, { mode: 'promiseExit' })
await mount({ id: 'chart-1', container })

// Update data
const setData = useAtomSet(chartOps.setData, { mode: 'promiseExit' })
await setData({ id: 'chart-1', data })

// Dispose
const dispose = useAtomSet(chartOps.dispose, { mode: 'promiseExit' })
await dispose('chart-1')`}
            </pre>
          </VantaCard>
        </section>
      </main>
    </div>
  );
}

export default ChartingTestbedPage;
