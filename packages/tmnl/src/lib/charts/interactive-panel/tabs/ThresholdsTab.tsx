/**
 * ThresholdsTab Component
 *
 * Threshold configuration tab for KPI charts.
 * Provides controls for target values, threshold bands, and status colors.
 *
 * @module charts/interactive-panel/tabs/ThresholdsTab
 */

import { AlertTriangle } from 'lucide-react';
import { VANTA_COLORS, VANTA_SPACING, VANTA_TYPOGRAPHY, VANTA_BORDERS } from '@/components/portal/tokens';
import { type TabProps, isThresholdsTab } from './types';

/**
 * ThresholdsTab - Threshold configuration for KPI charts
 */
export function ThresholdsTab(props: TabProps) {
  // Schema.is validation
  if (!isThresholdsTab(props.tabId)) {
    return null;
  }
  const { chartId } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['4'] }}>
      <PlaceholderSection
        title="Threshold Configuration"
        icon={<AlertTriangle size={14} />}
        chartId={chartId}
        description="Configure target values, warning/critical thresholds, and status colors."
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

export default ThresholdsTab;
