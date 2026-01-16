/**
 * @module layout/schemas/spacing
 * @description SpacingToken - branded type for valid VANTA spacing values
 */

import { Schema } from "effect"

/**
 * Valid VANTA spacing values (in pixels)
 * Based on 4px base unit: 0, 4, 8, 12, 16, 24, 32, 48, 64
 */
export const SPACING_VALUES = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const

export type SpacingValue = (typeof SPACING_VALUES)[number]

/**
 * Branded SpacingToken schema
 * Only accepts valid VANTA spacing values
 */
export const SpacingToken = Schema.Number.pipe(
  Schema.filter(
    (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n),
    {
      message: (n) =>
        `Invalid spacing value: ${n}. Must be one of: ${SPACING_VALUES.join(", ")}`,
    }
  ),
  Schema.brand("SpacingToken")
)

export type SpacingToken = typeof SpacingToken.Type

/**
 * Optional SpacingToken with default value
 */
export const SpacingTokenWithDefault = (defaultValue: SpacingValue) =>
  Schema.optionalWith(SpacingToken, { default: () => defaultValue as SpacingToken })

/**
 * Utility: Convert spacing token to CSS value
 */
export const spacingToCss = (spacing: SpacingToken): string => `${spacing}px`

/**
 * Utility: Get CSS variable for spacing (if using design tokens)
 */
export const spacingToVar = (spacing: SpacingToken): string => {
  const varNames: Record<SpacingValue, string> = {
    0: "var(--tmnl-space-0)",
    4: "var(--tmnl-space-1)",
    8: "var(--tmnl-space-2)",
    12: "var(--tmnl-space-3)",
    16: "var(--tmnl-space-4)",
    24: "var(--tmnl-space-6)",
    32: "var(--tmnl-space-8)",
    48: "var(--tmnl-space-12)",
    64: "var(--tmnl-space-16)",
  }
  return varNames[spacing as SpacingValue] ?? spacingToCss(spacing)
}
