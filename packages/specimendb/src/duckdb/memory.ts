import * as Effect from 'effect/Effect'
import { DuckDbError } from '../rpc/errors'
import { DuckDbBinding, type DuckDbBindingShape, type DuckDbRow } from './binding'
import { SQL } from './sql'

type SpecimenRow = {
  id: string
  kind: string
  status: string
  example: boolean
  created_at: number
  updated_at: number
}

type ComponentRow = {
  specimen_id: string
  name: string
  payload: string
}

type EventRow = {
  id: string
  type: string
  entity_id: string
  occurred_at: number
  payload: string
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : String(value ?? fallback)
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true'
}

/**
 * In-memory stand-in for the DuckDB binding.
 * Understands only the SQL in `./sql.ts`. Swap for `@duckdb/node-api`.
 */
export const makeMemoryDuckDb = (): DuckDbBindingShape => {
  const specimens = new Map<string, SpecimenRow>()
  const components = new Map<string, ComponentRow>()
  const events = new Map<string, EventRow>()

  const fail = (operation: string, message: string) =>
    new DuckDbError({ operation, message })

  const query: DuckDbBindingShape['query'] = (sql, params = []) =>
    Effect.try({
      try: () => runQuery(sql, params),
      catch: (cause) =>
        fail('query', cause instanceof Error ? cause.message : String(cause)),
    })

  const exec: DuckDbBindingShape['exec'] = (sql, params = []) =>
    Effect.try({
      try: () => {
        runExec(sql, params)
      },
      catch: (cause) =>
        fail('exec', cause instanceof Error ? cause.message : String(cause)),
    })

  const close: DuckDbBindingShape['close'] = () => Effect.void

  function runQuery(sql: string, params: ReadonlyArray<unknown>): DuckDbRow[] {
    if (sql === SQL.selectSpecimen) {
      const row = specimens.get(asString(params[0]))
      return row ? [row] : []
    }
    if (sql === SQL.selectSpecimens) {
      return [...specimens.values()].sort((a, b) => {
        if (b.created_at !== a.created_at) return b.created_at - a.created_at
        return b.id.localeCompare(a.id)
      })
    }
    if (sql === SQL.selectComponents) {
      const specimenId = asString(params[0])
      return [...components.values()]
        .filter((row) => row.specimen_id === specimenId)
        .map((row) => ({ name: row.name, payload: row.payload }))
    }
    if (sql === SQL.selectIds) {
      return [...specimens.keys()].map((id) => ({ id }))
    }
    throw new Error(`memory duckdb: unsupported query: ${sql.trim()}`)
  }

  function runExec(sql: string, params: ReadonlyArray<unknown>): void {
    if (
      sql === SQL.createSpecimens ||
      sql === SQL.createComponents ||
      sql === SQL.createEvents
    ) {
      return
    }
    if (sql === SQL.insertSpecimen) {
      const id = asString(params[0])
      if (specimens.has(id)) {
        throw new Error(`specimen ${id} already exists`)
      }
      specimens.set(id, {
        id,
        kind: asString(params[1]),
        status: asString(params[2]),
        example: asBoolean(params[3]),
        created_at: asNumber(params[4]),
        updated_at: asNumber(params[5]),
      })
      return
    }
    if (sql === SQL.updateSpecimen) {
      const id = asString(params[5])
      const existing = specimens.get(id)
      if (!existing) throw new Error(`specimen ${id} missing`)
      specimens.set(id, {
        ...existing,
        kind: asString(params[0]),
        status: asString(params[1]),
        example: asBoolean(params[2]),
        created_at: asNumber(params[3]),
        updated_at: asNumber(params[4]),
      })
      return
    }
    if (sql === SQL.deleteComponents) {
      const specimenId = asString(params[0])
      for (const key of [...components.keys()]) {
        if (key.startsWith(`${specimenId}\0`)) components.delete(key)
      }
      return
    }
    if (sql === SQL.insertComponent) {
      const specimenId = asString(params[0])
      const name = asString(params[1])
      components.set(`${specimenId}\0${name}`, {
        specimen_id: specimenId,
        name,
        payload: asString(params[2]),
      })
      return
    }
    if (sql === SQL.insertEvent) {
      const id = asString(params[0])
      events.set(id, {
        id,
        type: asString(params[1]),
        entity_id: asString(params[2]),
        occurred_at: asNumber(params[3]),
        payload: asString(params[4]),
      })
      return
    }
    throw new Error(`memory duckdb: unsupported exec: ${sql.trim()}`)
  }

  return { query, exec, close }
}

export const MemoryDuckDbLayer = DuckDbBinding.layer(makeMemoryDuckDb())
