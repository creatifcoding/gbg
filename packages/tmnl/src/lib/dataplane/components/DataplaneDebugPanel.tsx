/**
 * @fileoverview DataplaneDebugPanel Component
 *
 * Debug panel for inspecting dataplane state:
 * - Ports, Links, Planes counts and details
 * - Graph version and initialization status
 * - Persistence status and controls
 *
 * @module dataplane/components/DataplaneDebugPanel
 */

import React, { useState, useCallback } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';

// =============================================================================
// Unicode Icons (replacing lucide-react)
// =============================================================================

const ICONS = {
  chevronDown: '▼',
  chevronRight: '▶',
  database: '⊟',
  link: '⛓',
  layers: '☰',
  box: '◻',
  refresh: '↻',
  save: '✓',
  trash: '✕',
  download: '↓',
} as const;

import {
  portsAtom,
  linksAtom,
  planesAtom,
  versionAtom,
  graphInitializedAtom,
  linkCountAtom,
  portCountAtom,
  planeCountAtom,
} from '../atoms';
import type { LinkPort, Link, Plane } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

export interface DataplaneDebugPanelProps {
  /** Whether the panel is expanded by default */
  defaultExpanded?: boolean;
  /** Callback when save is triggered */
  onSave?: () => Promise<void>;
  /** Callback when load is triggered */
  onLoad?: () => Promise<void>;
  /** Callback when clear is triggered */
  onClear?: () => Promise<void>;
  /** Additional CSS class name */
  className?: string;
}

interface SectionProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

// =============================================================================
// Section Component
// =============================================================================

function Section({
  title,
  count,
  icon,
  children,
  defaultExpanded = false,
}: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-surface-border last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-sunken/50 transition-colors"
      >
        <span className="text-text-muted" style={{ fontSize: 10 }}>
          {expanded ? ICONS.chevronDown : ICONS.chevronRight}
        </span>
        {icon}
        <span
          className="flex-1 text-left font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {title}
        </span>
        <span
          className="font-mono text-accent-cyan"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {count}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1 bg-surface-sunken/30">{children}</div>
      )}
    </div>
  );
}

// =============================================================================
// Detail Components
// =============================================================================

function PortDetail({ port }: { port: LinkPort }) {
  return (
    <div
      className="font-mono text-text-muted p-2 rounded bg-surface-base/50"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <div className="flex justify-between">
        <span className="text-text-primary">{port.id}</span>
        <span
          className={`px-1 rounded ${
            port.direction === 'in'
              ? 'bg-accent-green/20 text-accent-green'
              : port.direction === 'out'
                ? 'bg-accent-red/20 text-accent-red'
                : 'bg-accent-cyan/20 text-accent-cyan'
          }`}
        >
          {port.direction}
        </span>
      </div>
      <div className="mt-1 text-text-muted">
        block: {port.blockId} | type: {port.dataType} | pos: {port.position}
      </div>
    </div>
  );
}

function LinkDetail({ link }: { link: Link }) {
  return (
    <div
      className="font-mono text-text-muted p-2 rounded bg-surface-base/50"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <div className="flex justify-between">
        <span className="text-text-primary">{link.id}</span>
        <span
          className={`px-1 rounded ${
            link.direction === 'bidirectional'
              ? 'bg-accent-yellow/20 text-accent-yellow'
              : 'bg-accent-blue/20 text-accent-blue'
          }`}
        >
          {link.relationship}
        </span>
      </div>
      <div className="mt-1">
        <span className="text-accent-cyan">{link.sourcePort}</span>
        <span className="mx-2">
          {link.direction === 'bidirectional' ? '⇄' : '→'}
        </span>
        <span className="text-accent-cyan">{link.targetPort}</span>
      </div>
      {link.transform && (
        <div className="mt-1 text-accent-yellow truncate">
          transform: {link.transform}
        </div>
      )}
    </div>
  );
}

