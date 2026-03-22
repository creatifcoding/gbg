/**
 * TMNL Charting v1 - RingBuffer
 *
 * Circular buffer for real-time streaming data.
 * High-performance, zero-allocation after initialization.
 *
 * @experimental v1 API may change.
 */

import { BufferState, type BufferSnapshot } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// RingBuffer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Circular buffer for streaming data
 *
 * @example
 * ```ts
 * const buffer = new RingBuffer(512)
 * buffer.push(1.0)
 * buffer.push(2.0)
 * const snapshot = buffer.snapshot()
 * ```
 */
export class RingBuffer {
  private readonly buffer: Float32Array
  private head = 0
  private count = 0

  constructor(public readonly capacity: number) {
    if (capacity <= 0 || !Number.isInteger(capacity)) {
      throw new Error(`RingBuffer capacity must be positive integer, got: ${capacity}`)
    }
    this.buffer = new Float32Array(capacity)
  }

  /**
   * Push a single value
   */
  push(value: number): void {
    // Coerce NaN/Infinity to 0
    const safe = Number.isFinite(value) ? value : 0
    this.buffer[this.head] = safe
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  /**
   * Push multiple values
   */
  pushBatch(values: readonly number[]): void {
    for (let i = 0; i < values.length; i++) {
      this.push(values[i])
    }
  }

  /**
   * Get immutable snapshot of current data
   */
  snapshot(): BufferSnapshot {
    const length = this.count
    const data = new Float32Array(length)

    for (let i = 0; i < length; i++) {
      const idx = (this.head - length + i + this.capacity) % this.capacity
      data[i] = this.buffer[idx]
    }

    return {
      data,
      length,
      state:
        length === 0
          ? BufferState.Empty
          : length < this.capacity
            ? BufferState.Partial
            : BufferState.Full,
    }
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.head = 0
    this.count = 0
    this.buffer.fill(0)
  }

  /**
   * Get current fill level (0-1)
   */
  get fillLevel(): number {
    return this.count / this.capacity
  }

  /**
   * Get current count
   */
  get size(): number {
    return this.count
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this.count === this.capacity
  }

  /**
   * Get value at index (0 = oldest, count-1 = newest)
   */
  at(index: number): number | undefined {
    if (index < 0 || index >= this.count) return undefined
    const idx = (this.head - this.count + index + this.capacity) % this.capacity
    return this.buffer[idx]
  }

  /**
   * Get newest value
   */
  get latest(): number | undefined {
    if (this.count === 0) return undefined
    const idx = (this.head - 1 + this.capacity) % this.capacity
    return this.buffer[idx]
  }

  /**
   * Get oldest value
   */
  get oldest(): number | undefined {
    if (this.count === 0) return undefined
    const idx = (this.head - this.count + this.capacity) % this.capacity
    return this.buffer[idx]
  }
}
