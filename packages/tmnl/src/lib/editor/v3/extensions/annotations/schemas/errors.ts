/**
 * Annotation System - Error Schemas
 *
 * Tagged errors for the annotation system.
 * All errors extend Schema.TaggedError for Effect integration.
 *
 * @module editor/v3/extensions/annotations/schemas/errors
 */

import { Option, Schema } from 'effect';
import { AnnotationId, DocumentId } from './primitives';

// =============================================================================
// Annotation Errors
// =============================================================================

/**
 * Annotation not found error
 */
export class AnnotationNotFound extends Schema.TaggedError<AnnotationNotFound>()(
  'AnnotationNotFound',
  {
    annotationId: AnnotationId,
    message: Schema.String,
  }
) {
  static of(annotationId: AnnotationId): AnnotationNotFound {
    return new AnnotationNotFound({
      annotationId,
      message: `Annotation not found: ${annotationId}`,
    });
  }
}

/**
 * Annotation node not found error
 */
export class AnnotationNodeNotFound extends Schema.TaggedError<AnnotationNodeNotFound>()(
  'AnnotationNodeNotFound',
  {
    annotationId: AnnotationId,
    message: Schema.String,
  }
) {
  static of(annotationId: AnnotationId): AnnotationNodeNotFound {
    return new AnnotationNodeNotFound({
      annotationId,
      message: `Annotation node not found: ${annotationId}`,
    });
  }
}

/**
 * Document not found error
 */
export class DocumentNotFound extends Schema.TaggedError<DocumentNotFound>()(
  'DocumentNotFound',
  {
    documentId: DocumentId,
    message: Schema.String,
  }
) {
  static of(documentId: DocumentId): DocumentNotFound {
    return new DocumentNotFound({
      documentId,
      message: `Document not found: ${documentId}`,
    });
  }
}

/**
 * Intent registry key not found error
 */
export class IntentNotRegistered extends Schema.TaggedError<IntentNotRegistered>()(
  'IntentNotRegistered',
  {
    registryKey: Schema.String,
    message: Schema.String,
  }
) {
  static of(registryKey: string): IntentNotRegistered {
    return new IntentNotRegistered({
      registryKey,
      message: `Intent program not registered: ${registryKey}`,
    });
  }
}

/**
 * Annotation persistence error
 */
export class AnnotationPersistenceError extends Schema.TaggedError<AnnotationPersistenceError>()(
  'AnnotationPersistenceError',
  {
    annotationId: Schema.optionalWith(AnnotationId, { as: 'Option' }),
    operation: Schema.Literal('save', 'load', 'delete', 'query'),
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {
  static save(
    annotationId: AnnotationId,
    cause: unknown
  ): AnnotationPersistenceError {
    return new AnnotationPersistenceError({
      annotationId: Option.some(annotationId),
      operation: 'save',
      cause,
      message: `Failed to save annotation ${annotationId}: ${cause}`,
    });
  }

  static load(
    annotationId: AnnotationId,
    cause: unknown
  ): AnnotationPersistenceError {
    return new AnnotationPersistenceError({
      annotationId: Option.some(annotationId),
      operation: 'load',
      cause,
      message: `Failed to load annotation ${annotationId}: ${cause}`,
    });
  }

  static delete(
    annotationId: AnnotationId,
    cause: unknown
  ): AnnotationPersistenceError {
    return new AnnotationPersistenceError({
      annotationId: Option.some(annotationId),
      operation: 'delete',
      cause,
      message: `Failed to delete annotation ${annotationId}: ${cause}`,
    });
  }

  static query(cause: unknown): AnnotationPersistenceError {
    return new AnnotationPersistenceError({
      annotationId: Option.none(),
      operation: 'query',
      cause,
      message: `Annotation query failed: ${cause}`,
    });
  }
}

/**
 * Intent execution error
 */
export class IntentExecutionError extends Schema.TaggedError<IntentExecutionError>()(
  'IntentExecutionError',
  {
    annotationId: AnnotationId,
    intentType: Schema.String,
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {
  static of(
    annotationId: AnnotationId,
    intentType: string,
    cause: unknown
  ): IntentExecutionError {
    return new IntentExecutionError({
      annotationId,
      intentType,
      cause,
      message: `Intent execution failed for ${annotationId} (${intentType}): ${cause}`,
    });
  }
}

/**
 * Invalid mark configuration error
 */
export class InvalidMarkConfig extends Schema.TaggedError<InvalidMarkConfig>()(
  'InvalidMarkConfig',
  {
    field: Schema.String,
    value: Schema.Unknown,
    message: Schema.String,
  }
) {
  static of(field: string, value: unknown, reason: string): InvalidMarkConfig {
    return new InvalidMarkConfig({
      field,
      value,
      message: `Invalid mark config for ${field}: ${reason}`,
    });
  }
}

// =============================================================================
// Error Union
// =============================================================================

/**
 * Union of all annotation errors
 */
export type AnnotationError =
  | AnnotationNotFound
  | AnnotationNodeNotFound
  | DocumentNotFound
  | IntentNotRegistered
  | AnnotationPersistenceError
  | IntentExecutionError
  | InvalidMarkConfig;
