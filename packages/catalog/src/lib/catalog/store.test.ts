import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileCard } from './intake'
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

  it('inserts a card and reads it back', () => {
    const catalog = store()
    const card = fileCard({
      kind: 'artifact',
      claim: 'Kit insert parked until the lot is written down.',
      tags: ['kit', 'lot', 'bench'],
      organism: { _tag: 'OrganismUnknown' },
      questions: ['What lot arrived?'],
    })
    catalog.insert(card)
    expect(catalog.get(card.id)?.claim).toBe(card.claim)
  })

  it('filters by kind, status, and tag', () => {
    const catalog = store()
    const picture = fileCard({
      kind: 'picture',
      claim: 'Microscope still of a dish.',
      tags: ['scope', 'dish', 'live'],
      organism: { _tag: 'OrganismKnown', label: 'HEK293' },
      questions: [],
    })
    const note = fileCard({
      kind: 'note',
      claim: 'Need to check incubator setpoint.',
      tags: ['incubator', 'temp', 'lab'],
      organism: { _tag: 'OrganismUnknown' },
      questions: [],
    })
    catalog.insert(picture)
    catalog.insert(note)
    catalog.update(note.id, { status: 'working' })

    expect(catalog.list({ kind: 'picture' })).toHaveLength(1)
    expect(catalog.list({ status: 'working' })[0]?.kind).toBe('note')
    expect(catalog.list({ tag: 'scope' })[0]?.id).toBe(picture.id)
  })

  it('stores an attachment blob next to the card', () => {
    const catalog = store()
    const card = catalog.insert(
      fileCard({
        kind: 'picture',
        claim: 'Dropped PNG of a blot.',
        tags: ['blot', 'png', 'drop'],
        organism: { _tag: 'OrganismUnknown' },
        questions: [],
      }),
    )
    const bytes = new TextEncoder().encode('not-a-real-png')
    const next = catalog.attach({
      cardId: card.id,
      filename: 'blot.png',
      mimeType: 'image/png',
      bytes,
    })
    expect(next?.attachments).toHaveLength(1)
    const blob = catalog.readBlob(card.id, next?.attachments[0]?.id ?? '')
    expect(blob?.filename).toBe('blot.png')
    expect(new TextDecoder().decode(blob?.bytes)).toBe('not-a-real-png')
  })
})
