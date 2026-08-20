import {
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExifSidecar } from './exif'

const packageRoot = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
)

export function defaultAssetsDir(): string {
  return process.env.SPECIMENDB_ASSETS_DIR ?? path.join(packageRoot, 'assets')
}

export function specimenAssetsDir(assetsDir: string, specimenId: string): string {
  return path.join(assetsDir, 'specimens', specimenId)
}

export function listedSpecimenAssetIds(assetsDir: string): string[] {
  const root = path.join(assetsDir, 'specimens')
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

const SAFE_EXT = /^\.[a-z0-9]{1,8}$/

export function extensionFor(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).toLowerCase()
  if (SAFE_EXT.test(fromName)) return fromName
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return '.heic'
  if (mimeType === 'image/tiff') return '.tif'
  if (mimeType === 'image/gif') return '.gif'
  return '.bin'
}

export class AssetExistsError extends Error {
  readonly _tag = 'AssetExistsError'
  constructor(readonly dest: string) {
    super(`Refusing to overwrite ${dest}`)
    this.name = 'AssetExistsError'
  }
}

export function originalPath(assetsDir: string, specimenId: string): string | undefined {
  const dir = specimenAssetsDir(assetsDir, specimenId)
  if (!existsSync(dir)) return undefined
  const found = readdirSync(dir).find((name) => name.startsWith('original.'))
  return found ? path.join(dir, found) : undefined
}

export function sidecarPath(assetsDir: string, specimenId: string): string {
  return path.join(specimenAssetsDir(assetsDir, specimenId), 'exif.json')
}

export function copyOriginal(input: {
  assetsDir: string
  specimenId: string
  filename: string
  mimeType: string
  bytes: Uint8Array
}): { originalPath: string; sidecarPath: string } {
  const dir = specimenAssetsDir(input.assetsDir, input.specimenId)
  const dest = path.join(
    dir,
    `original${extensionFor(input.filename, input.mimeType)}`,
  )
  const sidecar = sidecarPath(input.assetsDir, input.specimenId)
  if (existsSync(dest)) {
    throw new AssetExistsError(dest)
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(dest, input.bytes, { flag: 'wx' })
  return { originalPath: dest, sidecarPath: sidecar }
}

export function writeSidecar(dest: string, sidecar: ExifSidecar): void {
  if (existsSync(dest)) {
    throw new AssetExistsError(dest)
  }
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, `${JSON.stringify(sidecar, null, 2)}\n`, {
    flag: 'wx',
    encoding: 'utf8',
  })
}
