import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { Schema } from 'effect'
import {
  Attachment,
  CatalogCard,
  attachmentKindFromMime,
  type CatalogCard as CatalogCardType,
  type CatalogFilter,
  type CardId,
} from './schema'

export type CardPatch = {
  notes?: string
  status?: CatalogCardType['status']
  attachments?: CatalogCardType['attachments']
}

const CatalogFile = Schema.Struct({
  version: Schema.Literal(1),
  cards: Schema.Array(CatalogCard),
})
type CatalogFile = typeof CatalogFile.Type

const decodeCatalogFile = Schema.decodeUnknownSync(CatalogFile)

export type StoredAttachment = {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly mimeType: string
}

export class CatalogStore {
  readonly dataDir: string
  readonly blobsDir: string
  readonly catalogPath: string

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.blobsDir = path.join(dataDir, 'blobs')
    this.catalogPath = path.join(dataDir, 'catalog.json')
    mkdirSync(this.blobsDir, { recursive: true })
    if (!exists(this.catalogPath)) {
      this.writeFile({ version: 1, cards: [] })
    }
  }

  list(filter: CatalogFilter = {}): CatalogCardType[] {
    const cards = this.readFile().cards
    return cards.filter((card) => {
      if (filter.kind && card.kind !== filter.kind) return false
      if (filter.status && card.status !== filter.status) return false
      if (filter.tag && !card.tags.includes(filter.tag)) return false
      return true
    })
  }

  get(id: string): CatalogCardType | undefined {
    return this.readFile().cards.find((card) => card.id === id)
  }

  insert(card: CatalogCardType): CatalogCardType {
    const file = this.readFile()
    this.writeFile({
      version: 1,
      cards: [card, ...file.cards],
    })
    return card
  }

  update(id: string, patch: CardPatch): CatalogCardType | undefined {
    const file = this.readFile()
    const index = file.cards.findIndex((card) => card.id === id)
    if (index < 0) return undefined
    const current = file.cards[index]
    const next = Schema.decodeUnknownSync(CatalogCard)({
      ...current,
      ...patch,
      id: current.id,
      updatedAt: Date.now(),
    })
    const cards = file.cards.slice()
    cards[index] = next
    this.writeFile({ version: 1, cards })
    return next
  }

  attach(input: {
    cardId: string
    filename: string
    mimeType: string
    bytes: Uint8Array
  }): CatalogCardType | undefined {
    const card = this.get(input.cardId)
    if (!card) return undefined

    const attachment = Schema.decodeUnknownSync(Attachment)({
      id: nanoid(),
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      kind: attachmentKindFromMime(input.mimeType),
    })

    const dest = this.blobPath(card.id, attachment.id)
    mkdirSync(path.dirname(dest), { recursive: true })
    writeFileSync(dest, input.bytes)

    return this.update(card.id, {
      attachments: [...card.attachments, attachment],
    })
  }

  readBlob(cardId: string, attachmentId: string): StoredAttachment | undefined {
    const card = this.get(cardId)
    const attachment = card?.attachments.find((item) => item.id === attachmentId)
    if (!card || !attachment) return undefined
    const dest = this.blobPath(card.id, attachment.id)
    if (!exists(dest)) return undefined
    return {
      bytes: new Uint8Array(readFileSync(dest)),
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    }
  }

  replaceAll(cards: ReadonlyArray<CatalogCardType>): void {
    this.writeFile({ version: 1, cards: [...cards] })
  }

  reset(): void {
    rmSync(this.blobsDir, { recursive: true, force: true })
    mkdirSync(this.blobsDir, { recursive: true })
    this.writeFile({ version: 1, cards: [] })
  }

  private blobPath(cardId: CardId | string, attachmentId: string): string {
    return path.join(this.blobsDir, String(cardId), String(attachmentId))
  }

  private readFile(): CatalogFile {
    const raw = JSON.parse(readFileSync(this.catalogPath, 'utf8')) as unknown
    return decodeCatalogFile(raw)
  }

  private writeFile(file: CatalogFile): void {
    const tmp = `${this.catalogPath}.${process.pid}.tmp`
    writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
    renameSync(tmp, this.catalogPath)
  }
}

function exists(filePath: string): boolean {
  try {
    readFileSync(filePath)
    return true
  } catch {
    return false
  }
}

let defaultStore: CatalogStore | undefined

export function catalogDataDir(): string {
  return process.env.CATALOG_DATA_DIR ?? path.resolve(process.cwd(), '.data')
}

export function getCatalogStore(): CatalogStore {
  defaultStore ??= new CatalogStore(catalogDataDir())
  return defaultStore
}
