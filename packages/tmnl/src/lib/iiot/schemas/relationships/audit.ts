/** Relationship edge audit read model schemas. */

import { Schema } from 'effect'
import {
  RelationshipEdgeType,
  RelationshipNodeType,
} from './edge-types'

export const RelationshipEdgeAuditAction = Schema.Literal('upsert', 'soft_delete')
export type RelationshipEdgeAuditAction = typeof RelationshipEdgeAuditAction.Type

export class RelationshipEdgeAuditEntry extends Schema.Class<RelationshipEdgeAuditEntry>('RelationshipEdgeAuditEntry')({
  id: Schema.String,
  edgeId: Schema.String,
  action: RelationshipEdgeAuditAction,
  edgeType: RelationshipEdgeType,
  sourceType: RelationshipNodeType,
  sourceId: Schema.String,
  targetType: RelationshipNodeType,
  targetId: Schema.String,
  actor: Schema.String,
  reason: Schema.OptionFromNullOr(Schema.String),
  descriptorVersion: Schema.Number,
  validFrom: Schema.OptionFromNullOr(Schema.DateFromSelf),
  validTo: Schema.OptionFromNullOr(Schema.DateFromSelf),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.DateFromSelf,
}) {}
export type RelationshipEdgeAuditEntry = typeof RelationshipEdgeAuditEntry.Type

export class RelationshipEdgeAuditQuery extends Schema.Class<RelationshipEdgeAuditQuery>('RelationshipEdgeAuditQuery')({
  edgeId: Schema.optional(Schema.String),
  edgeType: Schema.optional(RelationshipEdgeType),
  sourceType: Schema.optional(RelationshipNodeType),
  sourceId: Schema.optional(Schema.String),
  targetType: Schema.optional(RelationshipNodeType),
  targetId: Schema.optional(Schema.String),
  action: Schema.optional(RelationshipEdgeAuditAction),
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { default: () => 100 }),
}) {}
export type RelationshipEdgeAuditQuery = typeof RelationshipEdgeAuditQuery.Type
