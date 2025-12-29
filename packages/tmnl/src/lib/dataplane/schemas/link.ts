/**
 * @fileoverview Dataplane Link Schemas
 *
 * Schema definitions for the linking system:
 * - Branded IDs (PortId, LinkId, PlaneId, BlockId)
 * - LinkDirection and LinkRelationship literals
 * - LinkPort and Link TaggedClasses
 * - Plane TaggedClass for bus abstraction
 */

import { Schema } from 'effect';

// =============================================================================
// Branded ID Types
// =============================================================================

/** Branded identifier for data ports */
export const PortId = Schema.String.pipe(
  Schema.brand('PortId'),
  Schema.minLength(1)
);
export type PortId = typeof PortId.Type;

/** Branded identifier for links between ports */
export const LinkId = Schema.String.pipe(
  Schema.brand('LinkId'),
  Schema.minLength(1)
);
export type LinkId = typeof LinkId.Type;

/** Branded identifier for planes (data buses) */
export const PlaneId = Schema.String.pipe(
  Schema.brand('PlaneId'),
  Schema.minLength(1)
);
export type PlaneId = typeof PlaneId.Type;

/** Branded identifier for editor blocks */
export const BlockId = Schema.String.pipe(
  Schema.brand('BlockId'),
  Schema.minLength(1)
);
export type BlockId = typeof BlockId.Type;

// =============================================================================
// Enums (Schema.Literal)
// =============================================================================

/** Direction of data flow through a link */
export const LinkDirection = Schema.Literal('unidirectional', 'bidirectional');
export type LinkDirection = typeof LinkDirection.Type;

/**
 * Relationship type defining how data flows through a link
 *
 * - `pipe`: Source → transform → Target (filter/map operations)
 * - `sync`: Bidirectional sync with conflict resolution (last-write-wins)
 * - `aggregate`: Many sources → single aggregated target (reduce)
 * - `mirror`: 1:1 copy without transformation
 */
export const LinkRelationship = Schema.Literal(
  'pipe',
  'sync',
  'aggregate',
  'mirror'
);
export type LinkRelationship = typeof LinkRelationship.Type;

/** Port direction for data flow */
export const PortDirection = Schema.Literal('in', 'out', 'inout');
export type PortDirection = typeof PortDirection.Type;

/** Visual position of port on block */
export const PortPosition = Schema.Literal('left', 'right', 'top', 'bottom');
export type PortPosition = typeof PortPosition.Type;

/** Data type transported through port */
export const PortDataType = Schema.Literal(
  'table',
  'row',
  'cell',
  'json',
  'stream'
);
export type PortDataType = typeof PortDataType.Type;

// =============================================================================
// LinkPort Schema
// =============================================================================

/**
 * A data port attached to an EmbeddedBlockWrapper component.
 * Ports are connection points for dataplane links.
 */
export class LinkPort extends Schema.TaggedClass<LinkPort>()('LinkPort', {
  /** Unique port identifier */
  id: PortId,

  /** Block this port belongs to */
  blockId: BlockId,

  /** Direction of data flow (in, out, or bidirectional) */
  direction: PortDirection,

  /** Type of data this port handles */
  dataType: PortDataType,

  /** Visual position on the block */
  position: PortPosition,

  /** Optional human-readable label */
  label: Schema.optional(Schema.String),

  /** Parent block ID for nested blocks */
  parentBlockId: Schema.optional(BlockId),
}) {
  /** Check if port accepts incoming data */
  get acceptsInput(): boolean {
    return this.direction === 'in' || this.direction === 'inout';
  }

  /** Check if port produces outgoing data */
  get producesOutput(): boolean {
    return this.direction === 'out' || this.direction === 'inout';
  }
}

// =============================================================================
// Link Schema
// =============================================================================

/**
 * A connection between two LinkPorts defining data flow relationship.
 */
export class Link extends Schema.TaggedClass<Link>()('Link', {
  /** Unique link identifier */
  id: LinkId,

  /** Source port ID */
  sourcePort: PortId,

  /** Target port ID */
  targetPort: PortId,

  /** Direction of data flow */
  direction: LinkDirection,

  /** Relationship type (pipe, sync, aggregate, mirror) */
  relationship: LinkRelationship,

  /** Optional transform expression (D2QL or JS arrow function) */
  transform: Schema.optional(Schema.String),

  /** Creation timestamp */
  createdAt: Schema.DateFromSelf,

  /** Optional metadata */
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
}) {
  /** Check if link is bidirectional */
  get isBidirectional(): boolean {
    return this.direction === 'bidirectional';
  }

  /** Check if link has a transform */
  get hasTransform(): boolean {
    return this.transform !== undefined && this.transform.length > 0;
  }
}

// =============================================================================
// Plane Schema (Bus Abstraction)
// =============================================================================

/**
 * A Plane is a grouping mechanism for linked blocks that acts as a data bus.
 * All ports in a plane share data via broadcast semantics.
 * Planes can be nested for hierarchical organization.
 */
export class Plane extends Schema.TaggedClass<Plane>()('Plane', {
  /** Unique plane identifier */
  id: PlaneId,

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Parent plane ID for nesting (null for root planes) */
  parentPlaneId: Schema.NullOr(PlaneId),

  /** Member port IDs */
  portIds: Schema.Array(PortId),

  /** Creation timestamp */
  createdAt: Schema.DateFromSelf,

  /** Optional metadata */
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
}) {
  /** Check if plane is nested under another plane */
  get isNested(): boolean {
    return this.parentPlaneId !== null;
  }

  /** Check if plane has any members */
  get hasPorts(): boolean {
    return this.portIds.length > 0;
  }

  /** Get member count */
  get memberCount(): number {
    return this.portIds.length;
  }
}

// =============================================================================
// Utility Schemas
// =============================================================================

/** Array of links */
export const Links = Schema.Array(Link);
export type Links = typeof Links.Type;

/** Array of ports */
export const LinkPorts = Schema.Array(LinkPort);
export type LinkPorts = typeof LinkPorts.Type;

/** Array of planes */
export const Planes = Schema.Array(Plane);
export type Planes = typeof Planes.Type;

/** Configuration for creating a new link */
export const CreateLinkConfig = Schema.Struct({
  sourcePort: PortId,
  targetPort: PortId,
  direction: LinkDirection,
  relationship: LinkRelationship,
  transform: Schema.optional(Schema.String),
});
export type CreateLinkConfig = typeof CreateLinkConfig.Type;

/** Configuration for creating a new port */
export const CreatePortConfig = Schema.Struct({
  blockId: BlockId,
  direction: PortDirection,
  dataType: PortDataType,
  position: PortPosition,
  label: Schema.optional(Schema.String),
  parentBlockId: Schema.optional(BlockId),
});
export type CreatePortConfig = typeof CreatePortConfig.Type;

/** Configuration for creating a new plane */
export const CreatePlaneConfig = Schema.Struct({
  name: Schema.NonEmptyString,
  parentPlaneId: Schema.optional(PlaneId),
});
export type CreatePlaneConfig = typeof CreatePlaneConfig.Type;
