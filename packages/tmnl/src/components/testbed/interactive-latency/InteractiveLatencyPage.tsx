import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { Link } from '@tanstack/react-router';
import { Activity, ArrowLeft, Database, Gauge, ShieldAlert } from 'lucide-react';
import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';
import { EChartPanel } from './EChartPanel';
import {
  AGENTSTORE_CHECKPOINT,
  LATENCY_BUDGET_MS,
  OPTIMIZATION_RUN_ID,
  interactiveLatencyRuns,
  interactiveLatencySummary,
} from './baseline.snapshot';

const chartText = '#a6a6a6';
const chartRule = 'rgba(255,255,255,0.11)';
const budgetColor = '#63d9c6';
const tailColor = '#ff5b54';
const pressureColor = '#ffb454';

type TooltipDatum = {
  readonly data?: readonly unknown[];
  readonly marker?: string;
  readonly seriesName?: string;
};

const asTooltipRows = (value: unknown): readonly TooltipDatum[] =>
  Array.isArray(value) ? (value as readonly TooltipDatum[]) : [value as TooltipDatum];

function metric(value: string, label: string, tone: string) {
  return (
    <div
      className="min-w-0 border-l pl-4"
      style={{ borderColor: VANTA_COLORS.surface.border }}
    >
      <div
        className="truncate text-2xl font-semibold tabular-nums"
        style={{ color: tone, letterSpacing: '-0.035em' }}
      >
        {value}
      </div>
      <div
        className="mt-1 uppercase"
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.muted,
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function InteractiveLatencyPage() {
  const samples = useMemo(
    () =>
      interactiveLatencyRuns.flatMap((run) =>
        run.actionSamplesMs.map((latencyMs, index) => ({
          label: `R${run.run}.${index + 1}`,
          latencyMs,
          run: run.run,
          action: index + 1,
          p95Ms: run.p95Ms,
        }))
      ),
    []
  );

  const latencyOption = useMemo<EChartsOption>(() => {
    const source = [
      ['label', 'latencyMs', 'run', 'action', 'p95Ms'],
      ...samples.map((sample) => [
        sample.label,
        sample.latencyMs,
        sample.run,
        sample.action,
        sample.p95Ms,
      ]),
    ];

    return {
      animationDuration: 280,
      backgroundColor: 'transparent',
      aria: { enabled: true, decal: { show: true } },
      dataset: { source },
      grid: { left: 58, right: 24, top: 28, bottom: 78 },
      tooltip: {
        trigger: 'item',
        borderWidth: 1,
        borderColor: chartRule,
        backgroundColor: 'rgba(5,5,5,0.96)',
        textStyle: { color: '#f5f2ec', fontFamily: 'monospace', fontSize: 11 },
        formatter: (input: unknown) => {
          const datum = asTooltipRows(input)[0]?.data;
          if (!datum) return '';
          return [
            `<strong>RUN ${datum[2]} / ACTION ${datum[3]}</strong>`,
            `${Number(datum[1]).toFixed(3)} ms`,
            Number(datum[1]) > LATENCY_BUDGET_MS ? 'OVER 16.7 ms BUDGET' : 'WITHIN BUDGET',
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        axisLine: { lineStyle: { color: chartRule } },
        axisTick: { show: false },
        axisLabel: {
          color: chartText,
          fontFamily: 'monospace',
          fontSize: 9,
          interval: 4,
          rotate: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: 'ACTION / MS',
        nameTextStyle: { color: chartText, fontFamily: 'monospace', fontSize: 10 },
        min: 0,
        axisLabel: { color: chartText, fontFamily: 'monospace', fontSize: 10 },
        splitLine: { lineStyle: { color: chartRule, type: 'dashed' } },
      },
      visualMap: {
        show: false,
        dimension: 1,
        pieces: [
          { lte: LATENCY_BUDGET_MS, color: budgetColor },
          { gt: LATENCY_BUDGET_MS, color: tailColor },
        ],
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 18,
          bottom: 20,
          borderColor: chartRule,
          backgroundColor: 'rgba(255,255,255,0.025)',
          fillerColor: 'rgba(99,217,198,0.16)',
          handleStyle: { color: budgetColor, borderColor: budgetColor },
          textStyle: { color: chartText },
        },
      ],
      series: [
        {
          name: 'Idle action',
          type: 'scatter',
          encode: { x: 'label', y: 'latencyMs' },
          symbolSize: (value: unknown) => {
            const latency = Number((value as readonly unknown[])[1]);
            return latency > LATENCY_BUDGET_MS ? 13 : 8;
          },
          itemStyle: { borderColor: '#050505', borderWidth: 1 },
          emphasis: { scale: 1.7 },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(99,217,198,0.045)' },
            data: [[{ yAxis: 0 }, { yAxis: LATENCY_BUDGET_MS }]],
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            lineStyle: { color: budgetColor, width: 1, type: 'dashed' },
            label: {
              formatter: '16.7 MS FRAME',
              color: budgetColor,
              fontFamily: 'monospace',
              fontSize: 9,
            },
            data: [{ yAxis: LATENCY_BUDGET_MS }],
          },
        },
        {
          name: 'Per-run p95',
          type: 'line',
          encode: { x: 'label', y: 'p95Ms' },
          symbol: 'none',
          step: 'middle',
          lineStyle: { color: pressureColor, width: 1.5, opacity: 0.78 },
          tooltip: { show: false },
          z: 2,
        },
      ],
    };
  }, [samples]);

  const pressureOption = useMemo<EChartsOption>(() => {
    const source = [
      ['run', 'p95Ms', 'reclaimPages', 'memoryFullPsiPct', 'majorFaults', 'swapInPages'],
      ...interactiveLatencyRuns.map((run) => [
        `RUN ${run.run}`,
        run.p95Ms,
        run.directReclaimPages,
        run.memoryFullPsiPct,
        run.majorFaults,
        run.swapInPages,
      ]),
    ];

    return {
      animationDuration: 320,
      backgroundColor: 'transparent',
      aria: { enabled: true, decal: { show: true } },
      dataset: { source },
      grid: { left: 62, right: 66, top: 28, bottom: 54 },
      legend: {
        top: 0,
        left: 70,
        textStyle: { color: chartText, fontFamily: 'monospace', fontSize: 9 },
        itemWidth: 14,
        itemHeight: 7,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        borderWidth: 1,
        borderColor: chartRule,
        backgroundColor: 'rgba(5,5,5,0.96)',
        textStyle: { color: '#f5f2ec', fontFamily: 'monospace', fontSize: 11 },
        formatter: (input: unknown) => {
          const datum = asTooltipRows(input)[0]?.data;
          if (!datum) return '';
          return [
            `<strong>${datum[0]}</strong>`,
            `p95 ${Number(datum[1]).toFixed(3)} ms`,
            `direct reclaim ${Number(datum[2]).toLocaleString()} pages`,
            `memory-full PSI ${Number(datum[3]).toFixed(4)}%`,
            `major faults ${Number(datum[4]).toLocaleString()}`,
            `swap-in ${Number(datum[5]).toLocaleString()} pages`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        axisLine: { lineStyle: { color: chartRule } },
        axisTick: { show: false },
        axisLabel: { color: chartText, fontFamily: 'monospace', fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'P95 / MS',
          min: 0,
          nameTextStyle: { color: chartText, fontFamily: 'monospace', fontSize: 10 },
          axisLabel: { color: chartText, fontFamily: 'monospace', fontSize: 10 },
          splitLine: { lineStyle: { color: chartRule, type: 'dashed' } },
        },
        {
          type: 'log',
          name: 'RECLAIM / PAGES',
          min: 1,
          nameTextStyle: { color: chartText, fontFamily: 'monospace', fontSize: 10 },
          axisLabel: {
            color: chartText,
            fontFamily: 'monospace',
            fontSize: 9,
            formatter: (value: number) => value.toLocaleString(),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Direct reclaim',
          type: 'bar',
          yAxisIndex: 1,
          encode: { x: 'run', y: 'reclaimPages' },
          barMaxWidth: 42,
          itemStyle: {
            color: 'rgba(255,91,84,0.48)',
            borderColor: tailColor,
            borderWidth: 1,
          },
        },
        {
          name: 'p95 latency',
          type: 'line',
          yAxisIndex: 0,
          encode: { x: 'run', y: 'p95Ms' },
          symbol: 'circle',
          symbolSize: 9,
          lineStyle: { color: budgetColor, width: 2.5 },
          itemStyle: { color: budgetColor, borderColor: '#050505', borderWidth: 2 },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            lineStyle: { color: pressureColor, type: 'dashed' },
            label: {
              formatter: '16.7 MS',
              color: pressureColor,
              fontFamily: 'monospace',
              fontSize: 9,
            },
            data: [{ yAxis: LATENCY_BUDGET_MS }],
          },
        },
      ],
    };
  }, []);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: VANTA_COLORS.surface.void,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <header
        className="sticky top-0 z-10 border-b"
        style={{
          borderColor: VANTA_COLORS.surface.border,
          backgroundColor: 'rgba(5,5,5,0.91)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              style={{ color: VANTA_COLORS.text.muted }}
              className="transition-colors hover:text-white"
              aria-label="Back to testbed index"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: tailColor,
                  letterSpacing: '0.17em',
                }}
              >
                GETBYZENBOOK / PERFORMANCE INSTRUMENT
              </div>
              <h1
                className="mt-1 text-xl font-semibold"
                style={{ color: VANTA_COLORS.text.primary, letterSpacing: '-0.025em' }}
              >
                Idle / Wake Latency
              </h1>
            </div>
          </div>
          <div
            className="flex items-center gap-2 border px-3 py-2"
            style={{
              borderColor: 'rgba(255,91,84,0.42)',
              color: tailColor,
              ...VANTA_TYPOGRAPHY.preset.label,
            }}
          >
            <ShieldAlert size={14} />
            RECLAIM GATE FAILED
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-8 px-6 py-8">
        <section className="grid gap-7 border-b pb-8 lg:grid-cols-[1.2fr_1fr]" style={{ borderColor: VANTA_COLORS.surface.border }}>
          <div>
            <div className="flex items-center gap-2" style={{ color: budgetColor }}>
              <Activity size={15} />
              <span style={{ ...VANTA_TYPOGRAPHY.preset.label, letterSpacing: '0.12em' }}>
                FIVE-RUN BASELINE
              </span>
            </div>
            <p
              className="mt-4 max-w-3xl text-3xl font-medium leading-tight lg:text-4xl"
              style={{ color: VANTA_COLORS.text.primary, letterSpacing: '-0.045em' }}
            >
              Median interaction clears one frame. Reclaim noise still creates a 30.7 ms tail.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
            {metric(`${interactiveLatencySummary.p95Ms.toFixed(3)} ms`, 'median p95', budgetColor)}
            {metric(`${interactiveLatencySummary.maxMs.toFixed(3)} ms`, 'worst action', tailColor)}
            {metric(
              interactiveLatencySummary.directReclaimPages.toLocaleString(),
              'reclaim pages',
              pressureColor
            )}
            {metric(String(interactiveLatencySummary.userProcesses), 'processes', VANTA_COLORS.text.primary)}
            {metric(interactiveLatencySummary.userThreads.toLocaleString(), 'threads', VANTA_COLORS.text.primary)}
            {metric(`${interactiveLatencySummary.userSwapGiB.toFixed(2)} GiB`, 'user swap', VANTA_COLORS.text.primary)}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <EChartPanel
            title="TAIL / ACTION DISTRIBUTION"
            subtitle="50 idle→overview actions • per-run p95 step • 16.7 ms frame budget"
            signal={<Gauge size={17} style={{ color: budgetColor }} />}
            option={latencyOption}
            ariaLabel="Latency distribution across fifty idle interaction samples"
          />
          <EChartPanel
            title="PRESSURE / CORRELATION"
            subtitle="p95 latency against direct-reclaim pages across five repeated runs"
            signal={<Database size={17} style={{ color: pressureColor }} />}
            option={pressureOption}
            ariaLabel="Latency and direct reclaim correlation across baseline runs"
          />
        </section>

        <footer
          className="flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: VANTA_COLORS.surface.border }}
        >
          <span style={{ ...VANTA_TYPOGRAPHY.preset.micro, color: VANTA_COLORS.text.muted }}>
            RUN {OPTIMIZATION_RUN_ID}
          </span>
          <span style={{ ...VANTA_TYPOGRAPHY.preset.micro, color: VANTA_COLORS.text.muted }}>
            CENTRAL SOURCE {AGENTSTORE_CHECKPOINT}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default InteractiveLatencyPage;
