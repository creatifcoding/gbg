'use client';

/**
 * ChartBlockView Component
 *
 * React component for rendering chart blocks in the TipTap editor.
 * Uses FoldablePanel for the wrapper and ChartRenderer for the content.
 *
 * @module editor/v3/extensions/blocks/ChartBlock/ChartBlockView
 */

import { type FC, useCallback, useMemo, useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useAtomValue } from '@effect-atom/atom-react';

import { FoldablePanel, FoldablePanelProvider, createFoldablePanelAtoms } from '@/lib/foldable-panel';
import type { SettingsTab } from '@/lib/foldable-panel/types';
import { ChartRenderer } from '@/lib/charts/components/ChartRenderer';
import { getChartDefinition, type ChartType } from '@/lib/charts';
import { getLockTierInfo } from '@/lib/charts/locks';

import {
  createChartBlockAtoms,
  disposeChartBlockAtoms,
  chartBlockRegistry,
} from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface ChartBlockViewProps extends NodeViewProps {
  // NodeViewProps provides: node, editor, getPos, updateAttributes, deleteNode, selected, extension
}

// =============================================================================
// Component
// =============================================================================

export const ChartBlockView: FC<ChartBlockViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
}) => {
  const blockId = node.attrs['id'] as string;
  const chartType = node.attrs['chartType'] as ChartType;
  const config = node.attrs['config'] as Record<string, unknown>;
  const data = node.attrs['data'] as unknown[];
  const lockTier = node.attrs['lockTier'] as string;

  // Get chart definition for metadata
  const chartDef = useMemo(() => getChartDefinition(chartType), [chartType]);
  const lockInfo = useMemo(() => getLockTierInfo(lockTier as any), [lockTier]);

  // Create atoms for this block
  const panelAtoms = useMemo(() => createFoldablePanelAtoms(blockId), [blockId]);
  const chartAtoms = useMemo(
    () =>
      createChartBlockAtoms(blockId, {
        chartType,
        config,
        data,
      }),
    [blockId, chartType, config, data]
  );

  // Subscribe to chart state
  const chartState = useAtomValue(chartAtoms.stateAtom);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposeChartBlockAtoms(blockId);
    };
  }, [blockId]);

  // Handle config changes from settings
  const handleConfigChange = useCallback(
    (newConfig: Record<string, unknown>) => {
      updateAttributes({ config: newConfig });
    },
    [updateAttributes]
  );

  // Handle chart type change
  const handleChartTypeChange = useCallback(
    (newType: ChartType) => {
      updateAttributes({ chartType: newType });
    },
    [updateAttributes]
  );

  // Handle delete
  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // Badge for the panel
  const badge = useMemo(
    () => ({
      tag: 'chart' as const,
      label: chartDef?.type ?? chartType,
    }),
    [chartDef, chartType]
  );

  // Settings tabs
  const tabs: SettingsTab[] = useMemo(
    () => [
      {
        id: 'chart-type',
        label: 'Type',
        content: (
          <ChartTypeSettings
            currentType={chartType}
            onTypeChange={handleChartTypeChange}
          />
        ),
      },
      {
        id: 'data',
        label: 'Data',
        content: (
          <DataSettings config={config} onConfigChange={handleConfigChange} />
        ),
      },
      {
        id: 'style',
        label: 'Style',
        content: (
          <StyleSettings config={config} onConfigChange={handleConfigChange} />
        ),
      },
      {
        id: 'lock',
        label: lockInfo.label,
        content: (
          <LockSettings
            blockId={blockId}
            lockTier={lockTier}
            updateAttributes={updateAttributes}
          />
        ),
      },
    ],
    [chartType, config, lockTier, lockInfo, blockId, handleChartTypeChange, handleConfigChange, updateAttributes]
  );

  // Merge config with data for renderer
  const chartConfig = useMemo(() => {
    return {
      ...config,
      data: data.length > 0 ? data : config['data'],
    };
  }, [config, data]);

  return (
    <NodeViewWrapper>
      <FoldablePanelProvider atoms={panelAtoms} badge={badge} tabs={tabs}>
        <FoldablePanel
          badge={badge}
          panelId={blockId}
          isSelected={selected}
          onDelete={handleDelete}
          tabs={tabs}
        >
          <div style={{ minHeight: 200, padding: 8 }}>
            {chartState.error ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--tmnl-text-error)',
                  fontSize: 'var(--tmnl-text-sm)',
                }}
              >
                Error: {chartState.error}
              </div>
            ) : (
              <ChartRenderer
                chartType={chartType}
                config={chartConfig}
                loading={chartState.loading}
              />
            )}
          </div>
        </FoldablePanel>
      </FoldablePanelProvider>
    </NodeViewWrapper>
  );
};

// =============================================================================
// Settings Components (simplified for now)
// =============================================================================

interface ChartTypeSettingsProps {
  currentType: ChartType;
  onTypeChange: (type: ChartType) => void;
}

