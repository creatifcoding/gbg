/**
 * TMNL Vantablack Design System
 *
 * Near-black card system with mono headers, sans body typography.
 * Canonical aesthetic for splash portals and elevated contexts.
 *
 * @example
 * ```tsx
 * import { VantaCard, VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/lib/design-system/vanta'
 *
 * <VantaCard variant="elevated" corners glow>
 *   <VantaCard.Header>
 *     <VantaCard.Title>SYSTEM STATUS</VantaCard.Title>
 *     <VantaCard.Indicator status="active" />
 *   </VantaCard.Header>
 *   <VantaCard.Body>All systems operational.</VantaCard.Body>
 * </VantaCard>
 * ```
 */

// Tokens
export {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
  VANTA_CARD_VARIANTS,
} from './tokens'

export type {
  VantaColorKey,
  VantaTextColorKey,
  VantaAccentKey,
  VantaSizeKey,
  VantaSpacingKey,
  VantaCardVariant,
} from './tokens'

// Components
export { VantaCard } from './VantaCard'
export type { VantaCardProps, IndicatorStatus } from './VantaCard'
