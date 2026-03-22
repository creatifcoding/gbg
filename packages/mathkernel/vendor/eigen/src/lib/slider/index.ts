/**
 * Slider System
 *
 * v1: DAW-grade slider with Effect.Service behaviors
 * v2: Trait-based slider with Effect-ified animations (WIP)
 *
 * @example v1 Usage (current default)
 * ```tsx
 * import { Slider } from '@/lib/slider'
 * // or explicit:
 * import { Slider } from '@/lib/slider/v1'
 * ```
 *
 * @example v2 Usage (coming soon)
 * ```tsx
 * import { Slider } from '@/lib/slider/v2'
 * ```
 */

// =============================================================================
// V1 (Legacy DAW-grade slider)
// =============================================================================
export * from './v1'

// =============================================================================
// V2 (Trait-based, Effect-ified)
// =============================================================================
export * as v2 from './v2'
