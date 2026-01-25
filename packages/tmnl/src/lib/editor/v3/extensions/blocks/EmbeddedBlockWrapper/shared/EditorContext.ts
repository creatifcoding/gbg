/**
 * Editor Context for Document Scoping
 *
 * Provides the current document ID to the block registry system.
 * This enables per-document block namespaces.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/shared
 */

import { Context, Layer } from 'effect';
import type { DocumentId } from './schemas';

// =============================================================================
// Editor Context Tag
// =============================================================================

/**
 * Context tag providing the current document's ID.
 *
 * This is used to scope block registrations to a specific document.
 * Each document has its own isolated block namespace.
 *
 * @example
 * ```typescript
 * // Provide document context
 * const program = Effect.gen(function* () {
 *   const docId = yield* EditorContext;
 *   yield* Effect.log(`Operating in document: ${docId}`);
 * });
 *
 * Effect.provide(program, EditorContext.layer('doc-123' as DocumentId));
 * ```
 */
export class EditorContext extends Context.Tag('editor/EditorContext')<
  EditorContext,
  DocumentId
>() {
  /**
   * Create a layer providing a specific document ID.
   */
  static layer = (documentId: DocumentId) =>
    Layer.succeed(EditorContext, documentId);

  /**
   * Default layer for testing (uses placeholder ID).
   */
  static Test = Layer.succeed(
    EditorContext,
    'test-document' as unknown as DocumentId
  );
}
