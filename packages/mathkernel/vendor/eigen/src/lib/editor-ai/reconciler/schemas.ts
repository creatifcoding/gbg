/**
 * Document Reconciler Schemas
 *
 * Effect.Schema definitions for document JSON structures.
 * These enable validation, transformation, and AI SDK integration.
 *
 * Key patterns:
 * - Schema.suspend for recursive structures (document tree)
 * - Schema.transform for PM Node ↔ JSON bidirectional conversion
 * - JSONSchema.make() for AI SDK compatibility
 *
 * @module editor-ai/reconciler/schemas
 */

import { Schema } from 'effect'
import { AIKnowledge } from '../decorators'

// =============================================================================
// Mark Schema
// =============================================================================

/**
 * JSON representation of a ProseMirror mark
 */
export const JSONMark = Schema.Struct({
  type: Schema.String.pipe(
    Schema.annotations({ description: 'Mark type name (bold, italic, link, etc.)' })
  ),
  attrs: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'Mark attributes' })
    )
  ),
})

export type JSONMark = typeof JSONMark.Type

// =============================================================================
// Node Schema (Recursive)
// =============================================================================

/**
 * JSON representation of a ProseMirror node.
 * Uses Schema.suspend for recursive content.
 */
export const JSONNode: Schema.Schema<JSONNodeType, JSONNodeType> = Schema.suspend(
  () =>
    Schema.Struct({
      type: Schema.String.pipe(
        Schema.annotations({
          description: 'Node type: paragraph, heading, text, mapBlock, scene3dBlock, etc.',
        })
      ),
      attrs: Schema.optional(
        Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
          Schema.annotations({ description: 'Node attributes (level for headings, etc.)' })
        )
      ),
      content: Schema.optional(
        Schema.Array(JSONNode).pipe(
          Schema.annotations({ description: 'Child nodes' })
        )
      ),
      text: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({ description: 'Text content (for text nodes only)' })
        )
      ),
      marks: Schema.optional(
        Schema.Array(JSONMark).pipe(
          Schema.annotations({ description: 'Marks on text (bold, italic, etc.)' })
        )
      ),
    })
)

export interface JSONNodeType {
  readonly type: string
  readonly attrs?: Record<string, unknown>
  readonly content?: readonly JSONNodeType[]
  readonly text?: string
  readonly marks?: readonly JSONMarkType[]
}

interface JSONMarkType {
  readonly type: string
  readonly attrs?: Record<string, unknown>
}

// =============================================================================
// Document Schema
// =============================================================================

/**
 * Full document structure.
 * Root node is always type 'doc'.
 */
export const JSONDocument = AIKnowledge({
  category: 'reconciler',
  description: 'Complete ProseMirror document JSON for AI generation',
  examples: [
    '{ "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }] }',
  ],
})(
  Schema.Struct({
    type: Schema.Literal('doc').pipe(
      Schema.annotations({ description: 'Root node type (always "doc")' })
    ),
    content: Schema.Array(JSONNode).pipe(
      Schema.annotations({ description: 'Top-level document blocks' })
    ),
  })
)

export type JSONDocument = typeof JSONDocument.Type

// =============================================================================
// Block Schemas (Tagged Structs for AI)
// =============================================================================

/**
 * Paragraph block
 */
