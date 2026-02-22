/**
 * Genifer Harness Event Schemas
 *
 * Schema.TaggedClass event types for the genifer harness integration.
 * These flow alongside existing HarnessEvent variants on the event bus.
 *
 * Events:
 *   Generation lifecycle:  GenerateStart → StreamDelta* → GenerateComplete
 *   Refinement lifecycle:  RefineStart   → StreamDelta* → RefineComplete
 *   Quality signals:       QualityEvent
 *
 * All classes have methods for rich introspection (isPerfect, compositeScore, etc.)
 *
 * @module genifer/harness/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Shared Enums
// =============================================================================

/** Pipeline processing stage for a single element */
export const GeniferStreamStage = Schema.Literal(
  'identified',   // Tokenizer identified element boundaries
  'normalized',   // Normalizer processed element
  'repaired',     // Repair pass fixed element
)
export type GeniferStreamStage = typeof GeniferStreamStage.Type

/** Generation status */
export const GeniferGenerationStatus = Schema.Literal(
  'streaming',     // LLM is streaming, pipeline processing
  'normalizing',   // Stream complete, final normalization pass
  'persisting',    // Saving to database
  'complete',      // Done
  'error',         // Failed
)
export type GeniferGenerationStatus = typeof GeniferGenerationStatus.Type

// =============================================================================
// Generation Lifecycle Events
// =============================================================================

/**
 * Emitted when a genifer_generate tool call begins.
 */
export class GeniferGenerateStartEvent extends Schema.TaggedClass<GeniferGenerateStartEvent>()(
  'GeniferGenerateStartEvent',
  {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    surfaceId: Schema.String,
    prompt: Schema.String,
    threadId: Schema.NullOr(Schema.String),
    model: Schema.String,
    timestamp: Schema.Number,
  },
) {}

/**
 * Emitted per-element as the streaming pipeline identifies/normalizes/repairs.
 * Drives incremental preview rendering in the chat thread.
 */
export class GeniferStreamDeltaEvent extends Schema.TaggedClass<GeniferStreamDeltaEvent>()(
  'GeniferStreamDeltaEvent',
  {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    surfaceId: Schema.String,
    /** Element key that was processed */
    elementKey: Schema.String,
    /** Component type (e.g., 'Card', 'Heading', 'Grid') */
    elementType: Schema.String,
    /** Parent element key (null for root) */
    parentKey: Schema.NullOr(Schema.String),
    /** Depth in the tree (0 = root) */
    depth: Schema.Number,
    /** Which pipeline stage produced this delta */
    stage: GeniferStreamStage,
    /** Running element count */
    elementCount: Schema.Number,
    /** Serialized props snapshot (for preview rendering) */
    propsSnapshot: Schema.NullOr(Schema.Unknown),
    /** className if present */
    className: Schema.NullOr(Schema.String),
    timestamp: Schema.Number,
  },
) {
  /** Was this element repaired by the pipeline? */
  get isRepaired(): boolean {
    return this.stage === 'repaired'
  }

  /** Is this the root element? */
  get isRoot(): boolean {
    return this.parentKey === null
  }
}

/**
 * Emitted when generation completes (success or error).
 */
export class GeniferGenerateCompleteEvent extends Schema.TaggedClass<GeniferGenerateCompleteEvent>()(
  'GeniferGenerateCompleteEvent',
  {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    surfaceId: Schema.String,
    /** Database tree ID (null if not persisted) */
    treeId: Schema.NullOr(Schema.String),
    elementCount: Schema.Number,
    qualityScore: Schema.Number,
    repairCount: Schema.Number,
    durationMs: Schema.Number,
    model: Schema.String,
    threadId: Schema.NullOr(Schema.String),
    /** Error message if generation failed */
    error: Schema.NullOr(Schema.String),
    timestamp: Schema.Number,
  },
) {
  /** Generation succeeded with perfect quality and no repairs */
  get isPerfect(): boolean {
    return this.error === null && this.qualityScore >= 1.0 && this.repairCount === 0
  }

  /** Generation succeeded (with or without repairs) */
  get isSuccess(): boolean {
    return this.error === null
  }
}

