import { describe, expect, it } from 'vitest'
import {
  dateFromExifDateTime,
  dayStampFromUnix,
  nextFiledSpecimenId,
} from './specimen-id'

describe('filed specimen ids', () => {
  it('stamps the UTC day as YYYYMMDD', () => {
    expect(dayStampFromUnix(Date.UTC(2026, 7, 19))).toBe('20260819')
  })

  it('parses DateTimeOriginal into a date for the id', () => {
    const date = dateFromExifDateTime('2026:08:19 18:04:11')
    expect(date?.toISOString().startsWith('2026-08-19')).toBe(true)
  })

  it('allocates the next free sequence and never reuses a taken id', () => {
    expect(
      nextFiledSpecimenId({
        day: '20260819',
        taken: ['20260819-001', 'ex_gecko_toe'],
      }),
    ).toBe('20260819-002')
  })
})
