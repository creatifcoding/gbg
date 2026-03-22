import type { ReactNode } from 'react';
import type { ChartSeries, ChartSpec } from '@/lib/charting/v2';
import { VantaCard } from '@/components/portal';
import { chartSurfaceStyle, resolveIndicator } from '../constants/styles';
import { useAutoChart } from '../hooks';
import { ErrorPanel } from '../components/ErrorPanel';

export type SignalGalleryCardProps = {
  spec: ChartSpec;
  title: string;
  subtitle: string;
  icon: ReactNode;
  data: ChartSeries;
};

export function SignalGalleryCard(props: SignalGalleryCardProps) {
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
        <VantaCard.Indicator status={indicator.status} label={indicator.label} />
      </VantaCard.Header>
      <VantaCard.Subtitle>{subtitle}</VantaCard.Subtitle>
      <div ref={actions.containerRef} style={chartSurfaceStyle} />
      <ErrorPanel error={actions.error} />
    </VantaCard>
  );
}
