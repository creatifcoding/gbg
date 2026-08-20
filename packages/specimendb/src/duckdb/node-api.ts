import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { DuckDbError } from '../rpc/errors'
import { DuckDbBinding, type DuckDbBindingShape, type DuckDbRow } from './binding'

type NodeConnection = {
  run: (sql: string, params?: unknown[]) => Promise<unknown>
  runAndReadAll: (
    sql: string,
    params?: unknown[],
  ) => Promise<{
    getRowObjectsJson?: () => DuckDbRow[]
    getRowObjects?: () => DuckDbRow[]
  }>
  closeSync?: () => void
  close?: () => Promise<void>
}

function rowsFromReader(reader: {
  getRowObjectsJson?: () => DuckDbRow[]
  getRowObjects?: () => DuckDbRow[]
}): DuckDbRow[] {
  if (typeof reader.getRowObjectsJson === 'function') {
    return reader.getRowObjectsJson()
  }
  if (typeof reader.getRowObjects === 'function') {
    return reader.getRowObjects()
  }
  return []
}

/**
 * `@duckdb/node-api` adapter. Optional. VAL can replace this file.
 */
export const makeNodeApiDuckDb = (connection: NodeConnection): DuckDbBindingShape => {
  const fail = (operation: string, cause: unknown) =>
    new DuckDbError({
      operation,
      message: cause instanceof Error ? cause.message : String(cause),
    })

  const query: DuckDbBindingShape['query'] = (sql, params = []) =>
    Effect.tryPromise({
      try: async () => {
        const reader = await connection.runAndReadAll(sql, [...params])
        return rowsFromReader(reader)
      },
      catch: (cause) => fail('query', cause),
    })

  const exec: DuckDbBindingShape['exec'] = (sql, params = []) =>
    Effect.tryPromise({
      try: async () => {
        await connection.run(sql, [...params])
      },
      catch: (cause) => fail('exec', cause),
    })

  const close: DuckDbBindingShape['close'] = () =>
    Effect.tryPromise({
      try: async () => {
        if (typeof connection.close === 'function') await connection.close()
        else if (typeof connection.closeSync === 'function') connection.closeSync()
      },
      catch: (cause) => fail('close', cause),
    })

  return DuckDbBinding.of({ query, exec, close })
}

export const tryOpenNodeApiDuckDb = (
  path = ':memory:',
): Effect.Effect<DuckDbBindingShape, DuckDbError> =>
  Effect.tryPromise({
    try: async () => {
      const mod = (await import('@duckdb/node-api')) as {
        DuckDBInstance: {
          create: (path?: string) => Promise<{ connect: () => Promise<NodeConnection> }>
        }
      }
      const instance = await mod.DuckDBInstance.create(path)
      const connection = await instance.connect()
      return makeNodeApiDuckDb(connection)
    },
    catch: (cause) =>
      new DuckDbError({
        operation: 'open',
        message: cause instanceof Error ? cause.message : String(cause),
      }),
  })

export const NodeApiDuckDbLayer = (path = ':memory:') =>
  Layer.effect(
    DuckDbBinding,
    tryOpenNodeApiDuckDb(path).pipe(
      Effect.map((impl) => DuckDbBinding.of(impl)),
    ),
  )
