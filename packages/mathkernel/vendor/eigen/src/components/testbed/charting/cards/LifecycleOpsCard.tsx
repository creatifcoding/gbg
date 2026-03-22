import { useMemo } from 'react';
import { Cpu } from 'lucide-react';
import { useAtomValue } from '@effect-atom/atom-react';
import type { ChartSpec } from '@/lib/charting/v2';
import { chartInstanceFamily } from '@/lib/charting/v2';
import { VantaCard, VANTA_COLORS } from '@/components/portal';
import { chartSurfaceStyle, resolveIndicator } from '../constants/styles';
import { makeBurstSeries, makeSignalSeries } from '../data/series-factories';
import { useChartActions } from '../hooks';
import { ErrorPanel } from '../components/ErrorPanel';

export function LifecycleOpsCard() {
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
        <VantaCard.Indicator status={indicator.status} label={indicator.label} />
      </VantaCard.Header>
      <VantaCard.Subtitle>
        Create → Mount → Update → Unmount → Dispose (ECharts)
      </VantaCard.Subtitle>
      <div ref={actions.containerRef} style={chartSurfaceStyle} />
      <ErrorPanel error={actions.error} />
      <VantaCard.Divider />
      <VantaCard.Actions>
        <VantaCard.Action variant="primary" onClick={() => void actions.create()}>
          {hasInstance ? 'RECREATE' : 'CREATE'}
        </VantaCard.Action>
        <VantaCard.Action
          variant="ghost"
          onClick={() => void actions.mount(actions.containerRef.current)}
          disabled={!hasInstance}
        >
          MOUNT
        </VantaCard.Action>
        <VantaCard.Action variant="ghost" onClick={() => void actions.unmount()}>
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
