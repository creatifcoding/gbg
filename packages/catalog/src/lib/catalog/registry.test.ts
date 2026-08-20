import { describe, expect, it } from 'vitest'
import { ANALOG_STATUSES, CARD_STATUSES } from './schema'
import {
  ANALOG_STATUS_VISUAL,
  analogStatusVisual,
  STATUS_VISUAL,
  statusVisual,
} from './registry'

describe('STATUS_VISUAL', () => {
  it('covers every card status', () => {
    for (const status of CARD_STATUSES) {
      expect(STATUS_VISUAL[status]).toBeDefined()
      expect(statusVisual(status).accent).toBeTruthy()
    }
  })

  it('maps card statuses onto VANTA accents only', () => {
    const accents = CARD_STATUSES.map((status) => STATUS_VISUAL[status].accent)
    expect(new Set(accents)).toEqual(new Set(['amber', 'cyan', 'emerald', 'rose']))
  })
})

describe('ANALOG_STATUS_VISUAL', () => {
  it('covers every analog status', () => {
    for (const status of ANALOG_STATUSES) {
      expect(ANALOG_STATUS_VISUAL[status]).toBeDefined()
      expect(analogStatusVisual(status).accent).toBeTruthy()
    }
  })

  it('maps analog statuses onto VANTA accents only', () => {
    const accents = ANALOG_STATUSES.map(
      (status) => ANALOG_STATUS_VISUAL[status].accent,
    )
    expect(new Set(accents)).toEqual(
      new Set(['amber', 'emerald', 'violet', 'rose']),
    )
  })
})
