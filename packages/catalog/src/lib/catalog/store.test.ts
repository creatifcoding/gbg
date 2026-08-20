import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileSpecimen } from './intake'
import { SpecimenTransitionError } from './entity/specimen-entity'
import { CatalogStore } from './store.server'
import { copyOriginal, AssetExistsError } from './assets'
import { FIRST_SPECIMEN_FRAGMENT, FIRST_SPECIMEN_ID } from './seed'
import { UNKNOWN_LOCALITY } from './schemas/locality'

describe('CatalogStore', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function store(): CatalogStore {
    const dir = mkdtempSync(path.join(tmpdir(), 'catalog-'))
    const assets = mkdtempSync(path.join(tmpdir(), 'catalog-assets-'))
    dirs.push(dir, assets)
    return new CatalogStore(dir, assets)
  }

  function dump(
    catalog: CatalogStore,
    input: {
      kind: 'picture' | 'dossier' | 'artifact' | 'note'
      claim: string
      tags: readonly string[]
      questions: readonly string[]
      organismGuess?: { label: string; guess: true } | null
    },
  ) {
    return catalog.insertIntake(
      fileSpecimen({
        ...input,
        tags: [...input.tags],
        questions: [...input.questions],
        takenIds: catalog.takenSpecimenIds(),
      }),
    )
  }

  it('starts empty', () => {
    expect(store().list()).toEqual([])
  })

  it('inserts a specimen and reads it back', () => {
    const catalog = store()
    const view = dump(catalog, {
      kind: 'artifact',
      claim: 'This shark-skin sample, parked until denticles are named.',
      tags: ['denticle', 'drag', 'bench'],
      questions: ['Is this a denticle or a scale?'],
    })
    expect(catalog.get(view.id)?.claim).toBe(view.claim)
    expect(catalog.get(view.id)?.questions).toEqual([
      'Is this a denticle or a scale?',
    ])
    expect(catalog.get(view.id)?.observations).toHaveLength(1)
  })

  it('filters by kind, status, and tag slug', () => {
    const catalog = store()
    const picture = dump(catalog, {
      kind: 'picture',
      claim: 'This gecko toe under the scope.',
      tags: ['setae', 'gecko', 'live'],
      organismGuess: { label: 'Tokay gecko', guess: true },
      questions: [],
    })
    const note = dump(catalog, {
      kind: 'note',
      claim: 'Need to check the analog against the mechanism.',
      tags: ['analog', 'mechanism', 'lab'],
      questions: [],
    })
    catalog.update(note.id, { status: 'filed' })

    expect(catalog.list({ kind: 'picture' })).toHaveLength(1)
    expect(catalog.list({ status: 'filed' })[0]?.kind).toBe('note')
    expect(catalog.list({ tag: 'setae' })[0]?.id).toBe(picture.id)
  })

  it('stores an attachment blob on the intake observation', () => {
    const catalog = store()
    const specimen = dump(catalog, {
      kind: 'picture',
      claim: 'Dropped PNG of this lotus leaf.',
      tags: ['lotus', 'png', 'drop'],
      questions: [],
    })
    const bytes = new TextEncoder().encode('not-a-real-png')
    const next = catalog.attach({
      specimenId: specimen.id,
      filename: 'lotus.png',
      mimeType: 'image/png',
      bytes,
    })
    expect(next?.attachments).toHaveLength(1)
    expect(next?.attachments[0]?.host._tag).toBe('observation')
    const blob = catalog.readBlob(specimen.id, next?.attachments[0]?.id ?? '')
    expect(blob?.filename).toBe('lotus.png')
    expect(new TextDecoder().decode(blob?.bytes)).toBe('not-a-real-png')
  })

  it('rejects skipped status transitions', () => {
    const catalog = store()
    const specimen = dump(catalog, {
      kind: 'note',
      claim: 'Raw dump cannot jump to working.',
      tags: ['status', 'machine', 'test'],
      questions: [],
    })
    expect(() => catalog.update(specimen.id, { status: 'working' })).toThrow(
      SpecimenTransitionError,
    )
    expect(catalog.get(specimen.id)?.status).toBe('raw')
  })

  it('migrates a v1 catalog file into specimens', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'catalog-'))
    dirs.push(dir)
    writeFileSync(
      path.join(dir, 'catalog.json'),
      `${JSON.stringify({
        version: 1,
        cards: [
          {
            id: 'v1_gecko',
            kind: 'picture',
            status: 'raw',
            claim: 'Old gecko dump.',
            tags: ['adhesion', 'setae', 'example'],
            organism: { _tag: 'OrganismKnown', label: 'Tokay gecko' },
            questions: ['Setae or claws?'],
            notes: 'EXAMPLE CARD.',
            attachments: [],
            example: true,
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      })}\n`,
      'utf8',
    )

    const catalog = new CatalogStore(dir)
    const view = catalog.get('v1_gecko')
    expect(view?.body).toBe('EXAMPLE CARD.')
    expect(view?.organismGuess).toEqual({ label: 'Tokay gecko', guess: true })
    expect(view?.tags).toEqual(['adhesion', 'setae', 'example'])
    expect(view?.questions).toEqual(['Setae or claws?'])
    expect(view?.observations).toHaveLength(1)

    const raw = JSON.parse(
      readFileSync(path.join(dir, 'catalog.json'), 'utf8'),
    ) as { version: number; specimens?: unknown[] }
    expect(raw.version).toBe(4)
    expect(raw.specimens).toHaveLength(1)
    expect(view?.locality).toEqual(UNKNOWN_LOCALITY)
    expect(view?.cameraMake).toBeNull()
  })

  it('migrates a v3 locality string and fills camera fields', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'catalog-'))
    dirs.push(dir)
    writeFileSync(
      path.join(dir, 'catalog.json'),
      `${JSON.stringify({
        version: 3,
        specimens: [
          {
            _tag: 'Specimen',
            id: 'v3_note',
            kind: 'note',
            status: 'raw',
            claim: 'Old note with a typed locality.',
            body: '',
            organismGuess: null,
            structureGuess: null,
            locality: 'pond margin',
            observedAt: null,
            tagIds: [],
            questionIds: [],
            observationIds: [],
            attachmentIds: [],
            example: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        observations: [],
        analogs: [],
        organisms: [],
        structures: [],
        mechanisms: [],
        functions: [],
        attachments: [],
        tags: [],
        questions: [],
        edges: [],
        events: [],
      })}\n`,
      'utf8',
    )

    const catalog = new CatalogStore(dir)
    expect(catalog.get('v3_note')?.locality).toEqual({
      _tag: 'named',
      label: 'pond margin',
    })
    expect(catalog.get('v3_note')?.cameraMake).toBeNull()
    expect(catalog.get('v3_note')?.cameraModel).toBeNull()
  })

  it('copies a picture original, writes an exif sidecar, and files locality unknown when GPS is missing', async () => {
    const catalog = store()
    const bytes = jpegWithoutExif()
    const view = await catalog.ingestPicture({
      filename: 'cup.jpg',
      mimeType: 'image/jpeg',
      bytes,
      claim: 'Elongate arthropod in a paper cup.',
      tags: ['arthropod', 'cup', 'dump'],
      organismGuess: { label: 'elongate arthropod', guess: true },
      structureGuess: null,
      questions: [],
    })

    expect(view.status).toBe('raw')
    expect(view.locality).toEqual(UNKNOWN_LOCALITY)
    expect(view.observedAt).toBeNull()
    expect(view.cameraMake).toBeNull()
    expect(view.cameraModel).toBeNull()
    expect(view.attachments).toHaveLength(1)
    expect(view.observations).toHaveLength(1)
    expect(JSON.stringify(view.locality)).not.toMatch(/Tucson|city/i)

    const original = path.join(
      catalog.assetsDir,
      'specimens',
      view.id,
      'original.jpg',
    )
    const sidecarFile = path.join(
      catalog.assetsDir,
      'specimens',
      view.id,
      'exif.json',
    )
    expect(existsSync(original)).toBe(true)
    expect(readFileSync(original).equals(Buffer.from(bytes))).toBe(true)

    const sidecar = JSON.parse(readFileSync(sidecarFile, 'utf8')) as {
      stripped: boolean
      originalPresent: boolean
      tags: Record<string, unknown>
    }
    expect(sidecar.originalPresent).toBe(true)
    expect(sidecar.stripped).toBe(true)
    expect(sidecar.tags.GPSLatitude).toBeUndefined()

    expect(() =>
      copyOriginal({
        assetsDir: catalog.assetsDir,
        specimenId: view.id,
        filename: 'cup.jpg',
        mimeType: 'image/jpeg',
        bytes,
      }),
    ).toThrow(AssetExistsError)
  })

  it('files 20260819-001 as a real raw specimen with unknown locality', () => {
    const catalog = store()
    catalog.mergeFragment(FIRST_SPECIMEN_FRAGMENT)
    const view = catalog.get(FIRST_SPECIMEN_ID)
    expect(view?.example).toBe(false)
    expect(view?.status).toBe('raw')
    expect(view?.kind).toBe('picture')
    expect(view?.claim).toBe('Elongate arthropod in a Taco Bell cup.')
    expect(view?.locality).toEqual(UNKNOWN_LOCALITY)
    expect(view?.observedAt).toBeNull()
    expect(view?.cameraMake).toBeNull()
    expect(view?.cameraModel).toBeNull()
    expect(view?.observations).toHaveLength(1)
    expect(view?.attachments).toHaveLength(0)
  })
})

/** 1x1 JPEG with no EXIF. */
function jpegWithoutExif(): Uint8Array {
  return Uint8Array.from(
    Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AP/Z',
      'base64',
    ),
  )
}
