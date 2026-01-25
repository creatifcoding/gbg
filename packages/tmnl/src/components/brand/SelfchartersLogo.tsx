/**
 * Selfcharters Logo — Compound Component
 *
 * A geometric logo with multiple variants and animation strategies.
 *
 * ## Usage
 *
 * ```tsx
 * // Static (no animation)
 * <SelfchartersLogo.Static variant="solid" size={24} fillColor="#ffffff" />
 *
 * // Animated (with animation)
 * <SelfchartersLogo.Animated
 *   variant="default"
 *   animation="stroke-draw"
 *   size={200}
 *   strokeColor="#00ffcc"
 *   fillColor="#ffffff"
 * />
 *
 * // Shorthand (defaults to Static)
 * <SelfchartersLogo variant="solid" size={24} />
 * ```
 *
 * ## Variants
 * - `default`: Outer + inner paths (original logo)
 * - `solid`: Single solid path (filled mark)
 *
 * ## Animation Types
 * - `none`: No animation
 * - `stroke-draw`: Line drawing effect (default for Animated)
 * - `fade-in`: Simple opacity fade
 * - `scale-reveal`: Grow from center
 * - `pulse`: Continuous breathing
 *
 * @module components/brand
 */

import { useEffect, useRef, useCallback, forwardRef } from 'react'
import { Effect } from 'effect'
import { getLogoPaths } from './paths'
import { getAnimationImpl } from './services'
import type {
  LogoVariant,
  AnimationType,
  SelfchartersLogoBaseProps,
  SelfchartersLogoAnimatedProps,
  LogoRefs,
  AnimationConfig,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared SVG Renderer
// ─────────────────────────────────────────────────────────────────────────────

interface SVGRendererProps {
  variant: LogoVariant
  width: number | string
  height: number | string
  fillColor: string
  className?: string
  style?: React.CSSProperties
  pathRefs?: React.MutableRefObject<(SVGPathElement | null)[]>
  svgRef?: React.Ref<SVGSVGElement>
}

function SVGRenderer({
  variant,
  width,
  height,
  fillColor,
  className,
  style,
  pathRefs,
  svgRef,
}: SVGRendererProps) {
  const pathData = getLogoPaths(variant)

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={pathData.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        fillRule: 'evenodd',
        clipRule: 'evenodd',
        strokeLinejoin: 'round',
        strokeMiterlimit: 2,
        ...style,
      }}
    >
      <g id="Logo">
        {pathData.paths.map((path, index) => (
          <path
            key={path.id}
            ref={pathRefs ? (el) => (pathRefs.current[index] = el) : undefined}
            d={path.d}
            style={{
              fill: fillColor,
              stroke: 'transparent',
              strokeWidth: 0,
            }}
          />
        ))}
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Static Component
// ─────────────────────────────────────────────────────────────────────────────

export interface StaticProps extends SelfchartersLogoBaseProps {}

const Static = forwardRef<SVGSVGElement, StaticProps>(function Static(
  {
    variant = 'solid',
    size,
    width,
    height,
    fillColor = '#ffffff',
    className = '',
    style = {},
  },
  ref
) {
  const pathData = getLogoPaths(variant)

  // Calculate dimensions
  const computedWidth = width ?? (size ? size : 24)
  const computedHeight = height ?? (size ? size / pathData.aspectRatio : 24 / pathData.aspectRatio)

  return (
    <SVGRenderer
      variant={variant}
      width={computedWidth}
      height={computedHeight}
      fillColor={fillColor}
      className={className}
      style={style}
      svgRef={ref}
    />
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Animated Component
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimatedProps extends SelfchartersLogoAnimatedProps {}

const Animated = forwardRef<SVGSVGElement, AnimatedProps>(function Animated(
  {
    variant = 'solid',
    animation = 'stroke-draw',
    size,
    width,
    height,
    fillColor = '#ffffff',
    strokeColor = '#00ffcc',
    strokeWidth = 40,
    duration = 2000,
    delay = 0,
    easing = 'outQuart',
    autoPlay = true,
    loop = false,
    onComplete,
    className = '',
    style = {},
  },
  ref
) {
  const pathData = getLogoPaths(variant)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const cleanupRef = useRef<(() => void) | null>(null)

  // Calculate dimensions
  const computedWidth = width ?? (size ? size : 24)
  const computedHeight = height ?? (size ? size / pathData.aspectRatio : 24 / pathData.aspectRatio)

  // Run animation
  const runAnimation = useCallback(() => {
    const animationImpl = getAnimationImpl(animation)
    const refs: LogoRefs = {
      svg: svgRef.current,
      paths: pathRefs.current,
    }

    const config: AnimationConfig = {
      type: animation,
      duration,
      delay,
      strokeColor,
      fillColor,
      easing,
    }

    // Run the Effect
    const cleanup = Effect.runSync(animationImpl.animate(refs, config))
    cleanupRef.current = cleanup

    // Handle completion callback (approximate timing)
    if (onComplete && !loop) {
      setTimeout(onComplete, duration + delay + 100)
    }
  }, [animation, duration, delay, strokeColor, fillColor, easing, loop, onComplete])

  // Auto-play on mount
  useEffect(() => {
    if (autoPlay) {
      // Small delay to ensure DOM is ready
      const timeout = setTimeout(runAnimation, 50)
      return () => {
        clearTimeout(timeout)
        cleanupRef.current?.()
      }
    }
    return () => {
      cleanupRef.current?.()
    }
  }, [autoPlay, runAnimation])

  // Forward ref
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(svgRef.current)
    } else if (ref) {
      ref.current = svgRef.current
    }
  }, [ref])

  return (
    <SVGRenderer
      variant={variant}
      width={computedWidth}
      height={computedHeight}
      fillColor={autoPlay ? 'transparent' : fillColor}
      className={className}
      style={style}
      svgRef={svgRef}
      pathRefs={pathRefs}
    />
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Main Component (defaults to Static)
// ─────────────────────────────────────────────────────────────────────────────

export interface SelfchartersLogoProps extends SelfchartersLogoBaseProps {
  /** Enable animation (shorthand for using Animated) */
  animate?: boolean
  /** Animation type (when animate=true) */
  animation?: AnimationType
  /** Stroke color (when animate=true) */
  strokeColor?: string
  /** Animation duration (when animate=true) */
  duration?: number
  /** Animation delay (when animate=true) */
  delay?: number
  /** Callback when animation completes */
  onAnimationComplete?: () => void
}

function SelfchartersLogoRoot({
  animate = false,
  animation = 'stroke-draw',
  strokeColor = '#00ffcc',
  duration = 2000,
  delay = 0,
  onAnimationComplete,
  ...props
}: SelfchartersLogoProps) {
  if (animate) {
    return (
      <Animated
        animation={animation}
        strokeColor={strokeColor}
        duration={duration}
        delay={delay}
        onComplete={onAnimationComplete}
        {...props}
      />
    )
  }
  return <Static {...props} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound Component Export
// ─────────────────────────────────────────────────────────────────────────────

export const SelfchartersLogo = Object.assign(SelfchartersLogoRoot, {
  Static,
  Animated,
})

// Legacy exports for backwards compatibility
export { Static as SelfchartersLogoStatic }
export { Animated as SelfchartersLogoAnimated }

// Hook for imperative control (placeholder)
export function useSelfchartersLogo() {
  const svgRef = useRef<SVGSVGElement>(null)

  return {
    svgRef,
    // TODO: Add imperative controls
  }
}

export type { SelfchartersLogoProps }
export type SelfchartersLogoRef = SVGSVGElement

export default SelfchartersLogo
