/**
 * TMNL Charting Testbed (v2)
 *
 * Route: /testbed/charting
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { Cause, Effect, Exit } from 'effect';
import { useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import type { ChartSeries, ChartSpec, ChartState } from '@/lib/charting/v2';
import {
  chartingRuntimeAtom,
  chartInstanceFamily,
  chartInstancesAtom,
  chartOps,
  chartReleasesAtom,
  chartSpecsAtom,
  chartStateFamily,
  chartStateSubscriptionsAtom,
  chartStatesAtom,
} from '@/lib/charting/v2';
import { CHART_TOKENS } from '@/lib/charting/v1';
import { VantaCard, VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';
import { SectionLabel } from '@/components/testbed/shared';

type ExitPromise = Promise<Exit.Exit<unknown, unknown>>;

type ErrorState = {
  context: string;
  message: string;
};

const chartSurfaceStyle = {
  width: '100%',
  height: 280,
  background: CHART_TOKENS.colors.chartBackground,
  marginTop: 12,
  borderRadius: 8,
  border: `1px solid ${CHART_TOKENS.colors.chartBorder}`,
};

const resolveIndicator = (state: ChartState) => {
  switch (state) {
    case 'READY':
    case 'STREAMING':
      return { status: 'active' as const, label: state };
    case 'LOADING':
      return { status: 'pending' as const, label: state };
    case 'ERROR':
      return { status: 'error' as const, label: state };
    case 'DISPOSED':
      return { status: 'inactive' as const, label: state };
    case 'PAUSED':
      return { status: 'idle' as const, label: state };
    case 'UNINITIALIZED':
    default:
      return { status: 'idle' as const, label: state };
  }
};

function ChartRuntimeMount() {
  useAtomValue(chartingRuntimeAtom);
  useAtomValue(chartInstancesAtom);
  useAtomValue(chartSpecsAtom);
  useAtomValue(chartStatesAtom);
  useAtomValue(chartReleasesAtom);
  useAtomValue(chartStateSubscriptionsAtom);
  return null;
}

const makeSignalSeries = (params: {
  pointCount: number;
  frequency: number;
  amplitude: number;
  noise?: number;
  phase?: number;
}): ChartSeries => {
  const { pointCount, frequency, amplitude, noise = 0, phase = 0 } = params;
  return Array.from({ length: pointCount }, (_, i) => {
    const t = i;
    const theta = (i / pointCount) * Math.PI * 2 * frequency + phase;
    const jitter = noise ? (Math.random() - 0.5) * noise : 0;
    return { t, x: t, y: amplitude * Math.sin(theta) + jitter };
  });
};

const makeBarSeries = (): ChartSeries =>
  [120, 200, 150, 80, 190, 130].map((y, i) => ({
    t: i,
    x: i,
    y,
  }));

const makeScatterSeries = (count = 64): ChartSeries =>
  Array.from({ length: count }, (_, i) => ({
    t: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
  }));

const makeBurstSeries = (): ChartSeries =>
  Array.from({ length: 32 }, (_, i) => ({
    t: i,
    x: i,
    y: 0.6 + Math.sin(i * 0.35) * 0.5 + Math.random() * 0.25,
  }));

const useExitRunner = (scope: string) => {
  const [error, setError] = useState<ErrorState | null>(null);

  const run = useCallback(
    async (promise: ExitPromise, action?: string) => {
      const exit = await promise;
      if (Exit.isFailure(exit)) {
        const message = Cause.pretty(exit.cause);
        const context = action ? `${scope}:${action}` : scope;
        setError({ context, message });
        Effect.runFork(
          Effect.logError(`[ChartingTestbed] ${context}\n${message}`)
        );
        return null;
      }
      setError(null);
      return exit.value;
    },
    [scope]
  );

  return { error, run } as const;
};

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

const useChartActions = (spec: ChartSpec) => {
  const state = useAtomValue(chartStateFamily(spec.id));
  const createOp = useAtomSet(chartOps.create, { mode: 'promiseExit' });
  const mountOp = useAtomSet(chartOps.mount, { mode: 'promiseExit' });
  const unmountOp = useAtomSet(chartOps.unmount, { mode: 'promiseExit' });
  const disposeOp = useAtomSet(chartOps.dispose, { mode: 'promiseExit' });
  const setDataOp = useAtomSet(chartOps.setData, { mode: 'promiseExit' });
  const appendDataOp = useAtomSet(chartOps.appendData, { mode: 'promiseExit' });
  const clearDataOp = useAtomSet(chartOps.clearData, { mode: 'promiseExit' });
  const { error, run } = useExitRunner(spec.id);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const create = useCallback(
    () => run(createOp(spec), 'create'),
    [createOp, run, spec]
  );
  const mount = useCallback(
    (container: HTMLElement | null) =>
      container ? run(mountOp({ id: spec.id, container }), 'mount') : null,
    [mountOp, run, spec.id]
  );
  const unmount = useCallback(
    () => run(unmountOp(spec.id), 'unmount'),
    [run, unmountOp, spec.id]
  );
  const dispose = useCallback(
    () => run(disposeOp(spec.id), 'dispose'),
    [disposeOp, run, spec.id]
  );
  const setData = useCallback(
    (data: ChartSeries) => run(setDataOp({ id: spec.id, data }), 'setData'),
    [run, setDataOp, spec.id]
  );
  const appendData = useCallback(
    (data: ChartSeries) =>
      run(appendDataOp({ id: spec.id, data }), 'appendData'),
    [appendDataOp, run, spec.id]
  );
  const clearData = useCallback(
    () => run(clearDataOp(spec.id), 'clearData'),
    [clearDataOp, run, spec.id]
  );

  return {
    state,
    error,
    containerRef,
    create,
    mount,
    unmount,
    dispose,
    setData,
    appendData,
    clearData,
  } as const;
};

const useAutoChart = (spec: ChartSpec, initialData?: ChartSeries) => {
  const actions = useChartActions(spec);
  const { create, mount, dispose, containerRef, state, setData } = actions;

  useEffect(() => {
    let active = true;

    const start = async () => {
      await create();
      if (!active) return;
      await mount(containerRef.current);
    };

    void start();

    return () => {
      active = false;
      void dispose();
    };
  }, [containerRef, create, dispose, mount]);

  useEffect(() => {
    if (state === 'READY' && initialData) {
      void setData(initialData);
    }
  }, [initialData, setData, state]);

  return actions;
};

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
  const [fps, setFps] = useState(0);
  const [pointCount, setPointCount] = useState(512);
  const [targetFps, setTargetFps] = useState(45);

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
  const indicator = resolveIndicator(actions.state);
  const seriesRef = useRef<ChartSeries>([]);
  const tickRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (actions.state !== 'READY' || !isStreaming) return;

    let active = true;
    let lastFrame = performance.now();
    let frameCount = 0;
    let lastSecond = performance.now();

    const loop = (now: number) => {
      if (!active) return;
      const frameInterval = 1000 / targetFps;

      if (now - lastFrame >= frameInterval) {
        lastFrame = now;
        const t = tickRef.current;
        const y =
          Math.sin(t * 0.08) * 0.9 +
          Math.sin(t * 0.015) * 0.6 +
          (Math.random() - 0.5) * 0.12;
        const next = [...seriesRef.current, { t, x: t, y }];
        seriesRef.current =
          next.length > pointCount
            ? next.slice(next.length - pointCount)
            : next;
        tickRef.current += 1;

        void actions.setData(seriesRef.current);
        frameCount += 1;
      }

      if (now - lastSecond >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastSecond = now;
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      void actions.clearData();
    };
  }, [actions, isStreaming, pointCount, targetFps]);

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
        Adaptive stream loop with SciChart renderer
      </VantaCard.Subtitle>
      <div ref={actions.containerRef} style={chartSurfaceStyle} />
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
