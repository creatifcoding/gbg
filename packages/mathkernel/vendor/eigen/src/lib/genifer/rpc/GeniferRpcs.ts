/**
 * GeniferRpcs — Entity RPCs for Genifer Queries
 *
 * Stateless query operations wired to genifer repos.
 * Pattern: follows iiot/rpc/AlarmRpcs.ts — Rpc.make + RpcGroup.make
 *
 * Three RPC groups:
 *   - GeniferTreeRpcs: tree CRUD + quality/thread queries
 *   - GeniferElementRpcs: element lookups by tree/key
 *   - GeniferCompositeRpcs: composite CRUD + listing
 *
 * Combined into a single GeniferRpcs export.
 *
 * @module genifer/rpc/GeniferRpcs
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'
import {
  TreeGetByIdTag,
  TreeFindByThreadTag,
  TreeFindByQualityTag,
  TreeInsertTag,
  TreeUpdateRatingTag,
  TreeIncrementUsageTag,
  TreeDeleteTag,
  ElementFindByTreeTag,
  ElementFindByKeyTag,
  ElementInsertBatchTag,
  ElementDeleteByTreeTag,
  CompositeFindByNameTag,
  CompositeInsertTag,
  CompositeListTag,
  SignalRecordTag,
  SignalGetForTreeTag,
} from './tags'
import {
  RpcGeniferQueryError,
  RpcGeniferTreeNotFoundError,
  RpcGeniferElementNotFoundError,
  RpcGeniferCompositeNotFoundError,
  RpcGeniferValidationError,
} from './errors'

// =============================================================================
// Shared payload schemas (lightweight — not full model schemas)
// =============================================================================

const TreeId = Schema.String.pipe(Schema.brand('GeniferTreeId'))
type TreeId = typeof TreeId.Type

const TreeSummary = Schema.Struct({
  id: Schema.String,
  prompt: Schema.String,
  rootKey: Schema.String,
  model: Schema.NullOr(Schema.String),
  qualityScore: Schema.NullOr(Schema.Number),
  elementCount: Schema.Number,
  repairCount: Schema.Number,
  durationMs: Schema.Number,
  threadId: Schema.NullOr(Schema.String),
  humanRating: Schema.NullOr(Schema.Number),
  usageCount: Schema.Number,
  createdAt: Schema.DateTimeUtc,
})

const ElementSummary = Schema.Struct({
  id: Schema.String,
  treeId: Schema.String,
  elementKey: Schema.String,
  elementType: Schema.String,
  parentKey: Schema.NullOr(Schema.String),
  props: Schema.Unknown,
  childKeys: Schema.Unknown,
  position: Schema.Number,
})

const CompositeSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  rootKey: Schema.String,
  tags: Schema.Unknown,
  metadata: Schema.Unknown,
  usageCount: Schema.Number,
  createdAt: Schema.DateTimeUtc,
})

// =============================================================================
// Tree RPCs
// =============================================================================

export const GetTreeById = Rpc.make(TreeGetByIdTag, {
  payload: Schema.Struct({ treeId: Schema.String }),
  success: Schema.NullOr(TreeSummary),
  error: RpcGeniferQueryError,
})

export const FindTreesByThread = Rpc.make(TreeFindByThreadTag, {
  payload: Schema.Struct({ threadId: Schema.String }),
  success: Schema.Array(TreeSummary),
  error: RpcGeniferQueryError,
})

export const FindTreesByQuality = Rpc.make(TreeFindByQualityTag, {
  payload: Schema.Struct({
    minScore: Schema.Number,
    limit: Schema.optional(Schema.Number),
  }),
  success: Schema.Array(TreeSummary),
  error: RpcGeniferQueryError,
})

export const InsertTree = Rpc.make(TreeInsertTag, {
  payload: Schema.Struct({
    prompt: Schema.String,
    rootKey: Schema.String,
    model: Schema.NullOr(Schema.String),
    qualityScore: Schema.NullOr(Schema.Number),
    elementCount: Schema.Number,
    repairCount: Schema.Number,
    durationMs: Schema.Number,
    threadId: Schema.NullOr(Schema.String),
    parentTreeId: Schema.NullOr(Schema.String),
    tags: Schema.optional(Schema.Unknown),
    metadata: Schema.optional(Schema.Unknown),
  }),
  success: TreeSummary,
  error: Schema.Union(RpcGeniferQueryError, RpcGeniferValidationError),
})

export const UpdateTreeRating = Rpc.make(TreeUpdateRatingTag, {
  payload: Schema.Struct({
    treeId: Schema.String,
    rating: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(5)),
  }),
  success: TreeSummary,
  error: Schema.Union(RpcGeniferQueryError, RpcGeniferTreeNotFoundError),
})

export const IncrementTreeUsage = Rpc.make(TreeIncrementUsageTag, {
  payload: Schema.Struct({ treeId: Schema.String }),
  success: Schema.Void,
  error: RpcGeniferQueryError,
})

export const DeleteTree = Rpc.make(TreeDeleteTag, {
  payload: Schema.Struct({ treeId: Schema.String }),
  success: Schema.Void,
  error: RpcGeniferQueryError,
})

export const GeniferTreeRpcs = RpcGroup.make(
  GetTreeById,
  FindTreesByThread,
  FindTreesByQuality,
  InsertTree,
  UpdateTreeRating,
  IncrementTreeUsage,
  DeleteTree,
)

// =============================================================================
// Element RPCs
// =============================================================================

export const FindElementsByTree = Rpc.make(ElementFindByTreeTag, {
  payload: Schema.Struct({ treeId: Schema.String }),
  success: Schema.Array(ElementSummary),
  error: RpcGeniferQueryError,
})

export const FindElementByKey = Rpc.make(ElementFindByKeyTag, {
  payload: Schema.Struct({
    treeId: Schema.String,
    elementKey: Schema.String,
  }),
  success: Schema.NullOr(ElementSummary),
  error: RpcGeniferQueryError,
})

export const InsertElementBatch = Rpc.make(ElementInsertBatchTag, {
  payload: Schema.Struct({
    treeId: Schema.String,
    elements: Schema.Array(Schema.Struct({
      elementKey: Schema.String,
      elementType: Schema.String,
      parentKey: Schema.NullOr(Schema.String),
      props: Schema.Unknown,
      childKeys: Schema.Unknown,
      position: Schema.Number,
    })),
  }),
  success: Schema.Number, // count inserted
  error: Schema.Union(RpcGeniferQueryError, RpcGeniferValidationError),
})

export const DeleteElementsByTree = Rpc.make(ElementDeleteByTreeTag, {
  payload: Schema.Struct({ treeId: Schema.String }),
  success: Schema.Void,
  error: RpcGeniferQueryError,
})

export const GeniferElementRpcs = RpcGroup.make(
  FindElementsByTree,
  FindElementByKey,
  InsertElementBatch,
  DeleteElementsByTree,
)

// =============================================================================
// Composite RPCs
// =============================================================================

export const FindCompositeByName = Rpc.make(CompositeFindByNameTag, {
  payload: Schema.Struct({ name: Schema.String }),
  success: Schema.NullOr(CompositeSummary),
  error: RpcGeniferQueryError,
})

export const InsertComposite = Rpc.make(CompositeInsertTag, {
  payload: Schema.Struct({
    name: Schema.String,
    description: Schema.NullOr(Schema.String),
    rootKey: Schema.String,
    treeData: Schema.Unknown,
    tags: Schema.optional(Schema.Unknown),
    metadata: Schema.optional(Schema.Unknown),
  }),
  success: CompositeSummary,
  error: Schema.Union(RpcGeniferQueryError, RpcGeniferValidationError),
})

export const ListComposites = Rpc.make(CompositeListTag, {
  payload: Schema.Struct({
    limit: Schema.optional(Schema.Number),
    offset: Schema.optional(Schema.Number),
  }),
  success: Schema.Array(CompositeSummary),
  error: RpcGeniferQueryError,
})

export const GeniferCompositeRpcs = RpcGroup.make(
  FindCompositeByName,
  InsertComposite,
  ListComposites,
)

// =============================================================================
// Signal RPCs
// =============================================================================

export const RecordSignal = Rpc.make(SignalRecordTag, {
  payload: Schema.Struct({
    treeId: Schema.String,
    signalType: Schema.Literal('pipeline', 'human', 'usage'),
    score: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
    metadata: Schema.optional(Schema.Unknown),
  }),
  success: Schema.Void,
  error: RpcGeniferQueryError,
})

export const GetSignalsForTree = Rpc.make(SignalGetForTreeTag, {
  payload: Schema.Struct({ treeId: Schema.String }),
  success: Schema.Array(Schema.Struct({
    id: Schema.String,
    treeId: Schema.String,
    signalType: Schema.String,
    score: Schema.Number,
    metadata: Schema.Unknown,
    createdAt: Schema.DateTimeUtc,
  })),
  error: RpcGeniferQueryError,
})

export const GeniferSignalRpcs = RpcGroup.make(
  RecordSignal,
  GetSignalsForTree,
)

// =============================================================================
// Combined Export
// =============================================================================

/**
 * All Genifer RPCs combined.
 *
 * Operations:
 *   Tree: GetById, FindByThread, FindByQuality, Insert, UpdateRating, IncrementUsage, Delete
 *   Element: FindByTree, FindByKey, InsertBatch, DeleteByTree
 *   Composite: FindByName, Insert, List
 *   Signal: Record, GetForTree
 */
export const GeniferRpcs = RpcGroup.make(
  ...Array.from(GeniferTreeRpcs.requests.values()),
  ...Array.from(GeniferElementRpcs.requests.values()),
  ...Array.from(GeniferCompositeRpcs.requests.values()),
  ...Array.from(GeniferSignalRpcs.requests.values()),
)

export type GeniferRpcs = typeof GeniferRpcs
