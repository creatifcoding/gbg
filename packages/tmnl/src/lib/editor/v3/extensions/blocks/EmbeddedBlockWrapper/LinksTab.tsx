/**
 * @fileoverview LinksTab Component - Expanded Dataplane UI
 *
 * Settings tab for managing dataplane links on an EmbeddedBlockWrapper.
 * Provides full testbed DX inline:
 * - PortCreator (defaulted to this block)
 * - LinkCreator (source filtered to this block's ports)
 * - Entity list showing ports/links
 * - DataplaneVisualizer (block-scoped React Flow)
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAtomValue, useAtomSet, Atom } from '@effect-atom/atom-react';
import { Schema, Data, Effect, pipe } from 'effect';
import type { Exit } from 'effect';
import {
  Link2,
  Unlink,
  Plus,
  Trash2,
  Box,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { cn } from '@/lib/utils';
import {
  portsAtom,
  linksAtom,
  linksForPortAtom,
  portsByIdAtom,
  selectedLinkAtom,
  forcePortsVisibleAtom,
  dataplaneOps,
  DataplaneVisualizer,
  // Schemas
  getAllowedPortSchemas,
  hasBlockPortConfig,
  type LinkPort,
  type Link,
  type PortId,
  type LinkId,
  type BlockId,
  type CreatePortConfig,
  type CreateLinkConfig,
  type BlockPortSchema,
} from '@/lib/dataplane';
import { useBlockRegistryOptional } from './registry';
import { BlockTypeSchema, type BlockType, type BlockId as SharedBlockId } from './shared';

// =============================================================================
// Types
// =============================================================================

interface LinksTabProps {
  /** Registered ports for this block */
  ports: ReadonlyArray<LinkPort>;
  /** Block ID for reference */
  blockId: string;
  /** Block type for schema lookup */
  blockType: BlockType;
}

// =============================================================================
// Constants
// =============================================================================

const PORT_DIRECTIONS = ['in', 'out', 'inout'] as const;
const PORT_POSITIONS = ['left', 'right', 'top', 'bottom'] as const;
const PORT_DATA_TYPES = ['geojson', 'table', 'row', 'cell', 'json', 'stream'] as const;
const LINK_DIRECTIONS = ['unidirectional', 'bidirectional'] as const;
const LINK_RELATIONSHIPS = ['pipe', 'sync', 'aggregate', 'mirror'] as const;

