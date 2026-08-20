import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import {
  decodeCatalogSnapshot,
  emptySnapshot,
  type CatalogSnapshot,
} from '../models/catalog-snapshot'
import {
  decodeV1CatalogFile,
  decodeV2CatalogFile,
  migrateV1,
  migrateV2,
  snapshotLooksLikeV1,
  snapshotLooksLikeV2,
} from '../models/migrate'

export class JsonCatalog {
  readonly dataDir: string
  readonly blobsDir: string
  readonly catalogPath: string

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.blobsDir = path.join(dataDir, 'blobs')
    this.catalogPath = path.join(dataDir, 'catalog.json')
    mkdirSync(this.blobsDir, { recursive: true })
    if (!fileExists(this.catalogPath)) {
      this.write(emptySnapshot())
    }
  }

  read(): CatalogSnapshot {
    const raw = JSON.parse(readFileSync(this.catalogPath, 'utf8')) as unknown
    if (snapshotLooksLikeV1(raw)) {
      const migrated = migrateV1(decodeV1CatalogFile(raw))
      this.write(migrated)
      return migrated
    }
    if (snapshotLooksLikeV2(raw)) {
      const migrated = migrateV2(decodeV2CatalogFile(raw))
      this.write(migrated)
      return migrated
    }
    return decodeCatalogSnapshot(raw)
  }

  write(snapshot: CatalogSnapshot): void {
    const tmp = `${this.catalogPath}.${process.pid}.tmp`
    writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
    renameSync(tmp, this.catalogPath)
  }

  mutate(fn: (snapshot: CatalogSnapshot) => CatalogSnapshot): CatalogSnapshot {
    const next = fn(this.read())
    this.write(next)
    return next
  }

  reset(): void {
    rmSync(this.blobsDir, { recursive: true, force: true })
    mkdirSync(this.blobsDir, { recursive: true })
    this.write(emptySnapshot())
  }

  blobPath(specimenId: string, attachmentId: string): string {
    return path.join(this.blobsDir, specimenId, attachmentId)
  }
}

export function fileExists(filePath: string): boolean {
  try {
    readFileSync(filePath)
    return true
  } catch {
    return false
  }
}

export function catalogDataDir(): string {
  return process.env.CATALOG_DATA_DIR ?? path.resolve(process.cwd(), '.data')
}
