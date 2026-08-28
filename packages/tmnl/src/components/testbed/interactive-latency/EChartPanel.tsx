import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import type { ReactNode } from 'react';
import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal';

interface EChartPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly signal: ReactNode;
  readonly option: EChartsOption;
  readonly ariaLabel: string;
}

export function EChartPanel({
  title,
  subtitle,
  signal,
  option,
  ariaLabel,
}: EChartPanelProps) {
  return (
    <section
      className="min-w-0 overflow-hidden border"
      style={{
        borderColor: VANTA_COLORS.surface.border,
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008) 58%)',
        boxShadow: '0 24px 90px rgba(0,0,0,0.38)',
      }}
      aria-label={ariaLabel}
    >
      <header
        className="flex items-start justify-between gap-6 border-b px-5 py-4"
        style={{ borderColor: VANTA_COLORS.surface.border }}
      >
        <div>
          <h2
            style={{
              ...VANTA_TYPOGRAPHY.preset.cardTitle,
              color: VANTA_COLORS.text.primary,
              letterSpacing: '0.11em',
            }}
          >
            {title}
          </h2>
          <p
            className="mt-1"
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            {subtitle}
          </p>
        </div>
        <div className="shrink-0">{signal}</div>
      </header>
      <div className="px-2 pb-2 pt-3" role="img" aria-label={ariaLabel}>
        <ReactECharts
          option={option}
          notMerge
          lazyUpdate
          opts={{ renderer: 'svg' }}
          style={{ width: '100%', height: 430 }}
        />
      </div>
    </section>
  );
}
