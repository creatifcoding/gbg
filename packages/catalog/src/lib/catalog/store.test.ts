import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileSpecimen } from './intake'
import { SpecimenTransitionError } from './entity/specimen-entity'
import { CatalogStore } from './store.server'

describe('CatalogStore', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function store(): CatalogStore {
    const dir = mkdtempSync(path.join(tmpdir(), 'catalog-'))
    dirs.push(dir)
    return new CatalogStore(dir)
  }

  it('starts empty', () => {
    expect(store().list()).toEqual([])
  })

  it('inserts a specimen and reads it back', () => {
    const catalog = store()
    const filed = fileSpecimen({
      kind: 'artifact',
      claim: 'This shark-skin sample, parked until denticles are named.',
      tags: ['denticle', 'drag', 'bench'],
      questions: ['Is this a denticle or a scale?'],
    })
    const view = catalog.insertIntake(filed)
    expect(catalog.get(view.id)?.claim).toBe(filed.specimen.claim)
    expect(catalog.get(view.id)?.questions).toEqual([
      'Is this a denticle or a scale?',
    ])
    expect(catalog.get(view.id)?.observations).toHaveLength(1)
  })

  it('filters by kind, status, and tag slug', () => {
    const catalog = store()
    const picture = catalog.insertIntake(
      fileSpecimen({
        kind: 'picture',
        claim: 'This gecko toe under the scope.',
        tags: ['setae', 'gecko', 'live'],
        organismGuess: { label: 'Tokay gecko', guess: true },
        questions: [],
      }),
    )
    const note = catalog.insertIntake(
      fileSpecimen({
        kind: 'note',
        claim: 'Need to check the analog against the mechanism.',
        tags: ['analog', 'mechanism', 'lab'],
        questions: [],
      }),
    )
    catalog.update(note.id, { status: 'filed' })

    expect(catalog.list({ kind: 'picture' })).toHaveLength(1)
    expect(catalog.list({ status: 'filed' })[0]?.kind).toBe('note')
    expect(catalog.list({ tag: 'setae' })[0]?.id).toBe(picture.id)
  })

  it('stores an attachment blob on the intake observation', () => {
    const catalog = store()
    const specimen = catalog.insertIntake(
      fileSpecimen({
        kind: 'picture',
        claim: 'Dropped PNG of this lotus leaf.',
        tags: ['lotus', 'png', 'drop'],
        questions: [],
      }),
    )
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
    const specimen = catalog.insertIntake(
      fileSpecimen({
        kind: 'note',
        claim: 'Raw dump cannot jump to working.',
        tags: ['status', 'machine', 'test'],
        questions: [],
      }),
    )
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
    expect(raw.version).toBe(3)
    expect(raw.specimens).toHaveLength(1)
  })
})
