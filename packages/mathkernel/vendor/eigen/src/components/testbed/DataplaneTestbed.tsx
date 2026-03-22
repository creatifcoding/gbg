/**
 * DataplaneTestbed
 *
 * Interactive testbed for the dataplane linking system:
 * - Port registration/unregistration
 * - Link creation between ports
 * - Plane (data bus) management
 * - Persistence (save/load/clear)
 * - React Flow visualization
 *
 * @route /testbed/dataplane
 */

import { useState, useCallback, useEffect } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { Effect, Layer } from 'effect';
import { SqliteBun } from '@effect/sql-sqlite-bun';
import {
  Box,
  Link2,
  Layers,
  Plus,
  Trash2,
  Save,
  Download,
  RefreshCw,
  Play,
  Unlink,
  Database,
} from 'lucide-react';
import { nanoid } from 'nanoid';

import {
  CollapsiblePanel,
  DemoSection,
  TestbedHeader,
  VersionBadge,
  Button,
} from './shared';

import {
  // Atoms
  dataplaneOps,
  portsAtom,
  linksAtom,
  planesAtom,
  versionAtom,
  graphInitializedAtom,
  linkCountAtom,
  portCountAtom,
  planeCountAtom,
  // Schemas
  type PortId,
  type LinkId,
  type PlaneId,
  type BlockId,
  type CreatePortConfig,
  type CreateLinkConfig,
  // Components
  DataplaneVisualizer,
  DataplaneDebugPanel,
  // Persistence
  DataplanePersistenceService,
  DataplanePersistenceLive,
} from '@/lib/dataplane';

// =============================================================================
// Constants
// =============================================================================

const MOCK_BLOCKS: Array<{ id: BlockId; name: string }> = [
  { id: 'block-data-source' as BlockId, name: 'Data Source' },
  { id: 'block-transformer' as BlockId, name: 'Transformer' },
  { id: 'block-grid-view' as BlockId, name: 'Grid View' },
  { id: 'block-chart' as BlockId, name: 'Chart' },
];

const PORT_DIRECTIONS = ['in', 'out', 'inout'] as const;
const PORT_POSITIONS = ['left', 'right', 'top', 'bottom'] as const;
const PORT_DATA_TYPES = ['table', 'row', 'cell', 'json', 'stream'] as const;
const LINK_DIRECTIONS = ['unidirectional', 'bidirectional'] as const;
const LINK_RELATIONSHIPS = ['pipe', 'sync', 'aggregate', 'mirror'] as const;

// =============================================================================
// Port Creator Panel
// =============================================================================

interface PortCreatorProps {
  onCreatePort: (config: CreatePortConfig) => Promise<void>;
}