// =============================================================================
// Collapsible Section
// =============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: VANTA_COLORS.surface.sunken,
        borderRadius: VANTA_BORDERS.radius.md,
        border: `1px solid ${VANTA_COLORS.surface.border}`,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: VANTA_COLORS.text.secondary,
        }}
      >
        {icon}
        <span style={{ ...VANTA_TYPOGRAPHY.preset.label, flex: 1, textAlign: 'left' }}>
          {title}
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {isOpen && (
        <div
          style={{
            padding: VANTA_SPACING['3'],
            borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Port Creator (Inline) - Schema-based
// =============================================================================

/**
 * Tagged error for PortCreatorInline prop validation failures.
 * Developer error - indicates missing or invalid props.
 */
class PortCreatorPropsError extends Data.TaggedError('PortCreatorPropsError')<{
  readonly component: 'PortCreatorInline';
  readonly props: unknown;
  readonly message: string;
}> {}

/**
 * Schema for PortCreatorInline props.
 * Validates blockId and blockType at runtime.
 */
const PortCreatorInlinePropsSchema = Schema.Struct({
  blockId: Schema.String.pipe(Schema.minLength(1)),
  blockType: BlockTypeSchema,
  onCreated: Schema.optional(Schema.Any),
});
type PortCreatorInlineProps = typeof PortCreatorInlinePropsSchema.Type;

/**
 * Validate props with Effect, mapping parse errors to PortCreatorPropsError.
 */
const validatePortCreatorProps = (props: unknown) =>
  pipe(
    Schema.decodeUnknown(PortCreatorInlinePropsSchema)(props),
    Effect.mapError((parseError) =>
      new PortCreatorPropsError({
        component: 'PortCreatorInline',
        props,
        message: [
          `[PortCreatorInline] Invalid props received.`,
          `Ensure blockType is passed from LinksTab.`,
          ``,
          `Received: ${JSON.stringify(props, null, 2)}`,
          ``,
          `Schema validation error:`,
          parseError.message,
        ].join('\n'),
      })
    )
  );

/**
 * PortCreatorInline - Schema-validated component.
 *
 * Props are validated at runtime via Effect.Schema.
 * Invalid props throw PortCreatorPropsError as a defect.
 */
function PortCreatorInline(rawProps: PortCreatorInlineProps) {
  // Schema validation - decodes and validates props
  // Throws PortCreatorPropsError if blockType is missing/invalid
  const { blockId, blockType, onCreated } = Effect.runSync(
    pipe(
      validatePortCreatorProps(rawProps),
      Effect.catchTag('PortCreatorPropsError', (err) => Effect.die(err))
    )
  );

  // Get allowed port schemas for this block type
  const allowedSchemas = useMemo(
    () => getAllowedPortSchemas(blockType),
    [blockType]
  );
  const hasSchemas = allowedSchemas.length > 0;

  // Schema-based mode: select from allowed schemas
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  // Fallback mode: use generic dropdowns (for unconfigured blocks)
  const [direction, setDirection] = useState<(typeof PORT_DIRECTIONS)[number]>('out');
  const [position, setPosition] = useState<(typeof PORT_POSITIONS)[number]>('right');
  const [dataType, setDataType] = useState<(typeof PORT_DATA_TYPES)[number]>('table');

  // Use useAtomSet to get a callable function from the operation atom
  const doRegisterPort = useAtomSet(dataplaneOps.registerPort, { mode: 'promise' });

  // Auto-select first schema on mount
  useEffect(() => {
    if (hasSchemas && !selectedSchemaId && allowedSchemas.length > 0) {
      setSelectedSchemaId(allowedSchemas[0].id);
    }
  }, [hasSchemas, selectedSchemaId, allowedSchemas]);

  const selectedSchema = useMemo(
    () => allowedSchemas.find((s) => s.id === selectedSchemaId),
    [allowedSchemas, selectedSchemaId]
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (hasSchemas && selectedSchema) {
        // Schema-based port creation
        console.log('[LinksTab/PortCreator] Creating schema-based port:', {
          blockId,
          schemaId: selectedSchema.id,
          dataType: selectedSchema.dataType.category,
          direction: selectedSchema.direction,
          position: selectedSchema.position,
          label: label || selectedSchema.label,
        });
        const port = await doRegisterPort({
          blockId,
          direction: selectedSchema.direction,
          position: selectedSchema.position,
          // Use the category as the legacy dataType for now
          dataType: selectedSchema.dataType.category as typeof dataType,
          label: label || selectedSchema.label,
        });
        console.log('[LinksTab/PortCreator] Schema-based port registered:', port);
      } else {
        // Fallback: generic port creation
        console.log('[LinksTab/PortCreator] Registering generic port:', {
          blockId,
          direction,
          position,
          dataType,
          label: label || undefined,
        });
        const port = await doRegisterPort({
          blockId,
          direction,
          position,
          dataType,
          label: label || undefined,
        });
        console.log('[LinksTab/PortCreator] Generic port registered:', port);
      }
      setLabel('');
      onCreated?.();
    } catch (err) {
      console.error('[LinksTab/PortCreator] Failed to register port:', err);
    } finally {
      setCreating(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: VANTA_COLORS.surface.default,
    border: `1px solid ${VANTA_COLORS.surface.border}`,
    borderRadius: VANTA_BORDERS.radius.sm,
    padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
    color: VANTA_COLORS.text.primary,
    fontSize: 'var(--tmnl-text-xs, 12px)',
  };

  // Schema-based UI
  if (hasSchemas) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
        {/* Schema selector */}
        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Port Type
          </label>
          <select
            value={selectedSchemaId}
            onChange={(e) => setSelectedSchemaId(e.target.value)}
            style={selectStyle}
          >
            {allowedSchemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.label} ({schema.dataType.displayName})
              </option>
            ))}
          </select>
        </div>

        {/* Schema info */}
        {selectedSchema && (
          <div
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              padding: VANTA_SPACING['2'],
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: VANTA_BORDERS.radius.sm,
            }}
          >
            <div style={{ display: 'flex', gap: VANTA_SPACING['3'], flexWrap: 'wrap' }}>
              <span>
                <strong>Direction:</strong> {selectedSchema.direction}
              </span>
              <span>
                <strong>Position:</strong> {selectedSchema.position}
              </span>
              <span>
                <strong>Multiple:</strong> {selectedSchema.cardinality === 'multi' ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}

        {/* Optional custom label */}
        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Custom Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={selectedSchema?.label ?? 'Optional...'}
            style={{
              ...selectStyle,
              fontFamily: 'var(--tmnl-font-mono)',
            }}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !selectedSchemaId}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: VANTA_SPACING['2'],
            padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
            background: VANTA_COLORS.accent.cyanGlow,
            border: `1px solid ${VANTA_COLORS.accent.cyanMuted}`,
            borderRadius: VANTA_BORDERS.radius.sm,
            color: VANTA_COLORS.accent.cyan,
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.6 : 1,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          {creating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
          Add Port
        </button>
      </div>
    );
  }

  // Fallback: generic dropdowns for unconfigured block types
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
      {/* Warning for unconfigured blocks */}
      <div
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.accent.amber,
          padding: VANTA_SPACING['2'],
          background: VANTA_COLORS.accent.amberGlow,
          borderRadius: VANTA_BORDERS.radius.sm,
          border: `1px solid ${VANTA_COLORS.accent.amberMuted}`,
        }}
      >
        ⚠️ No port schema defined for "{blockType}" blocks. Using generic port types.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: VANTA_SPACING['2'] }}>
        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Direction
          </label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
            style={selectStyle}
          >
            {PORT_DIRECTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Position
          </label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as typeof position)}
            style={selectStyle}
          >
            {PORT_POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Data Type
          </label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value as typeof dataType)}
            style={selectStyle}
          >
            {PORT_DATA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional..."
            style={{
              ...selectStyle,
              fontFamily: 'var(--tmnl-font-mono)',
            }}
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={creating}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: VANTA_SPACING['2'],
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
          background: VANTA_COLORS.accent.cyanGlow,
          border: `1px solid ${VANTA_COLORS.accent.cyanMuted}`,
          borderRadius: VANTA_BORDERS.radius.sm,
          color: VANTA_COLORS.accent.cyan,
          cursor: creating ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.6 : 1,
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        {creating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
        Add Port
      </button>
    </div>
  );
}

