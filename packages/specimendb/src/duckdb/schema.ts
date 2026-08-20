import * as Effect from 'effect/Effect'
import { DuckDbBinding } from './binding'
import { SQL } from './sql'
import type { DuckDbError } from '../rpc/errors'

export const migrateDuckDb = (): Effect.Effect<void, DuckDbError, DuckDbBinding> =>
  Effect.gen(function* () {
    const db = yield* DuckDbBinding
    yield* db.exec(SQL.createSpecimens)
    yield* db.exec(SQL.createComponents)
    yield* db.exec(SQL.createEvents)
  })
