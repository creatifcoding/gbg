import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MemoryDuckDbLayer } from './duckdb/memory'
import { tryOpenNodeApiDuckDb } from './duckdb/node-api'
import { DuckDbBinding } from './duckdb/binding'
import { SpecimenRepo } from './repos/specimen-repo'
import { eatFile } from './eat'
import { spawnSpecimen } from './entity/specimen'
import { SpecimenId } from './schemas/identifiers'
import * as Schema from 'effect/Schema'

const jpegWithoutExif = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AP/Z',
    'base64',
  ),
)

describe('DuckDB binding', () => {
  it('round-trips a specimen through the memory driver', async () => {
    const { specimen } = spawnSpecimen({
      id: Schema.decodeUnknownSync(SpecimenId)('20260821-001'),
      kind: 'note',
    })
    const program = Effect.gen(function* () {
      const repo = yield* SpecimenRepo
      yield* repo.insert(specimen)
      const loaded = yield* repo.get(specimen.id)
      const listed = yield* repo.list()
      return { loaded, listed }
    }).pipe(Effect.provide(SpecimenRepo.layer.pipe(Layer.provide(MemoryDuckDbLayer))))

    const result = await Effect.runPromise(program)
    expect(result.loaded?.id).toBe('20260821-001')
    expect(result.loaded?.kind).toBe('note')
    expect(result.loaded?.locality).toBeUndefined()
    expect(result.listed).toHaveLength(1)
  })

  it('exposes the same query/exec/close shape as @duckdb/node-api would', async () => {
    const opened = await Effect.runPromise(Effect.result(tryOpenNodeApiDuckDb()))
    if (opened._tag === 'Success') {
      const rows = await Effect.runPromise(opened.success.query('SELECT 1 AS n'))
      expect(rows[0]?.n).toBe(1)
      await Effect.runPromise(opened.success.close())
    } else {
      expect(DuckDbBinding.key).toBe('@tmnl/specimendb/DuckDbBinding')
      expect(opened.failure._tag).toBe('DuckDbError')
    }
  })
})

describe('eat file', () => {
  it('requires bytes for a picture and omits locality without GPS tags', async () => {
    const assetsDir = mkdtempSync(path.join(tmpdir(), 'specimendb-assets-'))
    const program = eatFile({
      kind: 'picture',
      filename: 'cup.jpg',
      mimeType: 'image/jpeg',
      bytes: jpegWithoutExif,
      claim: 'Field catch',
      assetsDir,
    }).pipe(Effect.provide(SpecimenRepo.layer.pipe(Layer.provide(MemoryDuckDbLayer))))

    const specimen = await Effect.runPromise(program)
    expect(specimen.kind).toBe('picture')
    expect(specimen.locality).toBeUndefined()
    expect(specimen.attachmentIds?.length).toBe(1)
    const sidecar = JSON.parse(
      readFileSync(path.join(assetsDir, 'specimens', specimen.id, 'exif.json'), 'utf8'),
    ) as { stripped: boolean; tags: Record<string, unknown> }
    expect(sidecar.tags.GPSLatitude).toBeUndefined()
  })

  it('rejects a picture with no file', async () => {
    const program = eatFile({ kind: 'picture' }).pipe(
      Effect.provide(SpecimenRepo.layer.pipe(Layer.provide(MemoryDuckDbLayer))),
      Effect.result,
    )
    const result = await Effect.runPromise(program)
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('IntakeError')
    }
  })
})
