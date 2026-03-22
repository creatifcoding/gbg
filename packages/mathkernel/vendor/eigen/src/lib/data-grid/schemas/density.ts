/**
 * Density Tier Schema
 *
 * TMNL density tiers for AG-Grid.
 * Grid exemption: 8px floor for ultra-dense operator views.
 */

import { Schema } from 'effect'

// =============================================================================
// DENSITY TIER
// =============================================================================

/**
 * Named density tiers for TMNL grids.
 *
 * | Tier    | Row Height | Font Size | Use Case                    |
 * |---------|------------|-----------|------------------------------|
 * | ultra   | 16px       | 8px       | Maximum density, ops console |
 * | dense   | 20px       | 10px      | High-density trading view    |
 * | normal  | 24px       | 12px      | Standard analyst view        |
 * | relaxed | 32px       | 14px      | Presentation / readability   |
 */
export const DensityTier = Schema.Literal('ultra', 'dense', 'normal', 'relaxed', 'rvn')
export type DensityTier = typeof DensityTier.Type

// =============================================================================
// DENSITY CONFIG
// =============================================================================

/**
 * Complete density configuration derived from tier.
 */
export const DensityConfig = Schema.Struct({
  tier: DensityTier,
  rowHeight: Schema.Number.pipe(Schema.int(), Schema.positive()),
  headerHeight: Schema.Number.pipe(Schema.int(), Schema.positive()),
  fontSize: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(8)),
  fontSizeXs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(8)),
  paddingX: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  paddingY: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  iconSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  spacing: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type DensityConfig = typeof DensityConfig.Type

// =============================================================================
// TIER PRESETS
// =============================================================================

/**
 * Pre-computed density configurations for each tier.
 * These are the canonical values — use these, don't invent new sizes.
 */
export const DENSITY_PRESETS: Record<DensityTier, DensityConfig> = {
  ultra: {
    tier: 'ultra',
    rowHeight: 16,
    headerHeight: 18,
    fontSize: 9,
    fontSizeXs: 8,
    paddingX: 4,
    paddingY: 1,
    iconSize: 8,
    spacing: 2,
  },
  dense: {
    tier: 'dense',
    rowHeight: 20,
    headerHeight: 22,
    fontSize: 10,
    fontSizeXs: 9,
    paddingX: 6,
    paddingY: 2,
    iconSize: 10,
    spacing: 3,
  },
  normal: {
    tier: 'normal',
    rowHeight: 24,
    headerHeight: 28,
    fontSize: 12,
    fontSizeXs: 11,
    paddingX: 8,
    paddingY: 3,
    iconSize: 12,
    spacing: 4,
  },
  relaxed: {
    tier: 'relaxed',
    rowHeight: 32,
    headerHeight: 36,
    fontSize: 14,
    fontSizeXs: 12,
    paddingX: 12,
    paddingY: 4,
    iconSize: 14,
    spacing: 6,
  },
  rvn: {
    tier: 'rvn',
    rowHeight: 36,
    headerHeight: 40,
    fontSize: 12,
    fontSizeXs: 12, // 12px floor enforced
    paddingX: 10,
    paddingY: 4,
    iconSize: 14,
    spacing: 4,
  },
}

/**
 * Get density config for a tier.
 * @param tier - Density tier name
 * @returns Complete density configuration
 */
export function getDensityConfig(tier: DensityTier): DensityConfig {
  return DENSITY_PRESETS[tier]
}