function PortCreator({ onCreatePort }: PortCreatorProps) {
  const [blockId, setBlockId] = useState<BlockId>(MOCK_BLOCKS[0].id);
  const [direction, setDirection] = useState<(typeof PORT_DIRECTIONS)[number]>('out');
  const [position, setPosition] = useState<(typeof PORT_POSITIONS)[number]>('right');
  const [dataType, setDataType] = useState<(typeof PORT_DATA_TYPES)[number]>('table');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreatePort({
        blockId,
        direction,
        position,
        dataType,
        label: label || undefined,
      });
      setLabel('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-600/30">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
        <Box size={14} />
        Create Port
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Block
          </label>
          <select
            value={blockId}
            onChange={(e) => setBlockId(e.target.value as BlockId)}
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            {MOCK_BLOCKS.map((block) => (
              <option key={block.id} value={block.id}>
                {block.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Direction
          </label>
          <select
            value={direction}
            onChange={(e) =>
              setDirection(e.target.value as (typeof PORT_DIRECTIONS)[number])
            }
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            {PORT_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Position
          </label>
          <select
            value={position}
            onChange={(e) =>
              setPosition(e.target.value as (typeof PORT_POSITIONS)[number])
            }
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            {PORT_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Data Type
          </label>
          <select
            value={dataType}
            onChange={(e) =>
              setDataType(e.target.value as (typeof PORT_DATA_TYPES)[number])
            }
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            {PORT_DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          className="text-xs text-neutral-500 mb-1 block"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Label (optional)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Port label..."
          className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded text-cyan-300 text-sm transition-colors disabled:opacity-50"
      >
        {creating ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Plus size={14} />
        )}
        Create Port
      </button>
    </div>
  );
}

// =============================================================================
// Link Creator Panel
// =============================================================================

interface LinkCreatorProps {
  onCreateLink: (config: CreateLinkConfig) => Promise<void>;
}

function LinkCreator({ onCreateLink }: LinkCreatorProps) {
  const ports = useAtomValue(portsAtom);
  const [sourcePort, setSourcePort] = useState<PortId | ''>('');
  const [targetPort, setTargetPort] = useState<PortId | ''>('');
  const [direction, setDirection] = useState<(typeof LINK_DIRECTIONS)[number]>('unidirectional');
  const [relationship, setRelationship] = useState<(typeof LINK_RELATIONSHIPS)[number]>('pipe');
  const [transform, setTransform] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-select first ports when available
  useEffect(() => {
    if (ports.length > 0 && !sourcePort) {
      setSourcePort(ports[0].id);
    }
    if (ports.length > 1 && !targetPort) {
      setTargetPort(ports[1].id);
    }
  }, [ports, sourcePort, targetPort]);

  const handleCreate = async () => {
    if (!sourcePort || !targetPort) return;

    setCreating(true);
    try {
      await onCreateLink({
        sourcePort: sourcePort as PortId,
        targetPort: targetPort as PortId,
        direction,
        relationship,
        transform: transform || undefined,
      });
      setTransform('');
    } finally {
      setCreating(false);
    }
  };

  const canCreate = sourcePort && targetPort && sourcePort !== targetPort;

  return (
    <div className="space-y-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-600/30">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
        <Link2 size={14} />
        Create Link
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Source Port
          </label>
          <select
            value={sourcePort}
            onChange={(e) => setSourcePort(e.target.value as PortId)}
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            <option value="">Select port...</option>
            {ports.map((port) => (
              <option key={port.id} value={port.id}>
                {port.label || port.id} ({port.direction})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Target Port
          </label>
          <select
            value={targetPort}
            onChange={(e) => setTargetPort(e.target.value as PortId)}
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            <option value="">Select port...</option>
            {ports.map((port) => (
              <option key={port.id} value={port.id}>
                {port.label || port.id} ({port.direction})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Direction
          </label>
          <select
            value={direction}
            onChange={(e) =>
              setDirection(e.target.value as (typeof LINK_DIRECTIONS)[number])
            }
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            {LINK_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs text-neutral-500 mb-1 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Relationship
          </label>
          <select
            value={relationship}
            onChange={(e) =>
              setRelationship(e.target.value as (typeof LINK_RELATIONSHIPS)[number])
            }
            className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm"
          >
            {LINK_RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          className="text-xs text-neutral-500 mb-1 block"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Transform (optional D2QL/JS expression)
        </label>
        <input
          type="text"
          value={transform}
          onChange={(e) => setTransform(e.target.value)}
          placeholder="e.g., map(x => x.value * 2)"
          className="w-full bg-neutral-900 border border-neutral-600/50 rounded px-2 py-1 text-sm font-mono"
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={creating || !canCreate}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded text-cyan-300 text-sm transition-colors disabled:opacity-50"
      >
        {creating ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Link2 size={14} />
        )}
        Create Link
      </button>
    </div>
  );
}

// =============================================================================
// Persistence Panel
// =============================================================================

interface PersistencePanelProps {
  onSave: () => Promise<void>;
  onLoad: () => Promise<void>;
  onClear: () => Promise<void>;
}

function PersistencePanel({ onSave, onLoad, onClear }: PersistencePanelProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<void>, label: string) => {
    setLoading(true);
    setStatus(null);
    try {
      await action();
      setStatus(`${label} successful`);
    } catch (err) {
      setStatus(`${label} failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-600/30">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
        <Database size={14} />
        Persistence
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleAction(onSave, 'Save')}
          disabled={loading}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded text-green-300 text-sm transition-colors disabled:opacity-50"
        >
          <Save size={12} />
          Save
        </button>

        <button
          onClick={() => handleAction(onLoad, 'Load')}
          disabled={loading}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded text-cyan-300 text-sm transition-colors disabled:opacity-50"
        >
          <Download size={12} />
          Load
        </button>

        <button
          onClick={() => handleAction(onClear, 'Clear')}
          disabled={loading}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded text-red-300 text-sm transition-colors disabled:opacity-50"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {status && (
        <div
          className={`text-xs p-2 rounded ${
            status.includes('failed')
              ? 'bg-red-900/30 text-red-300'
              : 'bg-green-900/30 text-green-300'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {status}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Entity List Panel
// =============================================================================

interface EntityListProps {
  onDeletePort: (id: PortId) => Promise<void>;
  onDeleteLink: (id: LinkId) => Promise<void>;
}

function EntityList({ onDeletePort, onDeleteLink }: EntityListProps) {
  const ports = useAtomValue(portsAtom);
  const links = useAtomValue(linksAtom);

  return (
    <div className="space-y-4">
      {/* Ports */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          <Box size={14} className="text-blue-400" />
          Ports ({ports.length})
        </div>

        {ports.length === 0 ? (
          <div
            className="text-neutral-500 italic text-sm"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            No ports registered
          </div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {ports.map((port) => (
              <div
                key={port.id}
                className="flex items-center justify-between p-2 bg-neutral-900/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1 rounded text-xs ${
                      port.direction === 'in'
                        ? 'bg-green-500/20 text-green-300'
                        : port.direction === 'out'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    {port.direction}
                  </span>
                  <span className="font-mono text-neutral-400">
                    {port.label || port.id.slice(0, 8)}
                  </span>
                  <span className="text-neutral-600">→</span>
                  <span className="text-neutral-500">{port.blockId.replace('block-', '')}</span>
                </div>
                <button
                  onClick={() => onDeletePort(port.id)}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          <Link2 size={14} className="text-cyan-400" />
          Links ({links.length})
        </div>

        {links.length === 0 ? (
          <div
            className="text-neutral-500 italic text-sm"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            No links created
          </div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-2 bg-neutral-900/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400">
                    {link.sourcePort.slice(0, 6)}
                  </span>
                  <span className="text-neutral-500">
                    {link.direction === 'bidirectional' ? '⇄' : '→'}
                  </span>
                  <span className="font-mono text-cyan-400">
                    {link.targetPort.slice(0, 6)}
                  </span>
                  <span
                    className={`px-1 rounded text-xs ${
                      link.relationship === 'pipe'
                        ? 'bg-blue-500/20 text-blue-300'
                        : link.relationship === 'sync'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : link.relationship === 'aggregate'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-green-500/20 text-green-300'
                    }`}
                  >
                    {link.relationship}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteLink(link.id)}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Unlink size={12} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Testbed Component
// =============================================================================

export function DataplaneTestbed() {
  const [visualizerMode, setVisualizerMode] = useState<'inline' | 'fullscreen'>('inline');

  // State atoms
  const version = useAtomValue(versionAtom);
  const portCount = useAtomValue(portCountAtom);
  const linkCount = useAtomValue(linkCountAtom);
  const graphInitialized = useAtomValue(graphInitializedAtom);

  // Operation atom setters (effect-atom pattern)
  const setInitGraph = useAtomSet(dataplaneOps.initGraph);
  const setRegisterPort = useAtomSet(dataplaneOps.registerPort);
  const setUnregisterPort = useAtomSet(dataplaneOps.unregisterPort);
  const setCreateLink = useAtomSet(dataplaneOps.createLink);
  const setRemoveLink = useAtomSet(dataplaneOps.removeLink);

  // Initialize graph on mount
  useEffect(() => {
    setInitGraph(undefined);
  }, [setInitGraph]);

  // Handlers - trigger operation atoms via their setters
  const handleCreatePort = useCallback(
    (config: CreatePortConfig) => {
      setRegisterPort(config);
    },
    [setRegisterPort]
  );

  const handleDeletePort = useCallback(
    (portId: PortId) => {
      setUnregisterPort(portId);
    },
    [setUnregisterPort]
  );

  const handleCreateLink = useCallback(
    (config: CreateLinkConfig) => {
      setCreateLink(config);
    },
    [setCreateLink]
  );

  const handleDeleteLink = useCallback(
    (linkId: LinkId) => {
      setRemoveLink(linkId);
    },
    [setRemoveLink]
  );

  // Persistence handlers (placeholder - requires SQLite layer)
  const handleSave = useCallback(() => {
    console.log('Save not yet wired to SQLite');
    // TODO: Wire up DataplanePersistenceService
  }, []);

  const handleLoad = useCallback(() => {
    console.log('Load not yet wired to SQLite');
    // TODO: Wire up DataplanePersistenceService
  }, []);

  const handleClear = useCallback(() => {
    // TODO: Full clear requires iterating over all ports/links/planes
    console.log('Clear not yet implemented');
  }, []);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <TestbedHeader
          title="Dataplane Linking System"
          description="Phase 6: Persistence, Debug Panel, and Testbed"
        >
          <VersionBadge label="Phase" value="6" />
          <VersionBadge label="Ports" value={portCount.toString()} />
          <VersionBadge label="Links" value={linkCount.toString()} />
          <VersionBadge label="Version" value={version.toString()} />
          <div
            className={`px-2 py-1 rounded text-xs ${
              graphInitialized
                ? 'bg-green-500/20 text-green-300'
                : 'bg-yellow-500/20 text-yellow-300'
            }`}
          >
            {graphInitialized ? 'Graph Ready' : 'Initializing...'}
          </div>
        </TestbedHeader>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Controls */}
          <div className="space-y-4">
            <CollapsiblePanel title="Port Creator" defaultOpen>
              <PortCreator onCreatePort={handleCreatePort} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Link Creator" defaultOpen>
              <LinkCreator onCreateLink={handleCreateLink} />
            </CollapsiblePanel>

            <CollapsiblePanel title="Persistence">
              <PersistencePanel
                onSave={handleSave}
                onLoad={handleLoad}
                onClear={handleClear}
              />
            </CollapsiblePanel>
          </div>

          {/* Center Column: Visualizer */}
          <div className="lg:col-span-2 space-y-4">
            <CollapsiblePanel title="React Flow Visualizer" defaultOpen>
              <div className="h-[400px] bg-neutral-950 rounded-lg overflow-hidden">
                <DataplaneVisualizer
                  scope="document"
                  mode={visualizerMode}
                  onModeChange={setVisualizerMode}
                  className="w-full h-full"
                />
              </div>
            </CollapsiblePanel>

            {/* Entity List */}
            <CollapsiblePanel title="Entities" defaultOpen>
              <EntityList
                onDeletePort={handleDeletePort}
                onDeleteLink={handleDeleteLink}
              />
            </CollapsiblePanel>

            {/* Debug Panel */}
            <CollapsiblePanel title="Debug Panel">
              <DataplaneDebugPanel
                defaultExpanded
                onSave={handleSave}
                onLoad={handleLoad}
                onClear={handleClear}
              />
            </CollapsiblePanel>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataplaneTestbed;
