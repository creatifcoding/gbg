/**
 * @fileoverview SQLite Models for Dataplane Persistence
 *
 * Uses @effect/sql Model.Class pattern for typed CRUD.
 * Persists LinkPorts, Links, and Planes to SQLite.
 *
 * @module dataplane/persistence/models
 */

import { Model } from '@effect/sql';
import { Schema } from 'effect';

import {
  PortId,
  LinkId,
  PlaneId,
  BlockId,
  PortDirection,
  PortPosition,
  PortDataType,
  LinkDirection,
  LinkRelationship,
} from '../schemas/link';

// =============================================================================
// LinkPort Model
// =============================================================================

/**
 * SQLite model for data ports attached to blocks.
 *
 * Table: dataplane_ports
 * Primary Key: id (TEXT, client-provided)
 */
export class LinkPortModel extends Model.Class<LinkPortModel>('LinkPortModel')({
  /** Unique port identifier (primary key, client-provided) */
  id: Model.GeneratedByApp(PortId),

  /** Block this port belongs to */
  blockId: BlockId,

  /** Direction of data flow (in, out, inout) */
  direction: PortDirection,

  /** Type of data this port handles */
  dataType: PortDataType,

  /** Visual position on the block */
  position: PortPosition,

  /** Optional human-readable label */
  label: Schema.NullOr(Schema.String),

  /** Parent block ID for nested blocks */
  parentBlockId: Schema.NullOr(BlockId),

  /** When port was created */
  createdAt: Model.DateTimeInsert,

  /** When port was last updated */
  updatedAt: Model.DateTimeUpdate,
}) {}

// =============================================================================
// Link Model
// =============================================================================

/**
 * SQLite model for connections between ports.
 *
 * Table: dataplane_links
 * Primary Key: id (TEXT, client-provided)
 */
export class LinkModel extends Model.Class<LinkModel>('LinkModel')({
  /** Unique link identifier (primary key, client-provided) */
  id: Model.GeneratedByApp(LinkId),

  /** Source port ID */
  sourcePort: PortId,

  /** Target port ID */
  targetPort: PortId,

  /** Direction of data flow */
  direction: LinkDirection,

  /** Relationship type (pipe, sync, aggregate, mirror) */
  relationship: LinkRelationship,

  /** Optional transform expression (D2QL or JS arrow function) */
  transform: Schema.NullOr(Schema.String),

  /** Optional metadata (JSON string) */
  metadataJson: Schema.NullOr(Schema.String),

  /** When link was created */
  createdAt: Model.DateTimeInsert,

  /** When link was last updated */
  updatedAt: Model.DateTimeUpdate,
}) {}

// =============================================================================
// Plane Model
// =============================================================================

/**
 * SQLite model for plane (data bus) groupings.
 *
 * Table: dataplane_planes
 * Primary Key: id (TEXT, client-provided)
 */
export class PlaneModel extends Model.Class<PlaneModel>('PlaneModel')({
  /** Unique plane identifier (primary key, client-provided) */
  id: Model.GeneratedByApp(PlaneId),

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Parent plane ID for nesting (null for root planes) */
  parentPlaneId: Schema.NullOr(PlaneId),

  /** Member port IDs (JSON array string) */
  portIdsJson: Schema.String,

  /** Optional metadata (JSON string) */
  metadataJson: Schema.NullOr(Schema.String),

  /** When plane was created */
  createdAt: Model.DateTimeInsert,

  /** When plane was last updated */
  updatedAt: Model.DateTimeUpdate,
}) {}