function PlaneDetail({ plane }: { plane: Plane }) {
  return (
    <div
      className="font-mono text-text-muted p-2 rounded bg-surface-base/50"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <div className="flex justify-between">
        <span className="text-text-primary">{plane.name}</span>
        <span className="text-accent-cyan">{plane.portIds.length} ports</span>
      </div>
      <div className="mt-1 text-text-muted">id: {plane.id}</div>
      {plane.parentPlaneId && (
        <div className="text-text-muted">parent: {plane.parentPlaneId}</div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DataplaneDebugPanel({
  defaultExpanded = false,
  onSave,
  onLoad,
  onClear,
  className = '',
}: DataplaneDebugPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);

  // Atom subscriptions
  const ports = useAtomValue(portsAtom);
  const links = useAtomValue(linksAtom);
  const planes = useAtomValue(planesAtom);
  const version = useAtomValue(versionAtom);
  const graphInitialized = useAtomValue(graphInitializedAtom);
  const portCount = useAtomValue(portCountAtom);
  const linkCount = useAtomValue(linkCountAtom);
  const planeCount = useAtomValue(planeCountAtom);

  const handleAction = useCallback(
    async (action: (() => Promise<void>) | undefined, label: string) => {
      if (!action) return;
      setLoading(true);
      try {
        await action();
      } catch (err) {
        console.error(`DataplaneDebugPanel: ${label} failed`, err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div
      className={`rounded-lg border border-surface-border bg-surface-base overflow-hidden ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border bg-surface-sunken">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 hover:text-text-primary transition-colors"
        >
          <span className="text-text-muted" style={{ fontSize: 10 }}>
            {expanded ? ICONS.chevronDown : ICONS.chevronRight}
          </span>
          <span className="text-accent-cyan" style={{ fontSize: 14 }}>{ICONS.database}</span>
          <span className="font-mono font-medium">Dataplane Debug</span>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {onSave && (
            <button
              onClick={() => handleAction(onSave, 'save')}
              disabled={loading}
              className="p-1 hover:bg-surface-border rounded transition-colors disabled:opacity-50"
              title="Save to SQLite"
            >
              <span className="text-accent-green" style={{ fontSize: 14 }}>{ICONS.save}</span>
            </button>
          )}
          {onLoad && (
            <button
              onClick={() => handleAction(onLoad, 'load')}
              disabled={loading}
              className="p-1 hover:bg-surface-border rounded transition-colors disabled:opacity-50"
              title="Load from SQLite"
            >
              <span className="text-accent-cyan" style={{ fontSize: 14 }}>{ICONS.download}</span>
            </button>
          )}
          {onClear && (
            <button
              onClick={() => handleAction(onClear, 'clear')}
              disabled={loading}
              className="p-1 hover:bg-surface-border rounded transition-colors disabled:opacity-50"
              title="Clear all"
            >
              <span className="text-accent-red" style={{ fontSize: 14 }}>{ICONS.trash}</span>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-4 px-3 py-2 bg-surface-sunken/50 border-b border-surface-border font-mono">
            <div className="flex items-center gap-1">
              <span className="text-text-muted">Version:</span>
              <span className="text-accent-cyan">{version}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-muted">Graph:</span>
              <span
                className={graphInitialized ? 'text-accent-green' : 'text-accent-red'}
              >
                {graphInitialized ? 'initialized' : 'not initialized'}
              </span>
            </div>
            {loading && (
              <span className="animate-spin text-accent-cyan" style={{ fontSize: 12 }}>{ICONS.refresh}</span>
            )}
          </div>

          {/* Sections */}
          <Section
            title="Ports"
            count={portCount}
            icon={<span className="text-accent-blue" style={{ fontSize: 14 }}>{ICONS.box}</span>}
            defaultExpanded={portCount < 5}
          >
            {ports.length === 0 ? (
              <div className="text-text-muted italic">No ports registered</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {ports.map((port) => (
                  <PortDetail key={port.id} port={port} />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Links"
            count={linkCount}
            icon={<span className="text-accent-cyan" style={{ fontSize: 14 }}>{ICONS.link}</span>}
            defaultExpanded={linkCount < 5}
          >
            {links.length === 0 ? (
              <div className="text-text-muted italic">No links created</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {links.map((link) => (
                  <LinkDetail key={link.id} link={link} />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Planes"
            count={planeCount}
            icon={<span className="text-accent-yellow" style={{ fontSize: 14 }}>{ICONS.layers}</span>}
            defaultExpanded={planeCount < 5}
          >
            {planes.length === 0 ? (
              <div className="text-text-muted italic">No planes defined</div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {planes.map((plane) => (
                  <PlaneDetail key={plane.id} plane={plane} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

export default DataplaneDebugPanel;
