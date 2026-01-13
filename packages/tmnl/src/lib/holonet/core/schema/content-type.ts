/**
 * Content-Type Parser
 *
 * Parse durable-streams Content-Type headers with schema parameters.
 *
 * Supports formats like:
 * - "application/json"
 * - "application/json; schema=BlockEvent"
 * - "application/json; schema=BlockEvent; version=1"
 *
 * @module holonet/core/schema/content-type
 */

import { Schema, Effect } from 'effect';
import { ContentTypeParseError } from './schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed Content-Type with optional schema parameter
 */
export interface ParsedContentType {
  /** MIME type (e.g., 'application/json') */
  readonly mimeType: string;
  /** Schema ID extracted from schema= parameter */
  readonly schemaId?: string | undefined;
  /** Schema version extracted from version= parameter */
  readonly version?: number | undefined;
  /** All other parameters as key-value pairs */
  readonly params: Record<string, string>;
}

// =============================================================================
// Schema for ParsedContentType
// =============================================================================

export const ParsedContentTypeSchema = Schema.Struct({
  mimeType: Schema.String,
  schemaId: Schema.optional(Schema.String),
  version: Schema.optional(Schema.Number),
  params: Schema.Record({ key: Schema.String, value: Schema.String }),
});

// =============================================================================
// Parser Implementation
// =============================================================================

/**
 * Parse a Content-Type string into its components.
 *
 * @param contentType - Raw Content-Type header value
 * @returns ParsedContentType with extracted schema info
 *
 * @example
 * ```typescript
 * parseContentType("application/json; schema=BlockEvent; version=1")
 * // => { mimeType: 'application/json', schemaId: 'BlockEvent', version: 1, params: {} }
 *
 * parseContentType("application/json")
 * // => { mimeType: 'application/json', schemaId: undefined, version: undefined, params: {} }
 * ```
 */
export const parseContentType = (contentType: string): ParsedContentType => {
  // Split by semicolon and trim whitespace
  const parts = contentType.split(';').map((p) => p.trim());

  // First part is always the MIME type
  const mimeType = parts[0] || 'application/octet-stream';

  // Parse remaining parts as parameters
  const params: Record<string, string> = {};
  let schemaId: string | undefined;
  let version: number | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const eqIndex = part.indexOf('=');

    if (eqIndex === -1) {
      // Parameter without value - store as empty string
      params[part] = '';
      continue;
    }

    const key = part.slice(0, eqIndex).trim().toLowerCase();
    // Remove surrounding quotes if present
    let value = part.slice(eqIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Extract known parameters
    if (key === 'schema') {
      schemaId = value;
    } else if (key === 'version') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        version = parsed;
      }
    } else {
      params[key] = value;
    }
  }

  return {
    mimeType,
    schemaId,
    version,
    params,
  };
};

/**
 * Parse Content-Type as an Effect, failing on empty input.
 */
export const parseContentTypeEffect = (
  contentType: string
): Effect.Effect<ParsedContentType, ContentTypeParseError> => {
  if (!contentType || contentType.trim() === '') {
    return Effect.fail(
      new ContentTypeParseError({
        contentType,
        reason: 'Content-Type cannot be empty',
      })
    );
  }

  return Effect.try({
    try: () => parseContentType(contentType),
    catch: (error) =>
      new ContentTypeParseError({
        contentType,
        reason: String(error),
      }),
  });
};

/**
 * Format a ParsedContentType back into a string.
 *
 * @param parsed - ParsedContentType to format
 * @returns Formatted Content-Type string
 *
 * @example
 * ```typescript
 * formatContentType({ mimeType: 'application/json', schemaId: 'BlockEvent', version: 1, params: {} })
 * // => "application/json; schema=BlockEvent; version=1"
 * ```
 */
export const formatContentType = (parsed: ParsedContentType): string => {
  const parts: string[] = [parsed.mimeType];

  if (parsed.schemaId) {
    parts.push(`schema=${parsed.schemaId}`);
  }

  if (parsed.version !== undefined) {
    parts.push(`version=${parsed.version}`);
  }

  // Add other params
  for (const [key, value] of Object.entries(parsed.params)) {
    parts.push(value ? `${key}=${value}` : key);
  }

  return parts.join('; ');
};

/**
 * Schema.transform for Content-Type parsing.
 *
 * Use this to parse Content-Type strings in Effect schemas.
 *
 * @example
 * ```typescript
 * const MySchema = Schema.Struct({
 *   contentType: ContentTypeFromString,
 * });
 * ```
 */
export const ContentTypeFromString = Schema.transform(
  Schema.String,
  ParsedContentTypeSchema,
  {
    strict: true,
    decode: parseContentType,
    encode: formatContentType,
  }
);

// =============================================================================
// Utilities
// =============================================================================

/**
 * Extract schema ID from a Content-Type string.
 * Returns undefined if no schema parameter is present.
 */
export const extractSchemaId = (contentType: string): string | undefined =>
  parseContentType(contentType).schemaId;

/**
 * Create a Content-Type string with schema parameter.
 */
export const createContentType = (
  mimeType: string,
  schemaId?: string,
  version?: number
): string =>
  formatContentType({
    mimeType,
    schemaId,
    version,
    params: {},
  });

/**
 * Check if a Content-Type indicates JSON.
 */
export const isJsonContentType = (contentType: string): boolean => {
  const parsed = parseContentType(contentType);
  return (
    parsed.mimeType === 'application/json' ||
    parsed.mimeType.endsWith('+json')
  );
};
