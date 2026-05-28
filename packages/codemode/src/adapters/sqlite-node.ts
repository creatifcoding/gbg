/**
 * @module sqlite-node
 *
 * Effect v4 SqlClient adapter for Node 24's built-in `node:sqlite` module.
 * Mirrors @effect/sql-sqlite-bun but targets DatabaseSync.
 *
 * Why:
 * - @effect/sql-sqlite-node uses better-sqlite3 → won't compile under Node 24
 * - Node 24 ships native `node:sqlite` with DatabaseSync (synchronous API)
 * - Same sync semantics → clean 1:1 adapter
 *
 * Known workaround: Reactivity.layer from the npm alias has a build issue.
 * We provide a no-op Reactivity implementation since RLM doesn't use
 * reactive SQL queries.
 */
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Context from "effect-v4/Context"
import * as Scope from "effect-v4/Scope"
import * as Semaphore from "effect-v4/Semaphore"
import * as Stream from "effect-v4/Stream"
import * as Fiber from "effect-v4/Fiber"
import { SqlClient, make as makeSqlClient } from "effect-v4/unstable/sql/SqlClient"
import { SqlError } from "effect-v4/unstable/sql/SqlError"
import * as Statement from "effect-v4/unstable/sql/Statement"
import { Reactivity } from "effect-v4/unstable/reactivity/Reactivity"

// ── Connection type (mirrors v4's SqlConnection) ─────────────────

type Connection = {
  execute: (sql: string, params: ReadonlyArray<unknown>, transformRows: any) => Effect.Effect<ReadonlyArray<any>, SqlError>
  executeRaw: (sql: string, params: ReadonlyArray<unknown>) => Effect.Effect<unknown, SqlError>
  executeValues: (sql: string, params: ReadonlyArray<unknown>) => Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError>
  executeUnprepared: (sql: string, params: ReadonlyArray<unknown>, transformRows: any) => Effect.Effect<ReadonlyArray<any>, SqlError>
  executeStream: (sql: string, params: ReadonlyArray<unknown>, transformRows: any) => Stream.Stream<any, SqlError>
}

// ── Config ───────────────────────────────────────────────────────

export interface SqliteNodeConfig {
  readonly filename: string
  readonly readonly?: boolean
  readonly disableWAL?: boolean
  readonly transformResultNames?: ((str: string) => string)
  readonly transformQueryNames?: ((str: string) => string)
}

// ── No-op Reactivity (Reactivity.layer has npm alias build issue) ─

const ReactivityNoop = Layer.effect(Reactivity)(
  Effect.sync(() =>
    Reactivity.of({
      invalidateUnsafe: () => {},
      registerUnsafe: () => () => {},
      invalidate: () => Effect.void,
      mutation: (_keys: any, effect: any) => effect,
      query: () => Effect.die("Reactivity not available in RLM store") as any,
      stream: () => { throw new Error("Reactivity not available in RLM store") },
      withBatch: (effect: any) => effect,
    })
  )
)

// ── Layer factory ────────────────────────────────────────────────

/**
 * Create a SqlClient layer backed by Node 24's `node:sqlite`.
 * Provides both the abstract `SqlClient` and concrete connection.
 */
export const layer = (config: SqliteNodeConfig): Layer.Layer<SqlClient> => {
  const makeClient = Effect.gen(function*() {
    const compiler = Statement.makeCompilerSqlite(config.transformQueryNames)
    const transformRows = config.transformResultNames
      ? Statement.defaultTransforms(config.transformResultNames).array
      : undefined

    // Import node:sqlite lazily so Bun can import this module without failing
    // during extension discovery. The layer still requires Node when executed.
    const { DatabaseSync } = yield* Effect.promise(() => import("node:sqlite"))
    const db = new DatabaseSync(config.filename, {
      readOnly: config.readonly ?? false,
    } as any)
    yield* Effect.addFinalizer(() => Effect.sync(() => db.close()))

    if (config.disableWAL !== true) {
      db.exec("PRAGMA journal_mode = WAL")
    }

    const run = (sql: string, params: ReadonlyArray<unknown> = []) =>
      Effect.try({
        try: () => {
          const stmt = db.prepare(sql)
          try {
            return stmt.all(...params) as Array<any>
          } catch {
            stmt.run(...params)
            return []
          }
        },
        catch: (cause: unknown) => new SqlError({ cause, message: "Failed to execute statement" }),
      })

    const connection: Connection = {
      execute(sql, params, transformRows) {
        return transformRows
          ? Effect.map(run(sql, params), transformRows)
          : run(sql, params)
      },
      executeRaw(sql, params) {
        return run(sql, params)
      },
      executeValues(sql, params) {
        return Effect.map(run(sql, params), (rows: any[]) =>
          rows.map((r: any) => Object.values(r))
        )
      },
      executeUnprepared(sql, params, transformRows) {
        return this.execute(sql, params ?? [], transformRows)
      },
      executeStream() {
        return Stream.die("executeStream not implemented for node:sqlite") as any
      },
    }

    const semaphore = yield* Semaphore.make(1)
    const acquirer = semaphore.withPermits(1)(Effect.succeed(connection))
    const transactionAcquirer = Effect.uninterruptibleMask((restore: any) => {
      const fiber = Fiber.getCurrent()!
      const scope = Context.getUnsafe(fiber.context, Scope.Scope)
      return Effect.as(
        Effect.tap(
          restore(semaphore.take(1)),
          () => Scope.addFinalizer(scope, semaphore.release(1))
        ),
        connection
      )
    })

    return yield* makeSqlClient({
      acquirer,
      compiler,
      transactionAcquirer,
      spanAttributes: [["db.system.name", "sqlite"]],
      transformRows,
    })
  })

  return Layer.effectContext(
    Effect.map(makeClient, (client: any) =>
      Context.make(SqlClient, client)
    )
  ).pipe(Layer.provide(ReactivityNoop))
}
