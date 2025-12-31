/**
 * @fileoverview LinkSettingsPanel Component
 *
 * Configuration panel for dataplane links.
 * Allows editing relationship type, transform, and metadata.
 *
 * @module dataplane/components/LinkSettingsPanel
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import {
  ArrowRight,
  ArrowLeftRight,
  Sigma,
  Copy,
  Trash2,
  Code,
  Check,
} from 'lucide-react';

import { Icon } from './Icon';
import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
} from '@/components/portal/tokens';
import { linkAtom, portAtom, dataplaneOps } from '../atoms';
import type {
  LinkId,
  PortId,
  Link,
  LinkPort,
  LinkRelationship,
  LinkDirection,
} from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface LinkSettingsPanelProps {
  /** Link ID to configure */
  linkId: LinkId;
  /** Callback when link is deleted */
  onDelete?: () => void;
  /** Callback when panel should close */
  onClose?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

interface RelationshipOption {
  value: LinkRelationship;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const RELATIONSHIP_OPTIONS: readonly RelationshipOption[] = [
  {
    value: 'pipe',
    label: 'Pipe',
    icon: <Icon icon={ArrowRight} size={14} color="cyan" />,
    description: 'Unidirectional flow with optional transform',
  },
  {
    value: 'sync',
    label: 'Sync',
    icon: <Icon icon={ArrowLeftRight} size={14} color="cyan" />,
    description: 'Bidirectional sync (last-write-wins)',
  },
  {
    value: 'aggregate',
    label: 'Aggregate',
    icon: <Icon icon={Sigma} size={14} color="cyan" />,
    description: 'Many-to-one reduce operation',
  },
  {
    value: 'mirror',
    label: 'Mirror',
    icon: <Icon icon={Copy} size={14} color="cyan" />,
    description: 'Direct 1:1 copy without transform',
  },
];

// =============================================================================
// Sub-components
// =============================================================================

interface PortPreviewProps {
  portId: PortId;
  label: 'Source' | 'Target';
}

function PortPreview({ portId, label }: PortPreviewProps): React.ReactElement {
  const port = useAtomValue(useMemo(() => portAtom(portId), [portId]));

  if (!port) {
    return (
      <div className="text-gray-500 text-xs">Port not found</div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['1'],
        padding: VANTA_SPACING['2'],
        background: VANTA_COLORS.surface.elevated,
        borderRadius: VANTA_BORDERS.radius.sm,
      }}
    >
      <div
        style={{
          color: VANTA_COLORS.text.muted,
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background:
              port.direction === 'in'
                ? VANTA_COLORS.accent.cyan
                : port.direction === 'out'
                ? VANTA_COLORS.accent.amber
                : VANTA_COLORS.accent.violet,
          }}
        />
        <span
          style={{
            color: VANTA_COLORS.text.secondary,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontFamily: 'var(--tmnl-font-mono)',
          }}
        >
          {port.label ?? port.direction}
        </span>
        <span
          style={{
            color: VANTA_COLORS.text.muted,
            fontSize: '10px',
          }}
        >
          ({port.dataType})
        </span>
      </div>
      <div
        style={{
          color: VANTA_COLORS.text.muted,
          fontSize: '10px',
          fontFamily: 'var(--tmnl-font-mono)',
        }}
      >
        Block: {(port.blockId as string).slice(0, 12)}...
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Configuration panel for a dataplane link.
 *
 * Features:
 * - View source/target ports
 * - Change relationship type
 * - Edit transform expression
 * - Delete link
 */
export const LinkSettingsPanel = memo(function LinkSettingsPanel({
  linkId,
  onDelete,
  onClose,
}: LinkSettingsPanelProps): React.ReactElement | null {
  const link = useAtomValue(useMemo(() => linkAtom(linkId), [linkId]));

  // Local state for editing
  const [transform, setTransform] = useState(link?.transform ?? '');
  const [relationship, setRelationship] = useState<LinkRelationship>(
    link?.relationship ?? 'pipe'
  );
  const [isDirty, setIsDirty] = useState(false);

  // Operations
  const removeLink = useAtomSet(dataplaneOps.removeLink, { mode: 'promise' });

  // Handlers
  const handleRelationshipChange = useCallback((value: LinkRelationship) => {
    setRelationship(value);
    setIsDirty(true);
  }, []);

  const handleTransformChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTransform(e.target.value);
      setIsDirty(true);
    },
    []
  );

  const handleSave = useCallback(() => {
    // TODO: Implement link update operation
    console.log('[LinkSettingsPanel] Save:', { relationship, transform });
    setIsDirty(false);
  }, [relationship, transform]);

  const handleDelete = useCallback(async () => {
    try {
      await removeLink(linkId);
      onDelete?.();
      onClose?.();
    } catch (err) {
      console.error('[LinkSettingsPanel] Failed to delete link:', err);
    }
  }, [linkId, removeLink, onDelete, onClose]);

  if (!link) {
    return (
      <div
        style={{
          padding: VANTA_SPACING['4'],
          color: VANTA_COLORS.text.muted,
        }}
      >
        Link not found
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['4'],
        padding: VANTA_SPACING['4'],
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            color: VANTA_COLORS.text.primary,
            fontSize: 'var(--tmnl-text-sm, 14px)',
            fontWeight: 600,
          }}
        >
          Link Settings
        </div>
        <div
          style={{
            color: VANTA_COLORS.text.muted,
            fontSize: '10px',
            fontFamily: 'var(--tmnl-font-mono)',
          }}
        >
          {(link.id as string).slice(0, 8)}
        </div>
      </div>

      {/* Port previews */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: VANTA_SPACING['2'],
          alignItems: 'center',
        }}
      >
        <PortPreview portId={link.sourcePort} label="Source" />
        <Icon icon={ArrowRight} size={16} color="muted" />
        <PortPreview portId={link.targetPort} label="Target" />
      </div>