const ChartTypeSettings: FC<ChartTypeSettingsProps> = ({ currentType, onTypeChange }) => {
  const categories = ['Line', 'Bar', 'Column', 'Area', 'Pie', 'Scatter', 'Radar', 'Gauge'] as const;

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          fontSize: 'var(--tmnl-text-sm)',
          fontWeight: 500,
          marginBottom: 8,
          color: 'var(--tmnl-text-primary)',
        }}
      >
        Chart Type
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {categories.map((type) => (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            style={{
              padding: '4px 8px',
              fontSize: 'var(--tmnl-text-xs)',
              border: '1px solid',
              borderColor:
                currentType === type
                  ? 'var(--tmnl-accent-primary)'
                  : 'var(--tmnl-border-subtle)',
              borderRadius: 4,
              backgroundColor:
                currentType === type
                  ? 'var(--tmnl-accent-primary)'
                  : 'transparent',
              color:
                currentType === type
                  ? 'white'
                  : 'var(--tmnl-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
};

interface DataSettingsProps {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

const DataSettings: FC<DataSettingsProps> = ({ config, onConfigChange }) => {
  return (
    <div style={{ padding: 12, fontSize: 'var(--tmnl-text-sm)' }}>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>Data Source</div>
      <div style={{ color: 'var(--tmnl-text-muted)' }}>
        Configure data fields and source here.
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>X Field</label>
        <input
          type="text"
          value={(config['xField'] as string) || ''}
          onChange={(e) => onConfigChange({ ...config, xField: e.target.value })}
          placeholder="e.g., date"
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 'var(--tmnl-text-sm)',
            border: '1px solid var(--tmnl-border-subtle)',
            borderRadius: 4,
            backgroundColor: 'var(--tmnl-bg-surface)',
            color: 'var(--tmnl-text-primary)',
          }}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>Y Field</label>
        <input
          type="text"
          value={(config['yField'] as string) || ''}
          onChange={(e) => onConfigChange({ ...config, yField: e.target.value })}
          placeholder="e.g., value"
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 'var(--tmnl-text-sm)',
            border: '1px solid var(--tmnl-border-subtle)',
            borderRadius: 4,
            backgroundColor: 'var(--tmnl-bg-surface)',
            color: 'var(--tmnl-text-primary)',
          }}
        />
      </div>
    </div>
  );
};

interface StyleSettingsProps {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

const StyleSettings: FC<StyleSettingsProps> = ({ config, onConfigChange }) => {
  return (
    <div style={{ padding: 12, fontSize: 'var(--tmnl-text-sm)' }}>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>Appearance</div>
      <div style={{ color: 'var(--tmnl-text-muted)' }}>
        Customize colors, fonts, and visual style.
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={(config['smooth'] as boolean) || false}
            onChange={(e) => onConfigChange({ ...config, smooth: e.target.checked })}
          />
          Smooth lines
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={config['animation'] !== false}
            onChange={(e) => onConfigChange({ ...config, animation: e.target.checked })}
          />
          Enable animation
        </label>
      </div>
    </div>
  );
};

interface LockSettingsProps {
  blockId: string;
  lockTier: string;
  updateAttributes: (attrs: Record<string, unknown>) => void;
}

const LockSettings: FC<LockSettingsProps> = ({ lockTier, updateAttributes }) => {
  const info = getLockTierInfo(lockTier as any);

  return (
    <div style={{ padding: 12, fontSize: 'var(--tmnl-text-sm)' }}>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>Lock Status</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 8,
          backgroundColor: 'var(--tmnl-bg-muted)',
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 20 }}>{info.icon}</span>
        <div>
          <div style={{ fontWeight: 500, color: info.color }}>{info.label}</div>
          <div style={{ color: 'var(--tmnl-text-muted)', fontSize: 'var(--tmnl-text-xs)' }}>
            {info.description}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={() => updateAttributes({ lockTier: 'unlocked' })}
          disabled={lockTier === 'unlocked'}
          style={{
            padding: '4px 8px',
            fontSize: 'var(--tmnl-text-xs)',
            border: '1px solid var(--tmnl-border-subtle)',
            borderRadius: 4,
            cursor: lockTier === 'unlocked' ? 'not-allowed' : 'pointer',
            opacity: lockTier === 'unlocked' ? 0.5 : 1,
          }}
        >
          Unlock
        </button>
        <button
          onClick={() => updateAttributes({ lockTier: 'user-locked' })}
          disabled={lockTier === 'user-locked'}
          style={{
            padding: '4px 8px',
            fontSize: 'var(--tmnl-text-xs)',
            border: '1px solid var(--tmnl-border-subtle)',
            borderRadius: 4,
            cursor: lockTier === 'user-locked' ? 'not-allowed' : 'pointer',
            opacity: lockTier === 'user-locked' ? 0.5 : 1,
          }}
        >
          Lock
        </button>
      </div>
    </div>
  );
};

export default ChartBlockView;
