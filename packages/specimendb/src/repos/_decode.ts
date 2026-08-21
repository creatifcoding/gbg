/**
 * Decode SQL rows through Schema. Shape mined from iiot `repos/_decode.ts`.
 *
 * @module @tmnl/specimendb/repos/_decode
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { CatalogError } from '../schemas/errors.js';

export const isoOf = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return new Date().toISOString();
};

export const parseJson = (raw: unknown): unknown => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

export const decodeRow =
  <S extends Schema.Top>(schema: S, operation: string) =>
  (row: unknown): Effect.Effect<S['Type'], CatalogError> =>
    Schema.decodeUnknownEffect(schema)(row).pipe(
      Effect.mapError(
        (cause) =>
          new CatalogError({
            operation,
            message: 'Failed to decode row',
            cause,
          }),
      ),
    ) as Effect.Effect<S['Type'], CatalogError>;

export const decodeRows =
  <S extends Schema.Top>(schema: S, operation: string) =>
  (rows: ReadonlyArray<unknown>): Effect.Effect<ReadonlyArray<S['Type']>, CatalogError> =>
    Effect.gen(function* () {
      const out: Array<S['Type']> = [];
      const decode = decodeRow(schema, operation);
      for (const row of rows) {
        out.push(yield* decode(row));
      }
      return out;
    });

export const decodeOptional =
  <S extends Schema.Top>(schema: S, operation: string) =>
  (rows: ReadonlyArray<unknown>): Effect.Effect<Option.Option<S['Type']>, CatalogError> =>
    rows[0] === undefined
      ? Effect.succeed(Option.none())
      : decodeRow(schema, operation)(rows[0]).pipe(Effect.map(Option.some));
