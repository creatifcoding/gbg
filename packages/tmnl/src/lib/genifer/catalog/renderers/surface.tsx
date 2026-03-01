/**
 * @fileoverview Core Surface Renderers — Card, Alert, Badge
 *
 * Card: bordered surface with gradient bg, hairline border, inset glow.
 * Alert: left border accent stripe, 4 intents.
 * Badge: pill with accent border + muted background, 5 intents.
 *
 * Zero Tailwind. All style via VANTA tokens.
 *
 * @module genifer/catalog/renderers/surface
 */

import React from 'react'
import type { ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal/tokens'
import { filterClassName } from '../className'
import { useSurface } from '../context'
import {
  DENSITY_CARD_PADDING, DENSITY_ALERT_PADDING, DENSITY_ALERT_SHOW_TITLE,
  DENSITY_BADGE_SIZE, DENSITY_BADGE_PADDING,
} from '../density'
import { CARD_VARIANTS, alertStyle, badgeStyle, GAP_SCALE } from '../tokens'
import { DEFAULT_POLICIES } from '../types'
import type { Intent, ExtendedIntent, SpacingToken } from '../types'

// =============================================================================
// Card
// =============================================================================

/**
 * Card renderer — bordered surface.
 *
 * Variants: default | elevated | compact | ghost
 * Title renders in cardTitle preset, description in cardSubtitle.
 */
export const CardRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const p = element.props ?? {}
  const variant = (p.variant as string) ?? 'default'
  const title = p.title as string | undefined
  const description = p.description as string | undefined
  const padding = p.padding as SpacingToken | undefined
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.surface)
  const { density } = useSurface()

  const base = CARD_VARIANTS[variant] ?? CARD_VARIANTS.default
  const style: React.CSSProperties = {
    ...base,
    padding: padding ? GAP_SCALE[padding] : DENSITY_CARD_PADDING[density],
  }

  const hasHeader = title || description

  return (
    <div style={style} className={filtered || undefined}>
      {hasHeader && (
        <div style={{ marginBottom: '12px' }}>
          {title && (
            <div style={{
              ...VANTA_TYPOGRAPHY.preset.cardTitle,
              color: VANTA_COLORS.text.primary,
            }}>
              {title}
            </div>
          )}
          {description && (
            <div style={{
              ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
              color: VANTA_COLORS.text.secondary,
              marginTop: '4px',
            }}>
              {description}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

CardRenderer.displayName = 'Card'

// =============================================================================
// Alert
// =============================================================================

/**
 * Alert renderer — left border accent stripe.
 *
 * 2px left border in accent color. Muted accent background.
 * Title in label preset with accent color.
 */
export const AlertRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const p = element.props ?? {}
  const intent = (p.intent as Intent) ?? 'info'
  const title = p.title as string | undefined
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.surface)
  const { density } = useSurface()

  const baseStyle = alertStyle(intent)
  const style: React.CSSProperties = {
    ...baseStyle,
    padding: DENSITY_ALERT_PADDING[density],
  }

  const showTitle = DENSITY_ALERT_SHOW_TITLE[density]

  // Title color matches intent accent
  const accentMap: Record<Intent, string> = {
    info: VANTA_COLORS.accent.cyan,
    success: VANTA_COLORS.accent.emerald,
    warning: VANTA_COLORS.accent.amber,
    danger: VANTA_COLORS.accent.rose,
  }

  return (
    <div style={style} className={filtered || undefined} role="alert">
      {showTitle && title && (
        <div style={{
          ...VANTA_TYPOGRAPHY.preset.label,
          color: accentMap[intent],
          marginBottom: '6px',
        }}>
          {title}
        </div>
      )}
      <div style={{
        fontFamily: VANTA_TYPOGRAPHY.family.mono,
        fontSize: VANTA_TYPOGRAPHY.size.base,
        color: VANTA_COLORS.text.secondary,
        lineHeight: VANTA_TYPOGRAPHY.leading.normal,
      }}>
        {element.content ?? children}
      </div>
    </div>
  )
}

AlertRenderer.displayName = 'Alert'

// =============================================================================
// Badge
// =============================================================================

/**
 * Badge renderer — pill with accent border.
 *
 * Intents: info | success | warning | danger | neutral
 * Sizes: sm | md
 */
export const BadgeRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const p = element.props ?? {}
  const intent = (p.intent as ExtendedIntent) ?? 'info'
  const { density } = useSurface()

  const baseStyle = badgeStyle(intent)
  const style: React.CSSProperties = {
    ...baseStyle,
    fontSize: DENSITY_BADGE_SIZE[density],
    padding: DENSITY_BADGE_PADDING[density],
  }

  return (
    <span style={style}>
      {element.content ?? children}
    </span>
  )
}

BadgeRenderer.displayName = 'Badge'
