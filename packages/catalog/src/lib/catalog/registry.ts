import { VANTA_COLORS } from '~/components/portal/tokens'
import type { AnalogStatus, EvidenceKind, SpecimenStatus } from './schema'
import { ANALOG_STATUSES, EVIDENCE_KINDS, SPECIMEN_STATUSES } from './schema'

type CatalogIndicator = 'active' | 'pending' | 'inactive' | 'idle' | 'error'

type Visual = {
  accent: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet'
  indicator: CatalogIndicator
  color: string
  glow: string
}

/**
 * Closed vocabularies for specimens and analogs.
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
} as const satisfies Record<SpecimenStatus, Visual>

export const ANALOG_STATUS_VISUAL = {
  raw: {
    accent: 'amber',
    indicator: 'pending',
    color: VANTA_COLORS.accent.amber,
    glow: VANTA_COLORS.accent.amberGlow,
  },
  working: {
    accent: 'emerald',
    indicator: 'active',
    color: VANTA_COLORS.accent.emerald,
    glow: VANTA_COLORS.accent.emeraldGlow,
  },
  tested: {
    accent: 'violet',
    indicator: 'idle',
    color: VANTA_COLORS.accent.violet,
    glow: VANTA_COLORS.accent.violetGlow,
  },
  dead: {
    accent: 'rose',
    indicator: 'error',
    color: VANTA_COLORS.accent.rose,
    glow: VANTA_COLORS.accent.roseGlow,
  },
} as const satisfies Record<AnalogStatus, Visual>

export const KIND_LABEL = {
  picture: 'picture',
  dossier: 'dossier',
  artifact: 'artifact',
  note: 'note',
} as const satisfies Record<EvidenceKind, string>

export function statusVisual(status: SpecimenStatus) {
  return STATUS_VISUAL[status]
}

export function analogStatusVisual(status: AnalogStatus) {
  return ANALOG_STATUS_VISUAL[status]
}

export function isRegisteredKind(value: string): value is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(value)
}

export function isRegisteredStatus(value: string): value is SpecimenStatus {
  return (SPECIMEN_STATUSES as readonly string[]).includes(value)
}

export function isRegisteredAnalogStatus(
  value: string,
): value is AnalogStatus {
  return (ANALOG_STATUSES as readonly string[]).includes(value)
}