// =============================================================================
// Link Creator (Inline)
// =============================================================================

interface LinkCreatorInlineProps {
  /** This block's ports (default source options) */
  blockPorts: ReadonlyArray<LinkPort>;
  blockId: BlockId;
  onCreated?: () => void;
}

function LinkCreatorInline({ blockPorts, blockId, onCreated }: LinkCreatorInlineProps) {
  const allPorts = useAtomValue(portsAtom);
  const [sourcePort, setSourcePort] = useState<PortId | ''>('');
  const [targetPort, setTargetPort] = useState<PortId | ''>('');
  const [relationship, setRelationship] = useState<(typeof LINK_RELATIONSHIPS)[number]>('pipe');
  const [creating, setCreating] = useState(false);

  // Use useAtomSet to get a callable function from the operation atom
  const doCreateLink = useAtomSet(dataplaneOps.createLink, { mode: 'promise' });

  // Auto-select first port from this block as source
  useEffect(() => {
    if (blockPorts.length > 0 && !sourcePort) {
      const outPort = blockPorts.find((p) => p.direction === 'out' || p.direction === 'inout');
      if (outPort) setSourcePort(outPort.id);
    }
  }, [blockPorts, sourcePort]);

  // Filter target ports to only show OTHER blocks' input ports
  const targetOptions = useMemo(() => {
    return allPorts.filter(
      (p) =>
        p.blockId !== blockId &&
        (p.direction === 'in' || p.direction === 'inout')
    );
  }, [allPorts, blockId]);

  const handleCreate = async () => {
    if (!sourcePort || !targetPort || sourcePort === targetPort) return;

    setCreating(true);
    try {
      console.log('[LinksTab/LinkCreator] Creating link:', {
        sourcePort,
        targetPort,
        direction: 'unidirectional',
        relationship,
      });
      const link = await doCreateLink({
        sourcePort: sourcePort as PortId,
        targetPort: targetPort as PortId,
        direction: 'unidirectional',
        relationship,
      });
      console.log('[LinksTab/LinkCreator] Link created:', link);
      setTargetPort('');
      onCreated?.();
    } catch (err) {
      console.error('[LinksTab/LinkCreator] Failed to create link:', err);
    } finally {
      setCreating(false);
    }
  };

  const canCreate = sourcePort && targetPort && sourcePort !== targetPort;

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: VANTA_COLORS.surface.default,
    border: `1px solid ${VANTA_COLORS.surface.border}`,
    borderRadius: VANTA_BORDERS.radius.sm,
    padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
    color: VANTA_COLORS.text.primary,
    fontSize: 'var(--tmnl-text-xs, 12px)',
  };

  // Show helpful message if no ports exist
  if (blockPorts.length === 0) {
    return (
      <div
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.muted,
          textAlign: 'center',
          padding: VANTA_SPACING['3'],
        }}
      >
        Create ports first to enable linking
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: VANTA_SPACING['2'] }}>
        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Source (this block)
          </label>
          <select
            value={sourcePort}
            onChange={(e) => setSourcePort(e.target.value as PortId)}
            style={selectStyle}
          >
            <option value="">Select port...</option>
            {blockPorts
              .filter((p) => p.direction === 'out' || p.direction === 'inout')
              .map((port) => (
                <option key={port.id} value={port.id}>
                  {port.label || `${port.position} (${port.direction})`}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            style={{
              ...VANTA_TYPOGRAPHY.preset.micro,
              color: VANTA_COLORS.text.muted,
              display: 'block',
              marginBottom: VANTA_SPACING['1'],
            }}
          >
            Target (other block)
          </label>
          <select
            value={targetPort}
            onChange={(e) => setTargetPort(e.target.value as PortId)}
            style={selectStyle}
          >
            <option value="">Select port...</option>
            {targetOptions.map((port) => (
              <option key={port.id} value={port.id}>
                {port.blockId.slice(0, 8)}:{port.label || port.position}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
            display: 'block',
            marginBottom: VANTA_SPACING['1'],
          }}
        >
          Relationship
        </label>
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as typeof relationship)}
          style={selectStyle}
        >
          {LINK_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleCreate}
        disabled={creating || !canCreate}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: VANTA_SPACING['2'],
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
          background: canCreate ? VANTA_COLORS.accent.cyanGlow : 'transparent',
          border: `1px solid ${canCreate ? VANTA_COLORS.accent.cyanMuted : VANTA_COLORS.surface.border}`,
          borderRadius: VANTA_BORDERS.radius.sm,
          color: canCreate ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.muted,
          cursor: creating || !canCreate ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.6 : 1,
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        {creating ? <RefreshCw size={12} className="animate-spin" /> : <Link2 size={12} />}
        Create Link
      </button>
    </div>
  );
}

