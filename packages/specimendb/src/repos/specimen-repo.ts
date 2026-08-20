import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'
import { DuckDbBinding } from '../duckdb/binding'
import { SQL } from '../duckdb/sql'
import {
  DuckDbError,
  SpecimenNotFound,
  SpecimenTransitionError as RpcTransitionError,
} from '../rpc/errors'
import { decodeStoredSpecimen, type Specimen, type SpecimenStatus } from '../schemas/specimen'
import type { SpecimenEvent } from '../schemas/events'
import { SpecimenId } from '../schemas/identifiers'
import { transitionSpecimen, SpecimenTransitionError } from '../entity/specimen'
import type { DuckDbRow } from '../duckdb/binding'

export type ComponentRecord = {
  name: string
  payload: unknown
}

export interface SpecimenRepoShape {
  readonly migrate: () => Effect.Effect<void, DuckDbError>
  readonly get: (
    id: SpecimenId | string,
  ) => Effect.Effect<Specimen | null, DuckDbError>
  readonly list: () => Effect.Effect<ReadonlyArray<Specimen>, DuckDbError>
  readonly takenIds: () => Effect.Effect<ReadonlyArray<string>, DuckDbError>
  readonly insert: (
    specimen: Specimen,
    events?: ReadonlyArray<SpecimenEvent>,
  ) => Effect.Effect<void, DuckDbError>
  readonly save: (
    specimen: Specimen,
    events?: ReadonlyArray<SpecimenEvent>,
  ) => Effect.Effect<void, DuckDbError>
  readonly promote: (
    id: SpecimenId | string,
    to: SpecimenStatus,
    now?: number,
  ) => Effect.Effect<
    Specimen,
    DuckDbError | SpecimenNotFound | RpcTransitionError
  >
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value)
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true'
}

export function componentsFromSpecimen(specimen: Specimen): ComponentRecord[] {
  const components: ComponentRecord[] = [
    { name: 'status', payload: specimen.status },
  ]
  if (specimen.claim) components.push({ name: 'claim', payload: specimen.claim })
  if (specimen.body !== undefined) {
    components.push({ name: 'body', payload: specimen.body })
  }
  if (specimen.organismGuess) {
    components.push({ name: 'taxon', payload: specimen.organismGuess })
  }
  if (specimen.structureGuess) {
    components.push({ name: 'structure', payload: specimen.structureGuess })
  }
  if (specimen.locality) {
    components.push({ name: 'locality', payload: specimen.locality })
  }
  if (specimen.observedAt) {
    components.push({ name: 'observedAt', payload: specimen.observedAt })
  }
  if (specimen.cameraMake || specimen.cameraModel) {
    components.push({
      name: 'exif',
      payload: {
        make: specimen.cameraMake ?? null,
        model: specimen.cameraModel ?? null,
      },
    })
  }
  if (specimen.tagIds) components.push({ name: 'tag', payload: specimen.tagIds })
  if (specimen.questionIds) {
    components.push({ name: 'question', payload: specimen.questionIds })
  }
  if (specimen.observationIds) {
    components.push({ name: 'observation', payload: specimen.observationIds })
  }
  if (specimen.attachmentIds) {
    components.push({
      name: 'media',
      payload: { attachmentIds: specimen.attachmentIds },
    })
  }
  return components
}

export function specimenFromRows(
  entity: DuckDbRow,
  componentRows: ReadonlyArray<DuckDbRow>,
): Specimen {
  const byName = new Map<string, unknown>()
  for (const row of componentRows) {
    const name = asString(row.name)
    const raw = row.payload
    try {
      byName.set(name, typeof raw === 'string' ? JSON.parse(raw) : raw)
    } catch {
      byName.set(name, raw)
    }
  }

  const exif = byName.get('exif') as
    | { make?: string | null; model?: string | null }
    | undefined
  const media = byName.get('media') as { attachmentIds?: string[] } | undefined

  return decodeStoredSpecimen({
    _tag: 'Specimen',
    id: asString(entity.id),
    kind: asString(entity.kind),
    status: (byName.get('status') as SpecimenStatus | undefined) ?? asString(entity.status),
    example: asBoolean(entity.example),
    createdAt: asNumber(entity.created_at),
    updatedAt: asNumber(entity.updated_at),
    claim: byName.get('claim'),
    body: byName.get('body'),
    organismGuess: byName.get('taxon'),
    structureGuess: byName.get('structure'),
    locality: byName.get('locality'),
    observedAt: byName.get('observedAt'),
    cameraMake: exif?.make ?? undefined,
    cameraModel: exif?.model ?? undefined,
    tagIds: byName.get('tag'),
    questionIds: byName.get('question'),
    observationIds: byName.get('observation'),
    attachmentIds: media?.attachmentIds,
  })
}