export const ParagraphBlock = Schema.TaggedStruct('paragraph', {
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * Heading block
 */
export const HeadingBlock = Schema.TaggedStruct('heading', {
  attrs: Schema.Struct({
    level: Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(6),
      Schema.annotations({ description: 'Heading level 1-6' })
    ),
  }),
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * Code block
 */
export const CodeBlock = Schema.TaggedStruct('codeBlock', {
  attrs: Schema.optional(
    Schema.Struct({
      language: Schema.optional(Schema.String),
    })
  ),
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * Bullet list
 */
export const BulletList = Schema.TaggedStruct('bulletList', {
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * Ordered list
 */
export const OrderedList = Schema.TaggedStruct('orderedList', {
  attrs: Schema.optional(
    Schema.Struct({
      start: Schema.optional(Schema.Number.pipe(Schema.int())),
    })
  ),
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * List item
 */
export const ListItem = Schema.TaggedStruct('listItem', {
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * Blockquote
 */
export const Blockquote = Schema.TaggedStruct('blockquote', {
  content: Schema.optional(Schema.Array(JSONNode)),
})

/**
 * Horizontal rule
 */
export const HorizontalRule = Schema.TaggedStruct('horizontalRule', {})

// =============================================================================
// Custom Block Schemas (TMNL-specific)
// =============================================================================

/**
 * Map block - embedded maplibre visualization
 */
export const MapBlock = Schema.TaggedStruct('mapBlock', {
  attrs: Schema.Struct({
    viewState: Schema.optional(
      Schema.Struct({
        center: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number)),
        zoom: Schema.optional(Schema.Number),
        pitch: Schema.optional(Schema.Number),
        bearing: Schema.optional(Schema.Number),
      })
    ),
    markers: Schema.optional(
      Schema.Array(
        Schema.Struct({
          id: Schema.String,
          lngLat: Schema.Tuple(Schema.Number, Schema.Number),
          label: Schema.optional(Schema.String),
        })
      )
    ),
  }),
})

/**
 * 3D Scene block - Three.js visualization
 */
export const Scene3DBlock = Schema.TaggedStruct('scene3dBlock', {
  attrs: Schema.Struct({
    sceneConfig: Schema.optional(
      Schema.Struct({
        cameraPosition: Schema.optional(
          Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
        ),
        cameraTarget: Schema.optional(
          Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
        ),
      })
    ),
    objects: Schema.optional(
      Schema.Array(
        Schema.Struct({
          id: Schema.String,
          type: Schema.Literal('box', 'sphere', 'cylinder', 'plane'),
          position: Schema.optional(
            Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
          ),
          color: Schema.optional(Schema.String),
        })
      )
    ),
  }),
})

/**
 * Data grid block - AG-Grid instance
 */
export const DataGridBlock = Schema.TaggedStruct('dataGridBlock', {
  attrs: Schema.Struct({
    columnDefs: Schema.optional(
      Schema.Array(
        Schema.Struct({
          field: Schema.String,
          headerName: Schema.optional(Schema.String),
          width: Schema.optional(Schema.Number),
        })
      )
    ),
    rowData: Schema.optional(
      Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
    ),
  }),
})

// =============================================================================
// Union of All Block Types
// =============================================================================

/**
 * Union of all standard block types for AI generation
 */
export const StandardBlock = Schema.Union(
  ParagraphBlock,
  HeadingBlock,
  CodeBlock,
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  HorizontalRule
)

/**
 * Union of all custom block types
 */
export const CustomBlock = Schema.Union(
  MapBlock,
  Scene3DBlock,
  DataGridBlock
)

/**
 * Any block type
 */
export const AnyBlock = Schema.Union(StandardBlock, CustomBlock)

// =============================================================================
// AI SDK StandardSchema Integration
// =============================================================================

/**
 * StandardSchemaV1 wrapped exports for AI SDK 6.0 consumption.
 *
 * AI SDK 6.0 supports the standard-schema spec natively.
 * Effect.Schema implements StandardSchema, so we just wrap with StandardSchemaV1.
 *
 * Usage with AI SDK:
 * ```typescript
 * import { streamObject } from 'ai'
 * import { JSONDocumentStandard } from './schemas'
 *
 * const result = streamObject({
 *   model: yourModel,
 *   schema: JSONDocumentStandard,  // ← Drop-in replacement for Zod
 *   prompt: '...'
 * })
 * ```
 */

/**
 * Full document schema for AI SDK streamObject.
 * Use with streamObject({ schema: JSONDocumentStandard })
 */
export const JSONDocumentStandard = Schema.standardSchemaV1(JSONDocument)

/**
 * Array of blocks for streaming array of blocks.
 * Use with streamObject({ schema: BlockArrayStandard, output: 'array' })
 */
export const BlockArrayStandard = Schema.standardSchemaV1(Schema.Array(AnyBlock))

/**
 * Single block for elementStream mode.
 * Use with streamObject({ schema: SingleBlockStandard, output: 'object' })
 */
export const SingleBlockStandard = Schema.standardSchemaV1(AnyBlock)

/**
 * Standard blocks only (no custom TMNL blocks).
 * Useful for basic text editing without embedded visualizations.
 */
export const StandardBlockStandard = Schema.standardSchemaV1(StandardBlock)

/**
 * Custom TMNL blocks only.
 * Useful for AI generating visualization blocks specifically.
 */
export const CustomBlockStandard = Schema.standardSchemaV1(CustomBlock)

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Decode unknown value to JSONDocument
 */
export const decodeDocument = Schema.decodeUnknown(JSONDocument)

/**
 * Decode unknown value to JSONNode
 */
export const decodeNode = Schema.decodeUnknown(JSONNode)

/**
 * Encode JSONDocument to plain object (for serialization)
 */
export const encodeDocument = Schema.encode(JSONDocument)

/**
 * Type guard for checking if value is valid JSONDocument
 */
export const isValidDocument = Schema.is(JSONDocument)

/**
 * Type guard for checking if value is valid JSONNode
 */
export const isValidNode = Schema.is(JSONNode)
