/**
 * Subject Architecture — Error Definitions
 *
 * Namespace-scoped errors for subject registry operations.
 *
 * @module holonet/subject/errors
 */

import { Data } from 'effect';
import type { SubjectSpecId, SubjectSpec } from './schemas';

// =============================================================================
// SUBJECT REGISTRY ERRORS
// =============================================================================

export namespace Subject {
  /**
   * Thrown when attempting to register a spec with an ID that already exists.
   */
  export class AlreadyRegisteredError extends Data.TaggedError(
    'Subject/AlreadyRegistered'
  )<{
    readonly specId: SubjectSpecId;
    readonly existingSpec: SubjectSpec;
  }> {}

  /**
   * Thrown when a requested spec is not found in the registry.
   */
  export class NotFoundError extends Data.TaggedError('Subject/NotFound')<{
    readonly specId: SubjectSpecId;
  }> {}

  /**
   * Thrown when a new spec's pattern conflicts with an existing spec.
   */
  export class PatternConflictError extends Data.TaggedError(
    'Subject/PatternConflict'
  )<{
    readonly pattern: string;
    readonly conflictsWith: SubjectSpecId;
  }> {}

  /**
   * Thrown when a spec fails domain convention validation.
   */
  export class ValidationError extends Data.TaggedError('Subject/Validation')<{
    readonly message: string;
    readonly specId?: SubjectSpecId;
  }> {}

  /**
   * Thrown when a subject string doesn't match any registered spec.
   */
  export class NoMatchingSpecError extends Data.TaggedError(
    'Subject/NoMatchingSpec'
  )<{
    readonly subject: string;
  }> {}

  /**
   * Thrown when stream resolution fails for a spec.
   */
  export class StreamResolutionError extends Data.TaggedError(
    'Subject/StreamResolution'
  )<{
    readonly specId: SubjectSpecId;
    readonly message: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Thrown when convention validation fails for a domain.
   */
  export class ConventionError extends Data.TaggedError('Subject/Convention')<{
    readonly domain: string;
    readonly message: string;
    readonly specId?: SubjectSpecId;
  }> {}

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
