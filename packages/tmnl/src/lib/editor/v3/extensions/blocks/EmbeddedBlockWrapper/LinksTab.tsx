/**
 * @fileoverview LinksTab Component
 *
 * Settings tab for managing dataplane links on an EmbeddedBlockWrapper.
 * Shows registered ports and connected links with delete capability.
 */

import { useMemo, useCallback } from 'react';
import { useAtomValue, Atom } from '@effect-atom/atom-react';
import { Link2, Unlink, ArrowRight, Trash2 } from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { cn } from '@/lib/utils';
import {
  linksForPortAtom,
  portsByIdAtom,
  selectedLinkAtom,
  dataplaneOps,
  type LinkPort,
  type Link,
  type PortId,
  type LinkId,
} from '@/lib/dataplane';

// =============================================================================
// Types
// =============================================================================

interface LinksTabProps {
  /** Registered ports for this block */
  ports: ReadonlyArray<LinkPort>;
  /** Block ID for reference */
  blockId: string;
}

// =============================================================================
// Sub-components
// =============================================================================

interface PortLinksListProps {
  port: LinkPort;
}

function PortLinksList({ port }: PortLinksListProps) {
  const links = useAtomValue(useMemo(() => linksForPortAtom(port.id), [port.id]));
  const portsById = useAtomValue(portsByIdAtom);
  const selectedLinkId = useAtomValue(selectedLinkAtom);

  const handleLinkClick = useCallback((linkId: LinkId) => {
    const current = Atom.get(selectedLinkAtom);
    Atom.set(selectedLinkAtom, current === linkId ? null : linkId);
  }, []);

  const handleDeleteLink = useCallback(async (linkId: LinkId) => {
    try {
      await dataplaneOps.removeLink(linkId);
      Atom.set(selectedLinkAtom, null);
      console.log(`[LinksTab] Deleted link ${linkId}`);
    } catch (err) {
      console.error('[LinksTab] Failed to delete link:', err);
    }
  }, []);

  if (links.length === 0) {
    return (
      <span
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.muted,
          fontStyle: 'italic',
        }}
      >
        No connections
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['1'] }}>
      {links.map((link) => {
        const isSource = link.sourcePort === port.id;
        const otherPortId = isSource ? link.targetPort : link.sourcePort;
        const otherPort = portsById.get(otherPortId);
        const isSelected = selectedLinkId === link.id;

        return (
          <div
            key={link.id}
            onClick={() => handleLinkClick(link.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
              borderRadius: VANTA_BORDERS.radius.sm,
              background: isSelected
                ? 'rgba(52, 211, 153, 0.15)'
                : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isSelected ? 'rgba(52, 211, 153, 0.4)' : 'transparent'
              }`,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <Link2
              size={12}
              style={{
                color: isSelected ? VANTA_COLORS.accent.emerald : VANTA_COLORS.text.muted,
                flexShrink: 0,
              }}
            />

            <span
              style={{
                ...VANTA_TYPOGRAPHY.preset.micro,
                color: VANTA_COLORS.text.secondary,
                flex: 1,
              }}
            >
              {isSource ? (
                <>
                  → {otherPort?.dataType ?? 'unknown'} ({link.relationship})
                </>
              ) : (
                <>
                  ← {otherPort?.dataType ?? 'unknown'} ({link.relationship})
                </>
              )}
            </span>

            {isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteLink(link.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: VANTA_BORDERS.radius.sm,
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="Delete link"
              >
                <Trash2 size={12} style={{ color: VANTA_COLORS.status.error }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface PortRowProps {
  port: LinkPort;
}

function PortRow({ port }: PortRowProps) {
  const directionColor =
    port.direction === 'in'
      ? VANTA_COLORS.accent.cyan
      : port.direction === 'out'
      ? VANTA_COLORS.accent.amber
      : VANTA_COLORS.accent.violet;

  return (
    <div
      style={{
        padding: VANTA_SPACING['3'],
        background: VANTA_COLORS.surface.sunken,
        borderRadius: VANTA_BORDERS.radius.md,
        border: `1px solid ${VANTA_COLORS.surface.border}`,
      }}
    >
      {/* Port header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
          marginBottom: VANTA_SPACING['2'],
        }}
      >
        {/* Direction indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: directionColor,
            boxShadow: `0 0 6px ${directionColor}`,
          }}
        />

        {/* Port info */}
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.primary,
            textTransform: 'uppercase',
          }}
        >
          {port.direction}
        </span>

        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
            marginLeft: 'auto',
          }}
        >
          {port.position} • {port.dataType}
        </span>
      </div>

      {/* Connected links */}
      <PortLinksList port={port} />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LinksTab({ ports, blockId }: LinksTabProps) {
  if (ports.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: VANTA_SPACING['6'],
          gap: VANTA_SPACING['2'],
        }}
      >
        <Unlink size={24} style={{ color: VANTA_COLORS.text.muted }} />
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.body,
            color: VANTA_COLORS.text.muted,
          }}
        >
          No ports configured
        </span>
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.tertiary,
          }}
        >
          Add dataplaneConfig.ports to enable linking
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['3'],
        padding: VANTA_SPACING['3'],
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        <Link2 size={14} style={{ color: VANTA_COLORS.accent.cyan }} />
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.secondary,
          }}
        >
          Dataplane Ports
        </span>
      </div>

      {/* Port list */}
      {ports.map((port) => (
        <PortRow key={port.id} port={port} />
      ))}

      {/* Instructions */}
      <div
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.muted,
          textAlign: 'center',
          marginTop: VANTA_SPACING['2'],
        }}
      >
        Click on port indicators to create links between blocks
      </div>
    </div>
  );
}

export default LinksTab;
