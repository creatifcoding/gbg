/**
 * Subject Architecture — Error Definitions
 *
 * Namespace-scoped errors for subject registry operations.
 *
 * @module @tmnl/msh/subject/errors
 */

import * as Schema from 'effect-v4/Schema';
import type { SubjectSpecId, SubjectSpec } from './schemas';

// =============================================================================
// SUBJECT REGISTRY ERRORS
// =============================================================================

export namespace Subject {
  /**
   * Thrown when attempting to register a spec with an ID that already exists.
   */
  export class AlreadyRegisteredError extends Schema.TaggedErrorClass<AlreadyRegisteredError>(
    '@tmnl/msh/Subject.AlreadyRegisteredError',
  )('Subject/AlreadyRegistered', {
    specId: Schema.String.pipe(Schema.brand('SubjectSpecId')),
    // Note: SubjectSpec is a Schema.Class — can't embed directly in error schema.
    // Store as unknown and cast at use-site.
    existingSpec: Schema.Unknown,
  }) {}

  /**
   * Thrown when a requested spec is not found in the registry.
   */
  export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>(
    '@tmnl/msh/Subject.NotFoundError',
  )('Subject/NotFound', {
    specId: Schema.String.pipe(Schema.brand('SubjectSpecId')),
  }) {}

  /**
   * Thrown when a new spec's pattern conflicts with an existing spec.
   */
  export class PatternConflictError extends Schema.TaggedErrorClass<PatternConflictError>(
    '@tmnl/msh/Subject.PatternConflictError',
  )('Subject/PatternConflict', {
    pattern: Schema.String,
    conflictsWith: Schema.String.pipe(Schema.brand('SubjectSpecId')),
  }) {}

  /**
   * Thrown when a spec fails domain convention validation.
   */
  export class ValidationError extends Schema.TaggedErrorClass<ValidationError>(
    '@tmnl/msh/Subject.ValidationError',
  )('Subject/Validation', {
    message: Schema.String,
    specId: Schema.optional(Schema.String.pipe(Schema.brand('SubjectSpecId'))),
  }) {}

  /**
   * Thrown when a subject string doesn't match any registered spec.
   */
  export class NoMatchingSpecError extends Schema.TaggedErrorClass<NoMatchingSpecError>(
    '@tmnl/msh/Subject.NoMatchingSpecError',
  )('Subject/NoMatchingSpec', {
    subject: Schema.String,
  }) {}

  /**
   * Thrown when stream resolution fails for a spec.
   */
  export class StreamResolutionError extends Schema.TaggedErrorClass<StreamResolutionError>(
    '@tmnl/msh/Subject.StreamResolutionError',
  )('Subject/StreamResolution', {
    specId: Schema.String.pipe(Schema.brand('SubjectSpecId')),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Thrown when convention validation fails for a domain.
   */
  export class ConventionError extends Schema.TaggedErrorClass<ConventionError>(
    '@tmnl/msh/Subject.ConventionError',
  )('Subject/Convention', {
    domain: Schema.String,
    message: Schema.String,
    specId: Schema.optional(Schema.String.pipe(Schema.brand('SubjectSpecId'))),
  }) {}

  // ─── Union Types ──────────────────────────────────────────────────────────

  /** Registration-related errors */
  export type RegistrationError =
    | AlreadyRegisteredError
    | PatternConflictError
    | ValidationError
    | ConventionError;

  /** Lookup-related errors */
  export type LookupError = NotFoundError | NoMatchingSpecError;

  /** All subject registry errors */
  export type Error =
    | AlreadyRegisteredError
    | NotFoundError
    | PatternConflictError
    | ValidationError
    | NoMatchingSpecError
    | StreamResolutionError
    | ConventionError;
}
