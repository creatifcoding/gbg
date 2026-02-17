/**
 * TMNL Charting Testbed (v2)
 *
 * Route: /testbed/charting
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Cpu,
  Gauge,
  LineChart,
  ScatterChart,
} from 'lucide-react';
import { useAtomValue } from '@effect-atom/atom-react';
import type { ChartSeries, ChartSpec } from '@/lib/charting/v2';
import {
  chartingRuntimeAtom,
  chartInstanceFamily,
  chartInstancesAtom,
  chartReleasesAtom,
  chartSpecsAtom,
  chartStateSubscriptionsAtom,
  chartStatesAtom,
} from '@/lib/charting/v2';
import { VantaCard, VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';
import { SectionLabel } from '@/components/testbed/shared';
import { chartSurfaceStyle, resolveIndicator } from './charting/constants/styles';
import {
  makeBarSeries,
  makeBurstSeries,
  makeScatterSeries,
  makeSignalSeries,
} from './charting/data/series-factories';
import {
  useAutoChart,
  useChartActions,
  useStreamingSciChart,
  type ErrorState,
} from './charting/hooks';

function ChartRuntimeMount() {
  useAtomValue(chartingRuntimeAtom);
  useAtomValue(chartInstancesAtom);
  useAtomValue(chartSpecsAtom);
  useAtomValue(chartStatesAtom);
  useAtomValue(chartReleasesAtom);
  useAtomValue(chartStateSubscriptionsAtom);
  return null;
}

function ErrorPanel({ error }: { error: ErrorState | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!error) return;
    const payload = `${error.context}\n${error.message}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }, [error]);

  if (!error) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${VANTA_COLORS.accent.roseMuted}`,
        background: 'rgba(251, 113, 133, 0.08)',
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: VANTA_COLORS.accent.rose,
          }}
        >
          ERROR
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: copied
              ? VANTA_COLORS.accent.emerald
              : VANTA_COLORS.text.muted,
            border: `1px solid ${VANTA_COLORS.surface.border}`,
            background: 'transparent',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre
        style={{
          marginTop: 8,
          whiteSpace: 'pre-wrap',
          fontFamily: VANTA_TYPOGRAPHY.family.mono,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: VANTA_COLORS.text.secondary,
          userSelect: 'text',
        }}
      >
        {error.context}
        {'\n'}
        {error.message}
      </pre>
    </div>
  );
}

function LifecycleOpsCard() {
  const spec = useMemo<ChartSpec>(
    () => ({
      id: 'chart-life-cycle',
      kind: 'LINE',
      renderer: 'ECHARTS',
      title: 'Lifecycle Probe',
      projection: 'TY',
      strokeWidth: 2,
    }),
    []
  );

  const signal = useMemo(
    () =>
      makeSignalSeries({
        pointCount: 128,
        frequency: 2,
        amplitude: 0.9,
        noise: 0.1,
      }),
    []
  );
  const burst = useMemo(() => makeBurstSeries(), []);
  const actions = useChartActions(spec);
  const indicator = resolveIndicator(actions.state);
  const instance = useAtomValue(chartInstanceFamily(spec.id));
  const hasInstance = Boolean(instance);

  return (
    <VantaCard variant="elevated" corners glow glowColor="cyan">
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <Cpu size={14} style={{ color: VANTA_COLORS.accent.cyan }} />
          <VantaCard.Title>LIFECYCLE + OPS</VantaCard.Title>
        </div>
        <VantaCard.Indicator
          status={indicator.status}
          label={indicator.label}
        />
      </VantaCard.Header>
      <VantaCard.Subtitle>
        Create → Mount → Update → Unmount → Dispose (ECharts)
      </VantaCard.Subtitle>
      <div ref={actions.containerRef} style={chartSurfaceStyle} />
      <ErrorPanel error={actions.error} />
      <VantaCard.Divider />
      <VantaCard.Actions>
        <VantaCard.Action
          variant="primary"
          onClick={() => void actions.create()}
        >
          {hasInstance ? 'RECREATE' : 'CREATE'}
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.mount(actions.containerRef.current)}
          disabled={!hasInstance}
        >
          MOUNT
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.unmount()}
        >
          UNMOUNT
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.dispose()}
          disabled={!hasInstance}
        >
          DISPOSE
        </VantaCard.Action>
      </VantaCard.Actions>
      <VantaCard.Actions>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.setData(signal)}
          disabled={!hasInstance}
        >
          SET DATA
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.appendData(burst)}
          disabled={!hasInstance}
        >
          APPEND BURST
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.clearData()}
          disabled={!hasInstance}
        >
          CLEAR
        </VantaCard.Action>
      </VantaCard.Actions>
    </VantaCard>
  );
}

function SignalGalleryCard(props: {
  spec: ChartSpec;
  title: string;
  subtitle: string;
  icon: ReactNode;
  data: ChartSeries;
}) {
  const { spec, title, subtitle, icon, data } = props;
  const actions = useAutoChart(spec, data);
  const indicator = resolveIndicator(actions.state);

  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          {icon}
          <VantaCard.Title>{title}</VantaCard.Title>
        </div>
        <VantaCard.Indicator
          status={indicator.status}
          label={indicator.label}
        />
      </VantaCard.Header>
      <VantaCard.Subtitle>{subtitle}</VantaCard.Subtitle>
      <div ref={actions.containerRef} style={chartSurfaceStyle} />
      <ErrorPanel error={actions.error} />
    </VantaCard>
  );
}

function StreamingSciChartCard() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [pointCount, setPointCount] = useState(512);
  const [targetFps, setTargetFps] = useState(60);

  const spec = useMemo<ChartSpec>(
    () => ({
      id: 'chart-sci-stream',
      kind: 'LINE',
      renderer: 'SCICHART',
      title: 'SciChart Streaming',
      projection: 'TY',
      strokeWidth: 2,
    }),
    []
  );

  const actions = useAutoChart(spec);
  const { state, appendData, clearData } = actions;
  const indicator = resolveIndicator(state);
  const instance = useAtomValue(chartInstanceFamily(spec.id));

  const { fps, streamStats } = useStreamingSciChart({
    state,
    isStreaming,
    instance,
    pointCount,
    targetFps,
    appendData,
    clearData,
    scope: spec.id,
  });

  return (
    <VantaCard
      variant="elevated"
      corners
      glow
      glowColor={isStreaming ? 'emerald' : 'cyan'}
      className="col-span-2"
    >
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <Gauge size={14} style={{ color: VANTA_COLORS.accent.emerald }} />
          <VantaCard.Title>STREAMING STRESS (SCICHART)</VantaCard.Title>
        </div>
        <VantaCard.Indicator
          status={isStreaming ? 'active' : indicator.status}
          label={isStreaming ? `${fps} FPS` : indicator.label}
        />
      </VantaCard.Header>
      <VantaCard.Subtitle>
        Firehose stream via src/lib/streams → buffered apply to SciChart
      </VantaCard.Subtitle>
      <div ref={actions.containerRef} style={chartSurfaceStyle} />
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          color: VANTA_COLORS.text.muted,
          fontFamily: VANTA_TYPOGRAPHY.family.mono,
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        <span>MODE: {streamStats.mode.toUpperCase()}</span>
        <span>BATCHES: {streamStats.batches}</span>
        <span>PTS APPLIED: {streamStats.pointsApplied}</span>
        <span>LAST FLUSH: {streamStats.lastFlushMs.toFixed(2)}ms</span>
      </div>
      <ErrorPanel error={actions.error} />
      <VantaCard.Divider />
      <VantaCard.Actions>
        <VantaCard.Action
          variant={isStreaming ? 'ghost' : 'primary'}
          onClick={() => setIsStreaming((prev) => !prev)}
        >
          {isStreaming ? 'STOP STREAM' : 'START STREAM'}
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.clearData()}
        >
          CLEAR
        </VantaCard.Action>
      </VantaCard.Actions>
      <VantaCard.Actions>
        <label
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          POINTS
          <input
            type="number"
            min={128}
            max={2048}
            value={pointCount}
            onChange={(event) => setPointCount(Number(event.target.value))}
            style={{
              width: 96,
              padding: '6px 8px',
              borderRadius: 6,
              border: `1px solid ${VANTA_COLORS.surface.border}`,
              background: VANTA_COLORS.surface.raised,
              color: VANTA_COLORS.text.primary,
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          />
        </label>
        <label
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          TARGET FPS
          <input
            type="number"
            min={15}
            max={120}
            value={targetFps}
            onChange={(event) => setTargetFps(Number(event.target.value))}
            style={{
              width: 96,
              padding: '6px 8px',
              borderRadius: 6,
              border: `1px solid ${VANTA_COLORS.surface.border}`,
              background: VANTA_COLORS.surface.raised,
              color: VANTA_COLORS.text.primary,
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          />
        </label>
      </VantaCard.Actions>
    </VantaCard>
  );
}

export function ChartingTestbed() {
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
              icon={
                <LineChart
                  size={14}
                  style={{ color: VANTA_COLORS.accent.cyan }}
                />
              }
              data={lineSeries}
            />
            <SignalGalleryCard
              spec={barSpec}
              title="BAR LOAD"
              subtitle="Static bar series"
              icon={
                <BarChart3
                  size={14}
                  style={{ color: VANTA_COLORS.accent.amber }}
                />
              }
              data={barSeries}
            />
            <SignalGalleryCard
              spec={scatterSpec}
              title="SCATTER NOISE"
              subtitle="XY projection scatter"
              icon={
                <ScatterChart
                  size={14}
                  style={{ color: VANTA_COLORS.accent.rose }}
                />
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

export default ChartingTestbed;
