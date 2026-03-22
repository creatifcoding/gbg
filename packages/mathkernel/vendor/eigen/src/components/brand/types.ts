/**
 * Brand Component Types
 *
 * Shared types for logo variants and animation strategies.
 *
 * @module components/brand
 */

// ─────────────────────────────────────────────────────────────────────────────
// Logo Variants
// ─────────────────────────────────────────────────────────────────────────────

export type LogoVariant = 'default' | 'solid'

export interface LogoPathData {
  readonly variant: LogoVariant
  readonly viewBox: string
  readonly aspectRatio: number
  readonly paths: ReadonlyArray<{
    readonly id: string
    readonly d: string
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnimationType =
  | 'none'
  | 'stroke-draw'
  | 'fade-in'
  | 'scale-reveal'
  | 'pulse'

export interface AnimationConfig {
  readonly type: AnimationType
  readonly duration: number
  readonly delay: number
  readonly strokeColor: string
  readonly fillColor: string
  readonly easing: string
}

export interface LogoRefs {
  readonly svg: SVGSVGElement | null
  readonly paths: ReadonlyArray<SVGPathElement | null>
}

export interface AnimationControls {
  play: () => void
  pause: () => void
  reset: () => void
  reverse: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

export interface SelfchartersLogoBaseProps {
  /** Logo variant */
  variant?: LogoVariant
  /** Size in pixels (maintains aspect ratio) */
  size?: number
  /** Width override */
  width?: number | string
  /** Height override */
  height?: number | string
  /** Fill color */
  fillColor?: string
  /** Additional className */
  className?: string
  /** Additional styles */
  style?: React.CSSProperties
}

export interface SelfchartersLogoAnimatedProps extends SelfchartersLogoBaseProps {
  /** Animation type */
  animation?: AnimationType
  /** Stroke color for draw animation */
  strokeColor?: string
  /** Stroke width during animation */
  strokeWidth?: number
  /** Total animation duration in ms */
  duration?: number
  /** Delay before animation starts */
  delay?: number
  /** Easing function */
  easing?: string
  /** Auto-play on mount */
  autoPlay?: boolean
  /** Loop animation */
  loop?: boolean
  /** Callback when animation completes */
  onComplete?: () => void
}