      {/* Relationship selector */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: VANTA_SPACING['2'],
        }}
      >
        <label
          style={{
            color: VANTA_COLORS.text.muted,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          Relationship Type
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: VANTA_SPACING['1'],
          }}
        >
          {RELATIONSHIP_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleRelationshipChange(option.value)}
              title={option.description}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: VANTA_SPACING['2'],
                padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
                background:
                  relationship === option.value
                    ? VANTA_COLORS.accent.cyanGlow
                    : 'transparent',
                border: `1px solid ${
                  relationship === option.value
                    ? VANTA_COLORS.accent.cyanMuted
                    : VANTA_COLORS.surface.border
                }`,
                color:
                  relationship === option.value
                    ? VANTA_COLORS.accent.cyan
                    : VANTA_COLORS.text.secondary,
                borderRadius: VANTA_BORDERS.radius.sm,
                cursor: 'pointer',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                fontFamily: 'var(--tmnl-font-mono)',
                transition: 'all 150ms ease-out',
              }}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transform editor */}
      {(relationship === 'pipe' || relationship === 'aggregate') && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: VANTA_SPACING['2'],
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['1'],
              color: VANTA_COLORS.text.muted,
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            <Icon icon={Code} size={12} color="muted" />
            Transform Expression
          </label>
          <textarea
            value={transform}
            onChange={handleTransformChange}
            placeholder="(row) => row.value > 10"
            rows={3}
            style={{
              width: '100%',
              padding: VANTA_SPACING['2'],
              background: VANTA_COLORS.surface.elevated,
              border: `1px solid ${VANTA_COLORS.surface.border}`,
              borderRadius: VANTA_BORDERS.radius.sm,
              color: VANTA_COLORS.text.primary,
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontFamily: 'var(--tmnl-font-mono)',
              resize: 'vertical',
            }}
          />
          <div
            style={{
              color: VANTA_COLORS.text.muted,
              fontSize: '10px',
            }}
          >
            JS arrow function or D2QL expression
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: VANTA_SPACING['2'],
          paddingTop: VANTA_SPACING['2'],
          borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
        }}
      >
        <button
          onClick={handleDelete}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['1'],
            padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
            background: 'transparent',
            border: `1px solid ${VANTA_COLORS.status.error}`,
            color: VANTA_COLORS.status.error,
            borderRadius: VANTA_BORDERS.radius.sm,
            cursor: 'pointer',
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          <Icon icon={Trash2} size={12} color="red" />
          Delete
        </button>

        {isDirty && (
          <button
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['1'],
              padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
              background: VANTA_COLORS.accent.cyanGlow,
              border: `1px solid ${VANTA_COLORS.accent.cyanMuted}`,
              color: VANTA_COLORS.accent.cyan,
              borderRadius: VANTA_BORDERS.radius.sm,
              cursor: 'pointer',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            <Icon icon={Check} size={12} color="green" />
            Save Changes
          </button>
        )}
      </div>

      {/* Metadata */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: VANTA_SPACING['1'],
          paddingTop: VANTA_SPACING['2'],
          borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
          color: VANTA_COLORS.text.muted,
          fontSize: '10px',
        }}
      >
        <div>Created: {link.createdAt.toLocaleString()}</div>
        <div>
          Direction:{' '}
          {link.direction === 'bidirectional' ? '⇄ Bidirectional' : '→ Unidirectional'}
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// Exports
// =============================================================================

export default LinkSettingsPanel;
