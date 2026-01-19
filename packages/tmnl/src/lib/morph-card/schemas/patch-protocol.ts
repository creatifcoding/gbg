/**
 * MorphCard Agent Patch Protocol Schemas
 *
 * Defines the contract for agent-driven UI patching:
 * - JSON Patch operations (RFC 6902 compatible)
 * - MorphPatch for durable stream
 * - Agent request/response schemas
 * - Semantic region boundaries
 *
 * @module morph-card/schemas/patch-protocol
 */

import { Schema } from 'effect';

// =============================================================================
// JSON Patch (RFC 6902 compatible)
// =============================================================================

/** JSON Patch operation types */
export const JsonPatchOp = Schema.Literal('add', 'remove', 'replace', 'set');
export type JsonPatchOp = Schema.Schema.Type<typeof JsonPatchOp>;

/** JSON Patch operation */
export const JsonPatch = Schema.Struct({
  op: JsonPatchOp,
  path: Schema.String,
  value: Schema.optional(Schema.Unknown),
});
export type JsonPatch = Schema.Schema.Type<typeof JsonPatch>;

// =============================================================================
// MorphPatch - Tagged wrapper for durable stream
// =============================================================================

/** Source of the patch */
export const PatchSource = Schema.Literal('fix-agent', 'evolution-agent', 'user', 'system');
export type PatchSource = Schema.Schema.Type<typeof PatchSource>;

/** Metadata for MorphPatch */
export const MorphPatchMetadata = Schema.Struct({
  /** Which agent/source produced this patch */
  source: PatchSource,
  /** Original error path (for fix-agent patches) */
  errorPath: Schema.optional(Schema.String),
  /** Human-readable description of the change */
  description: Schema.optional(Schema.String),
  /** Timestamp when patch was created */
  createdAt: Schema.Number,
  /** Sequence number for ordering */
  seq: Schema.optional(Schema.Number),
});
export type MorphPatchMetadata = Schema.Schema.Type<typeof MorphPatchMetadata>;

/** MorphPatch - Tagged patch for durable stream transport */
export class MorphPatch extends Schema.TaggedClass<MorphPatch>()('MorphPatch', {
  cardId: Schema.String,
  /** JSON Patch operations to apply */
  patches: Schema.Array(JsonPatch),
  metadata: MorphPatchMetadata,
}) {}

// =============================================================================
// Agent Request/Response Contracts
// =============================================================================

/** Request to fix a decode error */
export class FixAgentRequest extends Schema.TaggedClass<FixAgentRequest>()('FixAgentRequest', {
  cardId: Schema.String,
  /** The ParseError message */
  errorMessage: Schema.String,
  /** Path that failed (e.g., /elements/chart-1) */
  errorPath: Schema.String,
  /** Current tree state (may be partial) */
  currentTree: Schema.Unknown,
  /** Original prompt for context */
  originalPrompt: Schema.String,
}) {}

/** Request to evolve/modify a card */
export class EvolutionAgentRequest extends Schema.TaggedClass<EvolutionAgentRequest>()('EvolutionAgentRequest', {
  cardId: Schema.String,
  userId: Schema.String,
  /** User's natural language request */
  userMessage: Schema.String,
  /** Current tree state */
  currentTree: Schema.Unknown,
  /** Semantic map for region targeting */
  semanticMap: Schema.optional(Schema.Unknown),
  /** Patch history from durable stream */
  patchHistory: Schema.optional(Schema.Array(MorphPatch)),
}) {}

// =============================================================================
// Semantic Boundaries
// =============================================================================

/** Semantic region types for categorization */
export const SemanticRegionType = Schema.Literal(
  'chart',
  'form',
  'list',
  'card',
  'navigation',
  'content',
  'interactive'
);
export type SemanticRegionType = Schema.Schema.Type<typeof SemanticRegionType>;

/** SemanticRegion props for agent-addressable regions */
export const SemanticRegionProps = Schema.Struct({
  /** Unique region ID for targeting */
  'data-semantic-id': Schema.String,
  /** Human-readable label */
  'data-semantic-label': Schema.String,
  /** Region type for categorization */
  'data-semantic-type': Schema.optional(SemanticRegionType),
  /** ARIA role for accessibility */
  role: Schema.optional(Schema.String),
  'aria-label': Schema.optional(Schema.String),
});
export type SemanticRegionProps = Schema.Schema.Type<typeof SemanticRegionProps>;

/** Semantic region returned by get_semantic_map tool */
export const SemanticRegion = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  type: Schema.optional(Schema.String),
  /** JSON path to this region in the tree */
  path: Schema.String,
  /** Child region IDs */
  children: Schema.Array(Schema.String),
});
export type SemanticRegion = Schema.Schema.Type<typeof SemanticRegion>;

/** Semantic map containing all discovered regions */
export const SemanticMap = Schema.Struct({
  regions: Schema.Array(SemanticRegion),
});
export type SemanticMap = Schema.Schema.Type<typeof SemanticMap>;

// =============================================================================
// Decoders
// =============================================================================

export const decodeJsonPatch = Schema.decodeUnknown(JsonPatch);
export const decodeJsonPatchSync = Schema.decodeUnknownSync(JsonPatch);
export const decodeMorphPatch = Schema.decodeUnknown(MorphPatch);
export const decodeMorphPatchSync = Schema.decodeUnknownSync(MorphPatch);
export const decodeFixAgentRequest = Schema.decodeUnknown(FixAgentRequest);
export const decodeEvolutionAgentRequest = Schema.decodeUnknown(EvolutionAgentRequest);
