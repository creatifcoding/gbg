/**
 * View Artifact Schemas
 *
 * Effect Schema definitions for AVA view artifacts including
 * render specs, trait specs, and pipeline specs.
 *
 * @module connection-ports/schemas/artifacts
 */

import { Schema } from 'effect';

// =============================================================================
// Branded Types
// =============================================================================

/**
 * View identifier.
 */
export const ViewId = Schema.String.pipe(
  Schema.brand('ViewId'),
  Schema.minLength(1)
);
export type ViewId = typeof ViewId.Type;

/**
 * Source identifier.
 */
export const SourceId = Schema.String.pipe(
  Schema.brand('SourceId'),
  Schema.minLength(1)
);
export type SourceId = typeof SourceId.Type;

/**
 * Entity identifier.
 */
export const EntityId = Schema.String.pipe(
  Schema.brand('EntityId'),
  Schema.minLength(1)
);
export type EntityId = typeof EntityId.Type;

/**
 * Trait identifier.
 */
export const TraitId = Schema.String.pipe(
  Schema.brand('TraitId'),
  Schema.minLength(1)
);
export type TraitId = typeof TraitId.Type;

// =============================================================================
// Render Spec
// =============================================================================

/**
 * Block type enumeration for rendering.
 */
export const BlockType = Schema.Literal(
  'map',
  '3d',
  'chart',
  'data-grid',
  'timeline',
  'graph',
  'custom'
);
export type BlockType = typeof BlockType.Type;

/**
 * Render specification for view output.
 * Defines how AVA artifacts should be rendered in the UI.
 */
export class RenderSpec extends Schema.TaggedClass<RenderSpec>()('RenderSpec', {
  /** Target block type */
  blockType: BlockType,

  /** Layout mode within the block */
  layout: Schema.optional(
    Schema.Literal('fill', 'fit', 'scroll', 'paginate')
  ),

  /** Visual theme variant */
  theme: Schema.optional(Schema.String),

  /** Custom renderer component name */
  customRenderer: Schema.optional(Schema.String),

  /** Additional render options */
  options: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
}) {
  static map(options?: Partial<RenderSpec>): RenderSpec {
    return new RenderSpec({ blockType: 'map', ...options });
  }

  static scene3d(options?: Partial<RenderSpec>): RenderSpec {
    return new RenderSpec({ blockType: '3d', ...options });
  }

  static dataGrid(options?: Partial<RenderSpec>): RenderSpec {
    return new RenderSpec({ blockType: 'data-grid', ...options });
  }

  static chart(options?: Partial<RenderSpec>): RenderSpec {
    return new RenderSpec({ blockType: 'chart', ...options });
  }
}

// =============================================================================
// Trait Spec
// =============================================================================

/**
 * Trait category for organization.
 */
export const TraitCategory = Schema.Literal(
  'spatial',
  'temporal',
  'visual',
  'behavioral',
  'data',
  'meta'
);
export type TraitCategory = typeof TraitCategory.Type;

/**
 * Individual trait definition.
 */
export class TraitDef extends Schema.TaggedClass<TraitDef>()('TraitDef', {
  /** Trait identifier */
  id: TraitId,

  /** Trait category */
  category: TraitCategory,

  /** Schema for trait data */
  schema: Schema.Unknown,

  /** Default value */
  defaultValue: Schema.optional(Schema.Unknown),

  /** Whether trait is required */
  required: Schema.optional(Schema.Boolean),
}) {}

/**
 * Trait specification for entity traits.
 * Defines what traits entities in a view should have.
 */
export class TraitSpec extends Schema.TaggedClass<TraitSpec>()('TraitSpec', {
  /** Required traits */
  required: Schema.Array(TraitDef),

  /** Optional traits */
  optional: Schema.optional(Schema.Array(TraitDef)),

  /** Trait inheritance from parent spec */
  extends: Schema.optional(Schema.String),
}) {
  allTraits(): readonly TraitDef[] {
    return [...this.required, ...(this.optional ?? [])];
  }

  hasTrait(traitId: string): boolean {
    return this.allTraits().some((t) => t.id === traitId);
  }
}

// =============================================================================
// Pipeline Spec
// =============================================================================

/**
 * Pipeline stage definition.
 */
export class PipelineStage extends Schema.TaggedClass<PipelineStage>()(
  'PipelineStage',
  {
    /** Stage name */
    name: Schema.String,

    /** Stage type */
    type: Schema.Literal(
      'source',
      'transform',
      'filter',
      'aggregate',
      'join',
      'output'
    ),

    /** Stage configuration */
    config: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    ),

    /** Input from previous stage(s) */
    inputs: Schema.optional(Schema.Array(Schema.String)),

    /** Whether stage can be parallelized */
    parallel: Schema.optional(Schema.Boolean),
  }
) {}

