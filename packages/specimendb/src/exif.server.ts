import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import exifr from 'exifr'
import { flattenExifTags, type ExifToolName } from './exif'

export type ReadExifResult = {
  tool: ExifToolName
  tags: Record<string, unknown>
}

function asTagRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        ([, item]) => item !== undefined,
      ),
    )
  }
  return {}
}

function readExiftoolJson(filePath: string): Record<string, unknown> | null {
  const bin = process.env.EXIFTOOL_PATH ?? 'exiftool'
  const result = spawnSync(bin, ['-j', '-n', '-a', filePath], {
    encoding: 'utf8',
  })
  if (result.status !== 0) return null
  try {
    const parsed: unknown = JSON.parse(result.stdout)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return flattenExifTags(asTagRecord(parsed[0]))
  } catch {
    return null
  }
}

async function readExifr(bytes: Uint8Array): Promise<Record<string, unknown>> {
  const parsed = await exifr.parse(bytes, {
    gps: true,
    mergeOutput: true,
    reviveValues: true,
    translateKeys: false,
    translateValues: false,
  })
  return asTagRecord(parsed)
}

export async function readExifTags(input: {
  bytes: Uint8Array
  filename?: string
}): Promise<ReadExifResult> {
  const dir = mkdtempSync(path.join(tmpdir(), 'specimendb-exif-'))
  const safeName = (input.filename ?? 'upload.bin').replaceAll(
    /[^a-zA-Z0-9._-]/g,
    '_',
  )
  const tmpPath = path.join(dir, safeName || 'upload.bin')
  try {
    writeFileSync(tmpPath, input.bytes)
    const fromTool = readExiftoolJson(tmpPath)
    if (fromTool) {
      return { tool: 'exiftool', tags: fromTool }
    }
    return { tool: 'exifr', tags: await readExifr(input.bytes) }
  } catch {
    return { tool: 'exifr', tags: {} }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
