import { describe, expect, it } from 'vitest'
import { CARD_STATUSES } from './schema'
import { STATUS_VISUAL, statusVisual } from './registry'

describe('STATUS_VISUAL', () => {
  it('covers every card status', () => {
    for (const status of CARD_STATUSES) {
      expect(STATUS_VISUAL[status]).toBeDefined()
      expect(statusVisual(status).accent).toBeTruthy()
    }
  })

  it('maps statuses onto VANTA accents only', () => {
    const accents = CARD_STATUSES.map((status) => STATUS_VISUAL[status].accent)
    expect(new Set(accents)).toEqual(new Set(['amber', 'cyan', 'emerald', 'rose']))
  })
})
