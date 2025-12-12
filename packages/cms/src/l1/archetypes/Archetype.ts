import { Schema } from 'effect';

/**
 * Schema for Hygraph model metadata.
 * This represents the metadata needed to create a model in Hygraph via Management SDK.
 * Note: This is NOT part of the content schema - it's model-level metadata.
 */
export const HyGraphModel = Schema.TaggedStruct("@gbg/cms/schemas/HyGraphModel", {
  apiId: Schema.optional(Schema.String),
  pluralApiId: Schema.optional(Schema.String),
  displayName: Schema.String,
  description: Schema.String,
});

/**
 * Type extracted from HyGraphModel schema.
 */
export type HyGraphModelType = Schema.Schema.Type<typeof HyGraphModel>;

/**
 * BaseArchetype - Foundation for all Hygraph archetypes.
 * 
 * Key principles:
 * - Empty struct {} - system fields (id, createdAt, etc.) are automatic in Hygraph
 * - Model metadata is stored as abstract static properties (per-model, not per-instance)
 * - Subclasses must provide model metadata via static properties
 * 
 * @example
 * ```typescript
 * class Post extends BaseArchetype {
 *   static readonly _apiId = "Post";
 *   static readonly _pluralApiId = "Posts";
 *   static readonly _displayName = "Post";
 *   static readonly _description = "A blog post";
 * }
 * ```
 */
export abstract class Archetype extends Schema.TaggedClass<Archetype>(
  '@gbg/cms/schemas/Archetype'
)('Archetype', {
  model: Schema.TaggedStruct("@gbg/cms/schemas/HyGraphModel", {
    apiId: Schema.optional(Schema.String),
    pluralApiId: Schema.optional(Schema.String),
    displayName: Schema.String,
    description: Schema.String,
  })

 }) {
  // Abstract static properties - subclasses must provide these
  /**
   * Get complete model metadata as HyGraphModelType.
   * Useful for Management SDK operations.
   */
  public static get modelMetadata() {
    return this.fields.model.fields
  }

  /**
   * Get the API ID (singular) for this model.
   */
  public static get modelApiId() {
    return this.fields.model.fields.apiId;
  }

  /**
   * Get the plural API ID for this model.
   */
  public static get modelPluralApiId() {
    return this.fields.model.fields.pluralApiId;
  }

  /**
   * Get the display name for this model.
   */
  public static get modelDisplayName() {
    return this.fields.model.fields.displayName;
  }

  /**
   * Get the description for this model.
   */
  public static get modelDescription() {
    return this.fields.model.fields.description;
  }
}
