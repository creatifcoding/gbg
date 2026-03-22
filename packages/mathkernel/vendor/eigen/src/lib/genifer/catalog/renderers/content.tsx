/**
 * @fileoverview Core Content Renderers — Text, Heading, Code, Image
 *
 * Text is the most important content primitive: 13 props, preset system,
 * full typographic hierarchy composition via override cascade.
 *
 * Zero Tailwind. All style via VANTA tokens.
 *
 * @module genifer/catalog/renderers/content
 */

import React from 'react'
import type { ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens'
import { filterClassName } from '../className'
import { useSurface } from '../context'
import { DENSITY_TEXT_SIZE, DENSITY_HEADING_SIZE, DENSITY_CODE_SIZE } from '../density'
import { TEXT_PRESETS, HEADING_LEVELS, CODE_BLOCK, CODE_INLINE } from '../tokens'
import { DEFAULT_POLICIES } from '../types'

// =============================================================================
// Text
// =============================================================================

/**
 * Text renderer — arbitrary typographic hierarchy composition.
 *
 * Resolution order:
 *   preset → color → accent → weight → size → family →
 *   tracking → leading → transform → align → truncation
 *
 * NDJSON examples:
 *   {"type":"Text","content":"Hello"}                          → body preset
 *   {"type":"Text","props":{"preset":"label"},"content":"ID"}  → mono uppercase tracked
 *   {"type":"Text","props":{"accent":"cyan","size":"2xl"}}     → large cyan data
 */
export const TextRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const p = element.props ?? {}
  const preset = (p.preset as string) ?? 'body'
  const base = TEXT_PRESETS[preset] ?? TEXT_PRESETS.body
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.content)
  const { density } = useSurface()

  const style: React.CSSProperties = { ...base }
  // Density-aware base font size (overridden below if explicit size prop)
  if (preset === 'body' || preset === 'caption') {
    style.fontSize = DENSITY_TEXT_SIZE[density]
  }

  // Color hierarchy
  const color = p.color as string | undefined
  if (color && color in VANTA_COLORS.text) {
    style.color = VANTA_COLORS.text[color as keyof typeof VANTA_COLORS.text]
  }

  // Accent override (takes precedence over color)
  const accent = p.accent as string | undefined
  if (accent) {
    const accentMap: Record<string, string> = {
      cyan: VANTA_COLORS.accent.cyan,
      emerald: VANTA_COLORS.accent.emerald,
      amber: VANTA_COLORS.accent.amber,
      rose: VANTA_COLORS.accent.rose,
      violet: VANTA_COLORS.accent.violet,
    }
    if (accent in accentMap) style.color = accentMap[accent]
  }

  // Weight override
  const weight = p.weight as string | undefined
  if (weight && weight in VANTA_TYPOGRAPHY.weight) {
    style.fontWeight = VANTA_TYPOGRAPHY.weight[weight as keyof typeof VANTA_TYPOGRAPHY.weight]
  }

  // Size override
  const size = p.size as string | undefined
  if (size && size in VANTA_TYPOGRAPHY.size) {
    style.fontSize = VANTA_TYPOGRAPHY.size[size as keyof typeof VANTA_TYPOGRAPHY.size]
  }

  // Family override
  const family = p.family as string | undefined
  if (family && family in VANTA_TYPOGRAPHY.family) {
    style.fontFamily = VANTA_TYPOGRAPHY.family[family as keyof typeof VANTA_TYPOGRAPHY.family]
  }

  // Tracking override
  const tracking = p.tracking as string | undefined
  if (tracking && tracking in VANTA_TYPOGRAPHY.tracking) {
    style.letterSpacing = VANTA_TYPOGRAPHY.tracking[tracking as keyof typeof VANTA_TYPOGRAPHY.tracking]
  }

  // Leading override
  const leading = p.leading as string | undefined
  if (leading && leading in VANTA_TYPOGRAPHY.leading) {
    style.lineHeight = VANTA_TYPOGRAPHY.leading[leading as keyof typeof VANTA_TYPOGRAPHY.leading]
  }

  // Transform
  const transform = p.transform as string | undefined
  if (transform) style.textTransform = transform as React.CSSProperties['textTransform']

  // Align
  const align = p.align as string | undefined
  if (align) style.textAlign = align as React.CSSProperties['textAlign']

  // Truncation
  if (p.truncate) {
    style.overflow = 'hidden'
    style.textOverflow = 'ellipsis'
    style.whiteSpace = 'nowrap'
  }

  // Max lines clamp
  const maxLines = p.maxLines as number | undefined
  if (maxLines && maxLines > 0) {
    style.display = '-webkit-box'
    style.WebkitLineClamp = maxLines
    style.WebkitBoxOrient = 'vertical' as any
    style.overflow = 'hidden'
  }

  // Render tag
  const Tag = (p.as as keyof React.JSX.IntrinsicElements) ?? 'div'

  return (
    <Tag style={style} className={filtered || undefined}>
      {element.content ?? children}
    </Tag>
  )
}

TextRenderer.displayName = 'Text'

// =============================================================================
// Heading
// =============================================================================

/**
 * Heading renderer — 3 levels.
 *   Level 1: Space Grotesk 18px semibold tight
 *   Level 2: Space Grotesk 14px medium
 *   Level 3: Share Tech Mono 12px uppercase 0.1em (label preset)
 */
export const HeadingRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const level = Math.max(1, Math.min(3, Number(element.props?.level) || 1)) as 1 | 2 | 3
  const baseStyle = HEADING_LEVELS[level] ?? HEADING_LEVELS[1]
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.content)
  const { density } = useSurface()

  // Density-aware font size
  const style: React.CSSProperties = {
    ...baseStyle,
    fontSize: DENSITY_HEADING_SIZE[density][level],
  }

  // Map level to semantic heading tag
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements

  return (
    <Tag style={style} className={filtered || undefined}>
      {element.content ?? children}
    </Tag>
  )
}

HeadingRenderer.displayName = 'Heading'

// =============================================================================
// Code
// =============================================================================

/**
 * Code renderer — inline or block, optional language prop.
 */
export const CodeRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const inline = element.props?.inline === true
  const { density } = useSurface()
  const style: React.CSSProperties = {
    ...(inline ? CODE_INLINE : CODE_BLOCK),
    fontSize: DENSITY_CODE_SIZE[density],
  }

  if (inline) {
    return <code style={style}>{element.content ?? children}</code>
  }

  return (
    <pre style={{ ...CODE_BLOCK, fontSize: DENSITY_CODE_SIZE[density] }}>
      <code>{element.content ?? children}</code>
    </pre>
  )
}

CodeRenderer.displayName = 'Code'

// =============================================================================
// Image
// =============================================================================

/**
 * Image renderer — src/alt with optional aspect ratio.
 */
export const ImageRenderer: React.FC<ComponentRenderProps> = ({ element }) => {
  const src = element.props?.src as string | undefined
  const alt = (element.props?.alt as string) ?? ''
  const aspectRatio = element.props?.aspectRatio as string | undefined

  if (!src) return null

  const containerStyle: React.CSSProperties = {
    overflow: 'hidden',
    borderRadius: VANTA_BORDERS.radius.md,
    border: VANTA_BORDERS.style.subtle,
    ...(aspectRatio ? { aspectRatio } : {}),
  }

  const imgStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  }

  return (
    <div style={containerStyle}>
      <img src={src} alt={alt} style={imgStyle} loading="lazy" />
    </div>
  )
}

ImageRenderer.displayName = 'Image'
