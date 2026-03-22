/**
 * DataTab Component
 *
 * Universal data configuration tab. Available for all chart types.
 * Provides controls for data source, field mapping, and transformations.
 *
 * @module charts/interactive-panel/tabs/DataTab
 */

import { Database, RefreshCw, FileJson, Table } from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { type TabProps, isDataTab } from './types';

/**
 * DataTab - Data configuration
 *
 * Provides controls for:
 * - Data source selection
 * - Field mapping
 * - Data transformations
 * - Refresh/reload
 */
export function DataTab(props: TabProps) {
  // Schema.is validation
  if (!isDataTab(props.tabId)) {
    return null;
  }
  const { chartId, chartType } = props;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['4'],
      }}
    >
      {/* Data Source */}
      <Section title="Data Source" icon={<Database size={14} />}>
        <div
          style={{
            padding: VANTA_SPACING['3'],
            background: VANTA_COLORS.surface.elevated,
            borderRadius: VANTA_BORDERS.radius.md,
            border: `1px solid ${VANTA_COLORS.surface.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              marginBottom: VANTA_SPACING['2'],
            }}
          >
            <FileJson size={14} style={{ color: VANTA_COLORS.accent.cyan }} />
            <span
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.primary,
              }}
            >
              Inline Data
            </span>
          </div>
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
            }}
          >
            Chart ID: {chartId}
            {chartType && <span> ({chartType})</span>}
          </div>
        </div>
      </Section>

      {/* Field Mapping (Placeholder) */}
      <Section title="Field Mapping" icon={<Table size={14} />}>
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
          Field mapping configuration coming soon.
          <br />
          Connect to dataplane ports for dynamic data.
        </div>
      </Section>

      {/* Refresh Button */}
      <button
        onClick={() => {
          // TODO: Implement data refresh
          console.log(`[DataTab] Refresh data for chart: ${chartId}`);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: VANTA_SPACING['2'],
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
          background: VANTA_COLORS.surface.hover,
          border: `1px solid ${VANTA_COLORS.surface.border}`,
          borderRadius: VANTA_BORDERS.radius.md,
          color: VANTA_COLORS.text.secondary,
          cursor: 'pointer',
          ...VANTA_TYPOGRAPHY.preset.label,
        }}
      >
        <RefreshCw size={14} />
        Refresh Data
      </button>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
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
      {children}
    </div>
  );
}

export default DataTab;