export class SpecimenRepo extends Context.Service<
  SpecimenRepo,
  SpecimenRepoShape
>()('@tmnl/specimendb/SpecimenRepo') {
  static readonly layer = Layer.effect(
    SpecimenRepo,
    Effect.gen(function* () {
      const db = yield* DuckDbBinding

      const migrate: SpecimenRepoShape['migrate'] = () =>
        Effect.gen(function* () {
          yield* db.exec(SQL.createSpecimens)
          yield* db.exec(SQL.createComponents)
          yield* db.exec(SQL.createEvents)
        })

      const load = (id: string) =>
        Effect.gen(function* () {
          const rows = yield* db.query(SQL.selectSpecimen, [id])
          const entity = rows[0]
          if (!entity) return null
          const components = yield* db.query(SQL.selectComponents, [id])
          return specimenFromRows(entity, components)
        })

      const get: SpecimenRepoShape['get'] = (id) => load(String(id))

      const list: SpecimenRepoShape['list'] = () =>
        Effect.gen(function* () {
          const entities = yield* db.query(SQL.selectSpecimens)
          const specimens: Specimen[] = []
          for (const entity of entities) {
            const components = yield* db.query(SQL.selectComponents, [
              asString(entity.id),
            ])
            specimens.push(specimenFromRows(entity, components))
          }
          return specimens
        })

      const takenIds: SpecimenRepoShape['takenIds'] = () =>
        db.query(SQL.selectIds).pipe(
          Effect.map((rows) => rows.map((row) => asString(row.id))),
        )

      const writeComponents = (specimen: Specimen) =>
        Effect.gen(function* () {
          yield* db.exec(SQL.deleteComponents, [specimen.id])
          for (const component of componentsFromSpecimen(specimen)) {
            yield* db.exec(SQL.insertComponent, [
              specimen.id,
              component.name,
              JSON.stringify(component.payload),
            ])
          }
        })

      const appendEvents = (events: ReadonlyArray<SpecimenEvent>) =>
        Effect.gen(function* () {
          for (const event of events) {
            yield* db.exec(SQL.insertEvent, [
              event.id,
              event.type,
              event.entityId,
              event.occurredAt,
              JSON.stringify(event.payload),
            ])
          }
        })

      const insert: SpecimenRepoShape['insert'] = (specimen, events = []) =>
        Effect.gen(function* () {
          yield* db.exec(SQL.insertSpecimen, [
            specimen.id,
            specimen.kind,
            specimen.status,
            specimen.example,
            specimen.createdAt,
            specimen.updatedAt,
          ])
          yield* writeComponents(specimen)
          yield* appendEvents(events)
        })

      const save: SpecimenRepoShape['save'] = (specimen, events = []) =>
        Effect.gen(function* () {
          yield* db.exec(SQL.updateSpecimen, [
            specimen.kind,
            specimen.status,
            specimen.example,
            specimen.createdAt,
            specimen.updatedAt,
            specimen.id,
          ])
          yield* writeComponents(specimen)
          yield* appendEvents(events)
        })

      const promote: SpecimenRepoShape['promote'] = (id, to, now = Date.now()) =>
        Effect.gen(function* () {
          const current = yield* load(String(id))
          if (!current) {
            return yield* Effect.fail(
              new SpecimenNotFound({
                specimenId: Schema.decodeUnknownSync(SpecimenId)(String(id)),
              }),
            )
          }
          try {
            const next = transitionSpecimen(current, to, now)
            yield* save(next.specimen, [next.event])
            return next.specimen
          } catch (error) {
            if (error instanceof SpecimenTransitionError) {
              return yield* Effect.fail(
                new RpcTransitionError({
                  specimenId: error.specimenId,
                  from: error.from,
                  to: error.to,
                }),
              )
            }
            throw error
          }
        })

      yield* migrate()

      return SpecimenRepo.of({
        migrate,
        get,
        list,
        takenIds,
        insert,
        save,
        promote,
      })
    }),
  )
}
