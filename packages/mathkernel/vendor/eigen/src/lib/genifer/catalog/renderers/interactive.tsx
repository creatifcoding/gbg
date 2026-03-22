/**
 * @fileoverview Core Interactive Renderers — Button, Input, Link
 *
 * Button: outlined at rest, fill-on-hover with scale(1.02) + glow.
 * Input: box input with cyan focus ring, rose error state.
 * Link: cyan accent, underline on hover.
 *
 * Zero Tailwind. All style via VANTA tokens.
 *
 * @module genifer/catalog/renderers/interactive
 */

import React, { useState, useCallback } from 'react'
import type { ComponentRenderProps } from '@/lib/genifer/core/CatalogService'
import { VANTA_COLORS, VANTA_TYPOGRAPHY, VANTA_SPACING } from '@/components/portal/tokens'
import { filterClassName } from '../className'
import { useSurface } from '../context'
import { DENSITY_BUTTON_HEIGHT, DENSITY_BUTTON_FONT, DENSITY_INPUT_HEIGHT, DENSITY_INPUT_FONT } from '../density'
import {
  BUTTON_BASE,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  BUTTON_HOVER,
  BUTTON_DISABLED,
  INPUT_STYLE,
  INPUT_FOCUS,
  INPUT_ERROR,
  LINK_STYLE,
  LINK_HOVER,
} from '../tokens'
import { DEFAULT_POLICIES } from '../types'

// =============================================================================
// Button
// =============================================================================

/**
 * Button renderer — outlined at rest, fill-on-hover with animation.
 *
 * Variants: primary | secondary | ghost | danger
 * Sizes: sm | md | lg
 * Disabled: 0.4 opacity + pointer-events-none
 *
 * Hover transitions via CSS: all 200ms ease-out.
 * Scale(1.02) + glow box-shadow on hover.
 */
export const ButtonRenderer: React.FC<ComponentRenderProps> = ({ element, children, onAction }) => {
  const p = element.props ?? {}
  const variant = (p.variant as string) ?? 'primary'
  const size = (p.size as string) ?? 'md'
  const disabled = p.disabled === true
  const actionId = p.onAction as string | undefined
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.interactive)

  const [hovered, setHovered] = useState(false)

  const handleClick = useCallback(() => {
    if (disabled) return
    if (actionId && onAction) {
      onAction({ _tag: 'NavigateAction', type: actionId, payload: {} } as any)
    }
  }, [actionId, onAction, disabled])

  // Build composite style
  const variantStyle = BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary
  const sizeStyle = BUTTON_SIZES[size] ?? BUTTON_SIZES.md
  const hoverStyle = hovered && !disabled
    ? (BUTTON_HOVER[variant] ?? BUTTON_HOVER.primary)
    : {}

  // Density-aware overrides
  const { density } = useSurface()

  const style: React.CSSProperties = {
    ...BUTTON_BASE,
    ...sizeStyle,
    ...variantStyle,
    ...hoverStyle,
    ...(disabled ? BUTTON_DISABLED : {}),
    height: DENSITY_BUTTON_HEIGHT[density],
    fontSize: DENSITY_BUTTON_FONT[density],
  }

  return (
    <button
      style={style}
      className={filtered || undefined}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {element.content ?? children}
    </button>
  )
}

ButtonRenderer.displayName = 'Button'

// =============================================================================
// Input
// =============================================================================

/**
 * Input renderer — box input with label, focus ring, error state.
 *
 * Label renders in label preset above the input.
 * Focus: cyan border + outer ring.
 * Error: rose border + error message below.
 */
export const InputRenderer: React.FC<ComponentRenderProps> = ({ element }) => {
  const p = element.props ?? {}
  const label = p.label as string | undefined
  const placeholder = p.placeholder as string | undefined
  const error = p.error as string | undefined
  const type = (p.type as string) ?? 'text'
  const defaultValue = p.defaultValue as string | undefined
  const disabled = p.disabled === true
  const filtered = filterClassName(element.className, DEFAULT_POLICIES.interactive)

  const [focused, setFocused] = useState(false)

  const { density } = useSurface()

  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE,
    ...(focused && !error ? INPUT_FOCUS : {}),
    ...(error ? INPUT_ERROR : {}),
    ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
    height: DENSITY_INPUT_HEIGHT[density],
    fontSize: DENSITY_INPUT_FONT[density],
  }

  return (
    <div className={filtered || undefined}>
      {label && (
        <label style={{
          ...VANTA_TYPOGRAPHY.preset.label,
          color: VANTA_COLORS.text.tertiary,
          display: 'block',
          marginBottom: VANTA_SPACING['1.5'],
        }}>
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={disabled}
        style={inputStyle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && (
        <div style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.accent.rose,
          marginTop: VANTA_SPACING['1'],
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

InputRenderer.displayName = 'Input'

// =============================================================================
// Link
// =============================================================================

/**
 * Link renderer — cyan accent, underline on hover.
 */
export const LinkRenderer: React.FC<ComponentRenderProps> = ({ element, children }) => {
  const [hovered, setHovered] = useState(false)
  const href = (element.props?.href as string) ?? '#'

  const style: React.CSSProperties = {
    ...LINK_STYLE,
    ...(hovered ? LINK_HOVER : {}),
  }

  return (
    <a
      href={href}
      style={style}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {element.content ?? children}
    </a>
  )
}

LinkRenderer.displayName = 'Link'
