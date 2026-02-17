import { useMemo, useState } from 'react';
import { Gauge } from 'lucide-react';
import { useAtomValue } from '@effect-atom/atom-react';
import type { ChartSpec } from '@/lib/charting/v2';
import { chartInstanceFamily } from '@/lib/charting/v2';
import { VantaCard, VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';
import { chartSurfaceStyle, resolveIndicator } from '../constants/styles';
import { useAutoChart, useStreamingSciChart } from '../hooks';
import { ErrorPanel } from '../components/ErrorPanel';

export function StreamingSciChartCard() {
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
        <VantaCard.Action variant="ghost" onClick={() => void actions.clearData()}>
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