// =============================================================================
// Refinement Lifecycle Events
// =============================================================================

/**
 * Emitted when a genifer_refine tool call begins.
 */
export class GeniferRefineStartEvent extends Schema.TaggedClass<GeniferRefineStartEvent>()(
  'GeniferRefineStartEvent',
  {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    surfaceId: Schema.String,
    /** Source tree being refined */
    sourceTreeId: Schema.String,
    /** Source surface being refined */
    sourceSurfaceId: Schema.String,
    instruction: Schema.String,
    model: Schema.String,
    timestamp: Schema.Number,
  },
) {}

/**
 * Emitted when refinement completes.
 */
export class GeniferRefineCompleteEvent extends Schema.TaggedClass<GeniferRefineCompleteEvent>()(
  'GeniferRefineCompleteEvent',
  {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    surfaceId: Schema.String,
    sourceTreeId: Schema.String,
    sourceSurfaceId: Schema.String,
    /** New tree ID (null if not persisted) */
    resultTreeId: Schema.NullOr(Schema.String),
    elementCount: Schema.Number,
    qualityScore: Schema.Number,
    repairCount: Schema.Number,
    durationMs: Schema.Number,
    /** Element diff: added, removed, modified counts */
    addedElements: Schema.Number,
    removedElements: Schema.Number,
    modifiedElements: Schema.Number,
    error: Schema.NullOr(Schema.String),
    timestamp: Schema.Number,
  },
) {
  get isSuccess(): boolean {
    return this.error === null
  }

  /** Total elements changed in refinement */
  get totalChanges(): number {
    return this.addedElements + this.removedElements + this.modifiedElements
  }
}

// =============================================================================
// Quality Signal Event
// =============================================================================

/**
 * Emitted when quality signals are recorded (pipeline score, human rating, usage).
 */
export class GeniferQualityEvent extends Schema.TaggedClass<GeniferQualityEvent>()(
  'GeniferQualityEvent',
  {
    seq: Schema.Number,
    sessionId: Schema.String,
    treeId: Schema.String,
    surfaceId: Schema.String,
    pipelineScore: Schema.Number,
    humanRating: Schema.NullOr(Schema.Number),
    usageCount: Schema.Number,
    timestamp: Schema.Number,
  },
) {
  /** Composite quality score (40% pipeline + 30% human + 30% usage) */
  get compositeScore(): number {
    const human = this.humanRating ?? (this.pipelineScore * 5)
    return 0.4 * this.pipelineScore + 0.3 * (human / 5) + 0.3 * Math.min(this.usageCount / 10, 1)
  }
}

// =============================================================================
// Union Type
// =============================================================================

/**
 * All genifer harness events.
 * Discriminated via _tag field (Schema.TaggedClass).
 */
export const GeniferEvent = Schema.Union(
  GeniferGenerateStartEvent,
  GeniferStreamDeltaEvent,
  GeniferGenerateCompleteEvent,
  GeniferRefineStartEvent,
  GeniferRefineCompleteEvent,
  GeniferQualityEvent,
)
export type GeniferEvent = typeof GeniferEvent.Type

// =============================================================================
// Type Guards
// =============================================================================

export const isGenerateStart = (e: GeniferEvent): e is GeniferGenerateStartEvent =>
  e._tag === 'GeniferGenerateStartEvent'
export const isStreamDelta = (e: GeniferEvent): e is GeniferStreamDeltaEvent =>
  e._tag === 'GeniferStreamDeltaEvent'
export const isGenerateComplete = (e: GeniferEvent): e is GeniferGenerateCompleteEvent =>
  e._tag === 'GeniferGenerateCompleteEvent'
export const isRefineStart = (e: GeniferEvent): e is GeniferRefineStartEvent =>
  e._tag === 'GeniferRefineStartEvent'
export const isRefineComplete = (e: GeniferEvent): e is GeniferRefineCompleteEvent =>
  e._tag === 'GeniferRefineCompleteEvent'
export const isQualityEvent = (e: GeniferEvent): e is GeniferQualityEvent =>
  e._tag === 'GeniferQualityEvent'
