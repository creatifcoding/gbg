/**
 * TMNL Charting v1 - SignalGenerator
 *
 * Procedural signal synthesis for testing and demos.
 * Replaces COSS (Composite Orthobasis Stress Signal) with cleaner API.
 *
 * @experimental v1 API may change.
 */

import type { ChartDatum, ChartSeries } from "../types"
import { createDatum } from "../types"
import { RingBuffer } from "./RingBuffer"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signal generator function signature
 */
export type GeneratorFunction = (time: number, phase: number, index: number) => number

/**
 * Signal configuration
 */
export interface SignalConfig {
  /** Number of points to generate */
  readonly pointCount: number
  /** Frequency of primary oscillation */
  readonly frequency: number
  /** Amplitude of primary oscillation */
  readonly amplitude: number
  /** Phase offset */
  readonly phase: number
  /** Noise factor (0-1) */
  readonly noise: number
  /** Linear trend slope */
  readonly trend: number
  /** Series identifier */
  readonly series?: string
  /** Group identifier */
  readonly group?: string
  /** Trigger interval (every Nth point is highlighted) */
  readonly triggerInterval?: number
}

const DEFAULT_CONFIG: SignalConfig = {
  pointCount: 256,
  frequency: 2,
  amplitude: 1,
  phase: 0,
  noise: 0.1,
  trend: 0,
  series: undefined,
  group: undefined,
  triggerInterval: 0,
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a composite signal (sine + cosine + noise + trend)
 *
 * @example
 * ```ts
 * const data = generateSignal({
 *   pointCount: 512,
 *   frequency: 3,
 *   amplitude: 0.9,
 *   noise: 0.05,
 * })
 * ```
 */
export function generateSignal(config: Partial<SignalConfig> = {}): ChartSeries {
  const cfg: SignalConfig = { ...DEFAULT_CONFIG, ...config }
  const {
    pointCount,
    frequency,
    amplitude,
    phase,
    noise,
    trend,
    series,
    group,
    triggerInterval,
  } = cfg

  const points: ChartDatum[] = []

  for (let i = 0; i < pointCount; i++) {
    const t = i
    const normalizedX = i / pointCount

    // Composite signal: sine + cosine harmonic + trend + noise
    const primaryOsc = Math.sin(normalizedX * frequency * Math.PI * 2 + phase) * amplitude
    const secondaryOsc =
      Math.cos(normalizedX * frequency * Math.PI * 4 + phase) * amplitude * 0.3
    const trendComponent = trend * normalizedX
    const noiseComponent = (Math.random() - 0.5) * noise * 2

    const x = i
    const y = primaryOsc + secondaryOsc + trendComponent + noiseComponent

    const highlight = triggerInterval && triggerInterval > 0 && i % triggerInterval === 0

    points.push(createDatum(t, x, y, { series, group, highlight }))
  }

  return points
}

/**
 * Generate dual-wave signal for stereo/dual-channel visualization
 */
export function generateDualSignal(
  config1: Partial<SignalConfig> = {},
  config2: Partial<SignalConfig> = {}
): { wave1: ChartSeries; wave2: ChartSeries } {
  return {
    wave1: generateSignal({ ...config1, series: "wave1", group: "G1" }),
    wave2: generateSignal({ ...config2, series: "wave2", group: "G2" }),
  }
}

/**
 * Generate sine wave
 */
export function sineWave(
  pointCount: number,
  frequency: number = 1,
  amplitude: number = 1,
  phase: number = 0
): ChartSeries {
  return generateSignal({
    pointCount,
    frequency,
    amplitude,
    phase,
    noise: 0,
    trend: 0,
  })
}

/**
 * Generate noise signal
 */
export function noiseSignal(pointCount: number, amplitude: number = 1): ChartSeries {
  const points: ChartDatum[] = []
  for (let i = 0; i < pointCount; i++) {
    const y = (Math.random() - 0.5) * 2 * amplitude
    points.push(createDatum(i, i, y))
  }
  return points
}

/**
 * Generate step signal
 */
export function stepSignal(pointCount: number, stepSize: number = 10): ChartSeries {
  const points: ChartDatum[] = []
  let currentValue = 0
  for (let i = 0; i < pointCount; i++) {
    if (i % stepSize === 0) {
      currentValue = Math.random()
    }
    points.push(createDatum(i, i, currentValue))
  }
  return points
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-time Signal Generator (with buffer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real-time signal generator that streams to a buffer
 *
 * @example
 * ```ts
 * const buffer = new RingBuffer(512)
 * const gen = new RealtimeSignalGenerator(buffer)
 *
 * gen.start(2, 60) // 2Hz at 60fps
 * // ... later
 * gen.stop()
 * ```
 */
export class RealtimeSignalGenerator {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private phase = 0
  private time = 0
  private generator: GeneratorFunction

  constructor(
    private readonly buffer: RingBuffer,
    generator?: GeneratorFunction
  ) {
    this.generator =
      generator ??
      ((t, p) => Math.sin(t * 2 * Math.PI * 2 + p)) // Default 2Hz sine
  }

  /**
   * Start generating
   *
   * @param frequency Signal frequency (Hz)
   * @param sampleRate Samples per second
   */
  start(frequency: number = 2, sampleRate: number = 60): this {
    this.stop()
    this.time = 0

    const intervalMs = Math.max(1, Math.floor(1000 / sampleRate))

    // Create generator with frequency baked in
    const gen: GeneratorFunction = (t, p, _i) => {
      return Math.sin(t * frequency * Math.PI * 2 + p)
    }

    this.intervalId = setInterval(() => {
      const value = gen(this.time, this.phase, 0)
      this.buffer.push(value)
      this.time += 1 / sampleRate
    }, intervalMs)

    return this
  }

  /**
   * Start with custom generator function
   */
  startCustom(generator: GeneratorFunction, sampleRate: number = 60): this {
    this.stop()
    this.time = 0
    this.generator = generator

    const intervalMs = Math.max(1, Math.floor(1000 / sampleRate))
    let index = 0

    this.intervalId = setInterval(() => {
      const value = this.generator(this.time, this.phase, index++)
      this.buffer.push(value)
      this.time += 1 / sampleRate
    }, intervalMs)

    return this
  }

  /**
   * Set phase offset
   */
  setPhase(phase: number): void {
    this.phase = Number.isFinite(phase) ? phase : 0
  }

  /**
   * Stop generating
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Check if running
   */
  get isRunning(): boolean {
    return this.intervalId !== null
  }

  /**
   * Get underlying buffer
   */
  getBuffer(): RingBuffer {
    return this.buffer
  }
}
