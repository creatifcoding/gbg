/**
 * SQLite Schema Helpers
 *
 * Custom Schema transforms for SQLite compatibility.
 * See .edin/EFFECT_SQL_SQLITE_PATTERNS.md for rationale.
 *
 * @module editor/v3/persistence/sqlite-helpers
 */

import { Option, Schema } from 'effect';

// =============================================================================
// SQLite Boolean (0/1 → boolean)
// =============================================================================

/**
 * SQLite stores booleans as 0/1 integers.
 * This transform handles the bidirectional conversion.
 */
export const SqliteBoolean = Schema.transform(
  Schema.Union(Schema.Literal(0), Schema.Literal(1), Schema.Boolean),
  Schema.Boolean,
  {
    strict: true,
    decode: (encoded) => encoded === 1 || encoded === true,
    encode: (decoded) => (decoded ? 1 : 0),
  }
);

// =============================================================================
// Nullable JSON (null | string → Option<T>)
// =============================================================================

/**
 * SQLite stores JSON as TEXT (null or JSON string).
 * This transform handles the bidirectional conversion to Option<unknown>.
 *
 * Note: Uses Schema.OptionFromSelf, NOT Schema.Option.
 * - Schema.Option(A): Encoded = { _tag: "None" | "Some", value?: A }
 * - Schema.OptionFromSelf(A): Encoded = Option<A> directly
 */
export const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String), // DB: null | string
  Schema.OptionFromSelf(Schema.Unknown), // TS: Option<unknown>
  {
    strict: true,
    decode: (encoded) =>
      encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) =>
      Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
);

/**
 * Generic version for typed JSON.
 */
export const NullableJsonFromStringTyped = <T>(schema: Schema.Schema<T>) =>
  Schema.transform(
    Schema.NullOr(Schema.String),
    Schema.OptionFromSelf(schema),
    {
      strict: true,
      decode: (encoded) =>
        encoded === null
          ? Option.none()
          : Option.some(JSON.parse(encoded) as T),
      encode: (decoded) =>
        Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
    }
  );
