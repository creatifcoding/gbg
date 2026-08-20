/**
 * Catalog Vantablack design system
 *
 * Near-black card system with mono headers, Geo body typography.
 * Tokens are copied from packages/tmnl/src/components/portal/tokens.ts.
 *
 * @example
 * ```tsx
 * import { VantaCard, VANTA_COLORS } from '~/components/portal'
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

export { VantaCard } from './VantaCard'
export type { VantaCardProps, IndicatorStatus } from './VantaCard'
