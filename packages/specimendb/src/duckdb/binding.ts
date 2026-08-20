import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { DuckDbError } from '../rpc/errors'

export type DuckDbRow = Record<string, unknown>

export interface DuckDbBindingShape {
  readonly query: (
    sql: string,
    params?: ReadonlyArray<unknown>,
  ) => Effect.Effect<ReadonlyArray<DuckDbRow>, DuckDbError>
  readonly exec: (
    sql: string,
    params?: ReadonlyArray<unknown>,
  ) => Effect.Effect<void, DuckDbError>
  readonly close: () => Effect.Effect<void, DuckDbError>
}

/**
 * Driver-agnostic DuckDB handle. VAL owns a real binding.
 * This package ships memory + optional `@duckdb/node-api`.
 */
export class DuckDbBinding extends Context.Service<
  DuckDbBinding,
  DuckDbBindingShape
>()('@tmnl/specimendb/DuckDbBinding') {
  static readonly layer = (impl: DuckDbBindingShape) =>
    Layer.succeed(DuckDbBinding, DuckDbBinding.of(impl))
}
