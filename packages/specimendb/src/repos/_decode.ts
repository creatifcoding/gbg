/**
 * Decode SQL rows through Model schemas. CatalogError at the repo boundary.
 *
 * @module @tmnl/specimendb/repos/_decode
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { CatalogError } from '../schemas/errors.js';

const decodeFail = (operation: string) => (cause: unknown) =>
  new CatalogError({
    operation,
    message: 'Failed to decode stored row',
    cause,
  });

export const decodeRow =
  <S extends Schema.Constraint>(schema: S, operation: string) =>
  (row: unknown): Effect.Effect<S['Type'], CatalogError> =>
    Schema.decodeUnknownEffect(schema)(row).pipe(
      Effect.mapError(decodeFail(operation)),
    ) as Effect.Effect<S['Type'], CatalogError>;

export const decodeRows =
  <S extends Schema.Constraint>(schema: S, operation: string) =>
  (rows: ReadonlyArray<unknown>): Effect.Effect<ReadonlyArray<S['Type']>, CatalogError> =>
    Schema.decodeUnknownEffect(Schema.Array(schema))(rows).pipe(
      Effect.mapError(decodeFail(operation)),
    ) as Effect.Effect<ReadonlyArray<S['Type']>, CatalogError>;

export const decodeOptional =
  <S extends Schema.Constraint>(schema: S, operation: string) =>
  (rows: ReadonlyArray<unknown>): Effect.Effect<Option.Option<S['Type']>, CatalogError> =>
    rows[0] === undefined
      ? Effect.succeed(Option.none())
      : decodeRow(schema, operation)(rows[0]).pipe(Effect.map(Option.some));
