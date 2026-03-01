/**
 * @fileoverview Core Layout Renderers — Grid, Box, Separator
 *
 * Grid is the primary layout primitive: replaces VStack, HStack, and old Grid.
 * Box is a single-child wrapper for padding/overflow/position.
 * Separator is a hairline divider.
 *
 * Zero Tailwind. All style via VANTA tokens.
 *
 * @module genifer/catalog/renderers/layout
 */

import React from 'react'
import type { ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import { filterClassName } from '../className'
import { useSurface } from '../context'
import { clampColumns, DENSITY_GRID_GAP } from '../density'
import { GAP_SCALE, SEPARATOR_HORIZONTAL, SEPARATOR_VERTICAL } from '../tokens'
import { DEFAULT_POLICIES } from '../types'
import type { SpacingToken } from '../types'

// =============================================================================
// Grid
// =============================================================================

/**
 * Grid renderer — the primary layout primitive.
 *
 * Mental model for the LLM:
 *   "Stack vertically"   → Grid columns={1}
 *   "Stack horizontally" → Grid flow="column"
 *   "2×2 dashboard"      → Grid columns={2}
 *   "Sidebar + main"     → Grid columns="250px 1fr"
 */
export const GridRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const { columns, rows, gap, flow, areas, align, justify } = element.props ?? {}
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.layout)
  const { density } = useSurface()

  const style: React.CSSProperties = {
    display: 'grid',
    gap: gap ? GAP_SCALE[(gap as SpacingToken)] : DENSITY_GRID_GAP[density],
  }

  // Columns: number → clamp by density, string → raw template (no clamp)
  if (typeof columns === 'number') {
    const effectiveCols = clampColumns(columns, density)
    style.gridTemplateColumns = `repeat(${effectiveCols}, 1fr)`
  } else if (typeof columns === 'string') {
    // String templates (e.g. "250px 1fr") collapse to 1fr at compact
    style.gridTemplateColumns = density === 'compact' ? '1fr' : columns
  }

  // Rows: number → repeat(n, 1fr), string → raw template
  if (typeof rows === 'number') {
    style.gridTemplateRows = `repeat(${rows}, 1fr)`
  } else if (typeof rows === 'string') {
    style.gridTemplateRows = rows
  }

  if (flow) style.gridAutoFlow = flow as string
  if (areas) style.gridTemplateAreas = areas as string

  if (align) {
    style.alignItems = align as React.CSSProperties['alignItems']
  }
  if (justify) {
    style.justifyContent = justify === 'between'
      ? 'space-between'
      : justify as React.CSSProperties['justifyContent']
  }

  return <div style={style} className={filtered || undefined}>{children}</div>
}

GridRenderer.displayName = 'Grid'

// =============================================================================
// Box
// =============================================================================

/**
 * Box renderer — single-child wrapper for padding, overflow, positioning.
 */
export const BoxRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const { padding, overflow, position } = element.props ?? {}
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.layout)

  const style: React.CSSProperties = {}

  if (padding) {
    style.padding = GAP_SCALE[(padding as SpacingToken)] ?? undefined
  }
  if (overflow) {
    style.overflow = overflow as React.CSSProperties['overflow']
  }
  if (position) {
    style.position = position as React.CSSProperties['position']
  }

  return <div style={style} className={filtered || undefined}>{children}</div>
}

BoxRenderer.displayName = 'Box'

// =============================================================================
// Separator
// =============================================================================

/**
 * Separator renderer — barely visible hairline.
 */
export const SeparatorRenderer: React.FC<ComponentRenderProps> = ({ element }) => {
  const orientation = (element.props?.orientation as string) ?? 'horizontal'
  const style = orientation === 'vertical' ? SEPARATOR_VERTICAL : SEPARATOR_HORIZONTAL

  return <div style={style} role="separator" aria-orientation={orientation} />
}

SeparatorRenderer.displayName = 'Separator'
