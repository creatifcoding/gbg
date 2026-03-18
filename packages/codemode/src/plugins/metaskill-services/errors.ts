/**
 * @module plugins/metaskill-services/errors
 *
 * Domain error types using Schema.TaggedErrorClass (v4).
 *
 * PlatformError from FileSystem is mapped to these at the service boundary.
 * Consumers see domain errors, never raw PlatformError.
 *
 * Pattern:
 *   FileSystem → PlatformError → mapError → SkillNotFound | FileReadError
 *   Consumer uses Effect.catchTag("SkillNotFound", ...) for precise handling.
 */

import * as Schema from "effect-v4/Schema"

// ── Domain Errors ────────────────────────────────────────────────

export class SkillNotFound extends Schema.TaggedErrorClass<SkillNotFound>()("SkillNotFound", {
  name: Schema.String,
}) {}

export class FileReadError extends Schema.TaggedErrorClass<FileReadError>()("FileReadError", {
  path: Schema.String,
  detail: Schema.optional(Schema.String),
}) {}

export class ParseError extends Schema.TaggedErrorClass<ParseError>()("ParseError", {
  file: Schema.String,
  detail: Schema.optional(Schema.String),
}) {}

export class ProtocolNotFound extends Schema.TaggedErrorClass<ProtocolNotFound>()("ProtocolNotFound", {
  key: Schema.String,
}) {}

export class UtilNotFound extends Schema.TaggedErrorClass<UtilNotFound>()("UtilNotFound", {
  name: Schema.String,
}) {}

export class ExecutionError extends Schema.TaggedErrorClass<ExecutionError>()("ExecutionError", {
  command: Schema.String,
  detail: Schema.optional(Schema.String),
}) {}

// ── Union ────────────────────────────────────────────────────────

// v4 Schema.Union takes array form
export const MetaskillError = Schema.Union([
  SkillNotFound,
  FileReadError,
  ParseError,
  ProtocolNotFound,
  UtilNotFound,
  ExecutionError,
])
export type MetaskillError = typeof MetaskillError.Type