// =============================================================================
// Port Links List (unchanged from original)
// =============================================================================

interface PortLinksListProps {
  port: LinkPort;
}

function PortLinksList({ port }: PortLinksListProps) {
  const links = useAtomValue(useMemo(() => linksForPortAtom(port.id), [port.id]));
  const portsById = useAtomValue(portsByIdAtom);
  const selectedLinkId = useAtomValue(selectedLinkAtom);
  const registry = useBlockRegistryOptional();

  // Use useAtomSet to get a callable function from the operation atom
  const doRemoveLink = useAtomSet(dataplaneOps.removeLink, { mode: 'promise' });

  const handleLinkClick = useCallback((linkId: LinkId) => {
    const current = Atom.get(selectedLinkAtom);
    Atom.set(selectedLinkAtom, current === linkId ? null : linkId);
  }, []);

  const handleDeleteLink = useCallback(async (linkId: LinkId) => {
    try {
      console.log('[LinksTab/PortLinksList] Removing link:', linkId);
      await doRemoveLink(linkId);
      console.log('[LinksTab/PortLinksList] Link removed successfully');
      Atom.set(selectedLinkAtom, null);
    } catch (err) {
      console.error('[LinksTab/PortLinksList] Failed to delete link:', err);
    }
  }, [doRemoveLink]);

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

        const otherBlockId = otherPort?.blockId;
        const otherBlock = otherBlockId ? registry?.getBlock(otherBlockId) : undefined;
        const otherBlockName = otherBlock?.name ?? otherPort?.dataType ?? 'unknown';

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
              border: `1px solid ${isSelected ? 'rgba(52, 211, 153, 0.4)' : 'transparent'}`,
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
              {isSource ? `→ ${otherBlockName}` : `← ${otherBlockName}`} ({link.relationship})
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

// =============================================================================
// Port Row (simplified)
// =============================================================================

interface PortRowProps {
  port: LinkPort;
  onDelete?: (portId: PortId) => void;
}

function PortRow({ port, onDelete }: PortRowProps) {
  const directionColor =
    port.direction === 'in'
      ? VANTA_COLORS.accent.cyan
      : port.direction === 'out'
      ? VANTA_COLORS.accent.amber
      : VANTA_COLORS.accent.violet;

  return (
    <div
      style={{
        padding: VANTA_SPACING['2'],
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: VANTA_BORDERS.radius.sm,
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
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: directionColor,
            boxShadow: `0 0 6px ${directionColor}`,
            flexShrink: 0,
          }}
        />

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

        {onDelete && (
          <button
            onClick={() => onDelete(port.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: VANTA_BORDERS.radius.sm,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: VANTA_COLORS.text.muted,
            }}
            title="Delete port"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>

      {/* Connected links */}
      <PortLinksList port={port} />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LinksTab({ ports, blockId, blockType }: LinksTabProps) {
  const [visualizerMode, setVisualizerMode] = useState<'inline' | 'fullscreen'>('inline');

  // Use useAtomSet to get a callable function from the operation atom
  const doUnregisterPort = useAtomSet(dataplaneOps.unregisterPort, { mode: 'promise' });

  // Force all ports and links visible while Links tab is open
  useEffect(() => {
    Atom.set(forcePortsVisibleAtom, true);
    return () => {
      Atom.set(forcePortsVisibleAtom, false);
    };
  }, []);

  const handleDeletePort = useCallback(async (portId: PortId) => {
    try {
      console.log('[LinksTab] Unregistering port:', portId);
      await doUnregisterPort(portId);
      console.log('[LinksTab] Port unregistered successfully');
    } catch (err) {
      console.error('[LinksTab] Failed to delete port:', err);
    }
  }, [doUnregisterPort]);

  return (
    <div
      style={{
        display: 'flex',
        gap: VANTA_SPACING['3'],
        minHeight: '300px',
      }}
    >
      {/* Left: Visualizer canvas */}
      <div
        style={{
          flex: '1 1 50%',
          minWidth: 0,
          borderRadius: VANTA_BORDERS.radius.md,
          overflow: 'hidden',
          border: `1px solid ${VANTA_COLORS.surface.border}`,
        }}
      >
        <DataplaneVisualizer
          scope="block"
          blockId={blockId as BlockId}
          mode={visualizerMode}
          onModeChange={setVisualizerMode}
          inlineHeight="100%"
        />
      </div>

      {/* Right: Controls */}
      <div
        style={{
          flex: '1 1 50%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: VANTA_SPACING['2'],
          overflowY: 'auto',
        }}
      >
        {/* Port Creator */}
        <CollapsibleSection
          title="Add Port"
          icon={<Box size={14} style={{ color: VANTA_COLORS.accent.cyan }} />}
          defaultOpen={false}
        >
          <PortCreatorInline blockId={blockId as BlockId} blockType={blockType} />
        </CollapsibleSection>

        {/* Link Creator */}
        <CollapsibleSection
          title="Create Link"
          icon={<Link2 size={14} style={{ color: VANTA_COLORS.accent.emerald }} />}
          defaultOpen={false}
        >
          <LinkCreatorInline blockPorts={ports} blockId={blockId as BlockId} />
        </CollapsibleSection>

        {/* Ports List */}
        <CollapsibleSection
          title={`Ports (${ports.length})`}
          icon={<Layers size={14} style={{ color: VANTA_COLORS.accent.amber }} />}
          defaultOpen={true}
        >
          {ports.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: VANTA_SPACING['4'],
                gap: VANTA_SPACING['2'],
              }}
            >
              <Unlink size={24} style={{ color: VANTA_COLORS.text.muted }} />
              <span style={{ ...VANTA_TYPOGRAPHY.preset.body, color: VANTA_COLORS.text.muted }}>
                No ports configured
              </span>
              <span style={{ ...VANTA_TYPOGRAPHY.preset.micro, color: VANTA_COLORS.text.tertiary }}>
                Use "Add Port" to create ports
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
              {ports.map((port) => (
                <PortRow key={port.id} port={port} onDelete={handleDeletePort} />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Instructions */}
        <div
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
            textAlign: 'center',
            padding: VANTA_SPACING['2'],
            marginTop: 'auto',
          }}
        >
          Drag between ports to link
        </div>
      </div>
    </div>
  );
}

export default LinksTab;
