/**
 * @fileoverview Core Data Renderers — List, ListItem, Progress
 *
 * List: flex-column container with configurable gap and variants.
 * ListItem: grid layout with optional leading/trailing.
 * Progress: thin bar with intent-colored fill.
 *
 * Zero Tailwind. All style via VANTA tokens.
 *
 * @module genifer/catalog/renderers/data
 */

import React from 'react'
import type { ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import { VANTA_COLORS, VANTA_TYPOGRAPHY, VANTA_BORDERS } from '@/components/portal/tokens'
import { filterClassName } from '../className'
import { useSurface } from '../context'
import {
  DENSITY_LIST_GAP, DENSITY_LIST_PADDING,
  DENSITY_PROGRESS_SHOW_LABEL, DENSITY_PROGRESS_SHOW_PCT,
  DENSITY_TEXT_SIZE,
} from '../density'
import { GAP_SCALE, INTENT_ACCENT, PROGRESS_TRACK, progressFill } from '../tokens'
import { DEFAULT_POLICIES } from '../types'
import type { SpacingToken, Intent } from '../types'

// =============================================================================
// List
// =============================================================================

/**
 * List renderer — flex-column container.
 *
 * Variants:
 *   plain — no separators
 *   bordered — bottom hairline between items
 *   status — left accent dots
 */
export const ListRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const p = element.props ?? {}
  const variant = (p.variant as string) ?? 'plain'
  const gap = (p.gap as SpacingToken) ?? 'xs'
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.data)
  const { density } = useSurface()

  const effectiveGap = gap ? GAP_SCALE[gap] : DENSITY_LIST_GAP[density]

  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: variant === 'bordered' ? '0' : effectiveGap,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }

  // For bordered variant, inject hairline separators via CSS
  const childStyle: React.CSSProperties | undefined = variant === 'bordered'
    ? {
        borderBottom: VANTA_BORDERS.style.subtle,
        paddingBottom: GAP_SCALE[gap],
        marginBottom: GAP_SCALE[gap],
      }
    : undefined

  return (
    <div style={style} className={filtered || undefined} role="list">
      {childStyle
        ? React.Children.map(children, (child, i) => (
            <div style={i < React.Children.count(children) - 1 ? childStyle : { paddingBottom: GAP_SCALE[gap] }}>
              {child}
            </div>
          ))
        : children
      }
    </div>
  )
}

ListRenderer.displayName = 'List'

// =============================================================================
// ListItem
// =============================================================================

/**
 * ListItem renderer — grid layout with optional leading/trailing.
 *
 * leading: status dot, icon, badge (rendered as small accent dot for now)
 * trailing: timestamp, metadata (rendered as muted text)
 */
export const ListItemRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const p = element.props ?? {}
  const leading = p.leading as string | undefined
  const trailing = p.trailing as string | undefined
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.data)
  const { density } = useSurface()

  const hasSlots = leading || trailing

  const style: React.CSSProperties = {
    padding: DENSITY_LIST_PADDING[density],
    ...(hasSlots ? {
      display: 'grid',
      gridTemplateColumns: `${leading ? 'auto ' : ''}1fr${trailing ? ' auto' : ''}`,
      alignItems: 'center',
      gap: '8px',
    } : {}),
  }

  return (
    <div style={style} className={filtered || undefined} role="listitem">
      {leading && (
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: VANTA_COLORS.accent.cyan,
          flexShrink: 0,
        }} />
      )}
      <div style={{
        fontFamily: VANTA_TYPOGRAPHY.family.sans,
        fontSize: VANTA_TYPOGRAPHY.size.base,
        color: VANTA_COLORS.text.primary,
        lineHeight: VANTA_TYPOGRAPHY.leading.normal,
      }}>
        {element.content ?? children}
      </div>
      {trailing && (
        <span style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.muted,
        }}>
          {trailing}
        </span>
      )}
    </div>
  )
}

ListItemRenderer.displayName = 'ListItem'

// =============================================================================
// Progress
// =============================================================================

/**
 * Progress renderer — thin bar with intent-colored fill.
 *
 * 3px height track, accent-colored fill, 2px radius.
 * value: 0–100 as width%.
 */
export const ProgressRenderer: React.FC<ComponentRenderProps> = ({ element }) => {
  const p = element.props ?? {}
  const value = Math.max(0, Math.min(100, Number(p.value) || 0))
  const intent = (p.intent as Intent) ?? 'info'
  const label = p.label as string | undefined
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.data)
  const { density } = useSurface()

  const showLabel = DENSITY_PROGRESS_SHOW_LABEL[density] && label
  const showPct = DENSITY_PROGRESS_SHOW_PCT[density]

  return (
    <div className={filtered || undefined}>
      {(showLabel || showPct) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
          fontFamily: VANTA_TYPOGRAPHY.family.mono,
          fontSize: DENSITY_TEXT_SIZE[density],
          color: VANTA_COLORS.text.secondary,
        }}>
          {showLabel && <span>{label}</span>}
          {showPct && <span>{value}%</span>}
        </div>
      )}
      <div
        style={PROGRESS_TRACK}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={progressFill(value, intent)} />
      </div>
    </div>
  )
}

ProgressRenderer.displayName = 'Progress'