/**
 * Pipeline specification for data transformation.
 * Defines the data flow from sources to view output.
 */
export class PipelineSpec extends Schema.TaggedClass<PipelineSpec>()(
  'PipelineSpec',
  {
    /** Pipeline stages in execution order */
    stages: Schema.Array(PipelineStage),

    /** Source identifiers */
    sources: Schema.Array(SourceId),

    /** Output format */
    outputFormat: Schema.optional(
      Schema.Literal('json', 'arrow', 'parquet', 'msgpack')
    ),

    /** Caching strategy */
    caching: Schema.optional(
      Schema.Literal('none', 'memory', 'disk', 'distributed')
    ),

    /** Incremental update mode */
    incremental: Schema.optional(Schema.Boolean),
  }
) {
  stageCount(): number {
    return this.stages.length;
  }

  sourceCount(): number {
    return this.sources.length;
  }
}

// =============================================================================
// View Artifact
// =============================================================================

/**
 * View status enumeration.
 */
export const ViewStatus = Schema.Literal(
  'idle',
  'hydrating',
  'ready',
  'stale',
  'error'
);
export type ViewStatus = typeof ViewStatus.Type;

/**
 * Complete view artifact from AVA.
 * Combines data payload with render, trait, and pipeline specifications.
 */
export class ViewArtifact extends Schema.TaggedClass<ViewArtifact>()(
  'ViewArtifact',
  {
    /** View identifier */
    viewId: ViewId,

    /** View status */
    status: ViewStatus,

    /** Artifact version (monotonically increasing) */
    version: Schema.Number,

    /** Spec hash for cache invalidation */
    specHash: Schema.String,

    /** Data payload (Arrow/DataFusion result) */
    payload: Schema.Unknown,

    /** Render specification */
    renderSpec: RenderSpec,

    /** Trait specification */
    traitSpec: Schema.optional(TraitSpec),

    /** Pipeline specification */
    pipelineSpec: Schema.optional(PipelineSpec),

    /** Entity count in payload */
    entityCount: Schema.optional(Schema.Number),

    /** Hydrated timestamp */
    hydratedAt: Schema.DateFromSelf,

    /** Expiry timestamp (for stale detection) */
    expiresAt: Schema.optional(Schema.DateFromSelf),

    /** Metadata */
    metadata: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    ),
  }
) {
  isReady(): boolean {
    return this.status === 'ready';
  }

  isStale(): boolean {
    if (this.status === 'stale') return true;
    if (this.expiresAt && new Date() > this.expiresAt) return true;
    return false;
  }

  withStatus(status: ViewStatus): ViewArtifact {
    return new ViewArtifact({ ...this, status });
  }

  withPayload(payload: unknown, version: number): ViewArtifact {
    return new ViewArtifact({
      ...this,
      payload,
      version,
      status: 'ready',
      hydratedAt: new Date(),
    });
  }
}

// =============================================================================
// View Delta (Incremental Updates)
// =============================================================================

/**
 * Delta operation type.
 */
export const DeltaOperation = Schema.Literal('insert', 'update', 'delete');
export type DeltaOperation = typeof DeltaOperation.Type;

/**
 * Individual entity delta.
 */
export class EntityDelta extends Schema.TaggedClass<EntityDelta>()(
  'EntityDelta',
  {
    /** Entity identifier */
    entityId: EntityId,

    /** Operation type */
    operation: DeltaOperation,

    /** Entity data (for insert/update) */
    data: Schema.optional(Schema.Unknown),

    /** Changed fields (for update) */
    changedFields: Schema.optional(Schema.Array(Schema.String)),
  }
) {}

/**
 * View delta for incremental updates.
 * Contains changes since the last artifact version.
 */
export class ViewDelta extends Schema.TaggedClass<ViewDelta>()('ViewDelta', {
  /** View identifier */
  viewId: ViewId,

  /** Base version this delta applies to */
  baseVersion: Schema.Number,

  /** New version after applying delta */
  newVersion: Schema.Number,

  /** Entity deltas */
  deltas: Schema.Array(EntityDelta),

  /** Delta timestamp */
  timestamp: Schema.DateFromSelf,
}) {
  deltaCount(): number {
    return this.deltas.length;
  }

  insertCount(): number {
    return this.deltas.filter((d) => d.operation === 'insert').length;
  }

  updateCount(): number {
    return this.deltas.filter((d) => d.operation === 'update').length;
  }

  deleteCount(): number {
    return this.deltas.filter((d) => d.operation === 'delete').length;
  }
}
