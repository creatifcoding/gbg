/**
 * RegressionTab Component
 *
 * Regression configuration tab for correlation charts.
 * Provides controls for trend lines, regression types, and confidence intervals.
 *
 * @module charts/interactive-panel/tabs/RegressionTab
 */

import { TrendingUp } from 'lucide-react';
import { VANTA_COLORS, VANTA_SPACING, VANTA_TYPOGRAPHY, VANTA_BORDERS } from '@/components/portal/tokens';
import { type TabProps, isRegressionTab } from './types';

/**
 * RegressionTab - Regression line configuration
 */
export function RegressionTab(props: TabProps) {
  // Schema.is validation
  if (!isRegressionTab(props.tabId)) {
    return null;
  }
  const { chartId } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['4'] }}>
      <PlaceholderSection
        title="Regression Configuration"
        icon={<TrendingUp size={14} />}
        chartId={chartId}
        description="Configure trend lines, regression type (linear, polynomial), and R² display."
      />
    </div>
  );
}

interface PlaceholderSectionProps {
  title: string;
  icon: React.ReactNode;
  chartId: string;
  description: string;
}

function PlaceholderSection({ title, icon, chartId, description }: PlaceholderSectionProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          marginBottom: VANTA_SPACING['2'],
          color: VANTA_COLORS.text.secondary,
          ...VANTA_TYPOGRAPHY.preset.label,
        }}
      >
        {icon}
        {title}
      </div>
      <div
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.muted,
          padding: VANTA_SPACING['3'],
          background: VANTA_COLORS.surface.default,
          borderRadius: VANTA_BORDERS.radius.md,
          border: `1px dashed ${VANTA_COLORS.surface.border}`,
          textAlign: 'center',
        }}
      >
        {description}
        <br />
        <span style={{ color: VANTA_COLORS.text.tertiary }}>Chart: {chartId}</span>
      </div>
    </div>
  );
}

export default RegressionTab;
