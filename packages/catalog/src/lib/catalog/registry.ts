import { VANTA_COLORS } from '~/components/portal/tokens'
import type { CardKind, CardStatus } from './schema'
import { CARD_KINDS, CARD_STATUSES } from './schema'

type CatalogIndicator = 'active' | 'pending' | 'inactive' | 'idle' | 'error'

/**
 * Closed vocabularies for catalog cards.
 * Status maps onto VANTA accents. Do not invent a second palette.
 */
export const STATUS_VISUAL = {
  raw: {
    accent: 'amber',
    indicator: 'pending',
    color: VANTA_COLORS.accent.amber,
    glow: VANTA_COLORS.accent.amberGlow,
  },
  filed: {
    accent: 'cyan',
    indicator: 'idle',
    color: VANTA_COLORS.accent.cyan,
    glow: VANTA_COLORS.accent.cyanGlow,
  },
  working: {
    accent: 'emerald',
    indicator: 'active',
    color: VANTA_COLORS.accent.emerald,
    glow: VANTA_COLORS.accent.emeraldGlow,
  },
  dead: {
    accent: 'rose',
    indicator: 'error',
    color: VANTA_COLORS.accent.rose,
    glow: VANTA_COLORS.accent.roseGlow,
  },
} as const satisfies Record<
  CardStatus,
  {
    accent: 'cyan' | 'emerald' | 'amber' | 'rose'
    indicator: CatalogIndicator
    color: string
    glow: string
  }
>

export const KIND_LABEL = {
  picture: 'picture',
  dossier: 'dossier',
  artifact: 'artifact',
  note: 'note',
} as const satisfies Record<CardKind, string>

export function statusVisual(status: CardStatus) {
  return STATUS_VISUAL[status]
}

export function isRegisteredKind(value: string): value is CardKind {
  return (CARD_KINDS as readonly string[]).includes(value)
}

export function isRegisteredStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as readonly string[]).includes(value)
}
