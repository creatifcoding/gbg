import { Schema } from 'effect'
import { SpecimenId } from './schemas/identifiers'

/** Filed specimen ids look like 20260819-001, not UUIDs. */
export const FILED_SPECIMEN_ID = /^(\d{8})-(\d{3})$/

export function dayStampFromDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function dayStampFromUnix(ms: number): string {
  return dayStampFromDate(new Date(ms))
}

/**
 * Parse EXIF DateTimeOriginal (`YYYY:MM:DD HH:MM:SS` or similar) into a UTC Date.
 * Camera clocks have no timezone. The date part is what files the id.
 */
export function dateFromExifDateTime(raw: string): Date | null {
  const match = raw
    .trim()
    .match(
      /^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
    )
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] ?? '0')
  const minute = Number(match[5] ?? '0')
  const second = Number(match[6] ?? '0')
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return Number.isNaN(date.getTime()) ? null : date
}

export function nextFiledSpecimenId(input: {
  day: string
  taken: Iterable<string>
}): SpecimenId {
  if (!/^\d{8}$/.test(input.day)) {
    throw new Error(`Bad day stamp: ${input.day}`)
  }
  const used = new Set<number>()
  const prefix = `${input.day}-`
  for (const id of input.taken) {
    if (!id.startsWith(prefix)) continue
    const seq = Number(id.slice(prefix.length))
    if (Number.isInteger(seq) && seq > 0) used.add(seq)
  }
  let seq = 1
  while (used.has(seq)) seq += 1
  if (seq > 999) {
    throw new Error(`No free sequence left for ${input.day}`)
  }
  return Schema.decodeUnknownSync(SpecimenId)(
    `${input.day}-${String(seq).padStart(3, '0')}`,
  )
}

export function isFiledSpecimenId(value: string): boolean {
  return FILED_SPECIMEN_ID.test(value)
}
