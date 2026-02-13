/**
 * ChannelBuilder — Fluent API for constructing Channel topologies
 *
 * The builder pattern allows incremental construction of complex topologies
 * while maintaining type safety and ensuring valid configurations.
 *
 * Usage:
 * ```typescript
 * const channel = ChannelBuilder.create("sensor-hub")
 *   .name("Sensor Hub")
 *   .inlet("temp", { name: "Temperature" })
 *   .inlet("press", { name: "Pressure" })
 *   .junction("merge", { kind: "merge", name: "Sensor Merge" })
 *   .outlet("combined", { name: "Combined Output", broadcast: true })
 *   .wire("temp", "merge")
 *   .wire("press", "merge")
 *   .wire("merge", "combined")
 *   .timeout("5 seconds", "fail")
 *   .backpressure("drop-oldest", 1000)
 *   .build()
 * ```
 */

import { Effect, Schema, pipe } from "effect"
import { nanoid } from "nanoid"
import {
  type ChannelId,
  type InletId,
  type OutletId,
  type JunctionId,
  type WireId,
  type JunctionKind,
  type BackpressureStrategy,
  type TimeoutBehavior,
  type CircuitState,
  Inlet,
  Outlet,
  Junction,
  Wire,
  BackpressureConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  RetryConfig,
  ChannelProtocol,
  ChannelTopology,
  ChannelMetrics,
  ChannelState,
  ChannelConfig,
} from "./Channel"

// ============================================================================
// BUILDER CONFIG TYPES
// ============================================================================

/** Inlet builder configuration */
export interface InletBuilderConfig {
  readonly name?: string
  readonly schema?: Schema.Schema<unknown, unknown>
}

/** Outlet builder configuration */
export interface OutletBuilderConfig {
  readonly name?: string
  readonly schema?: Schema.Schema<unknown, unknown>
  readonly broadcast?: boolean
  readonly maxLag?: number
}

/** Junction builder configuration */
export interface JunctionBuilderConfig {
  readonly name?: string
  readonly kind: JunctionKind
  readonly config?: unknown
}

/** Wire endpoints can be inlet, junction, or outlet IDs */
export type WireEndpoint = string

// ============================================================================
// INTERNAL STATE
// ============================================================================

interface BuilderState {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly inlets: Map<string, Inlet>
  readonly outlets: Map<string, Outlet>
  readonly junctions: Map<string, Junction>
  readonly wires: Wire[]
  readonly timeout?: TimeoutConfig
  readonly circuitBreaker?: CircuitBreakerConfig
  readonly backpressure?: BackpressureConfig
  readonly retry?: RetryConfig
}

// ============================================================================
// CHANNEL BUILDER
// ============================================================================

/**
 * ChannelBuilder — Immutable builder for Channel topologies.
 *
 * Each method returns a new builder instance, allowing for
 * method chaining without mutation.
 */
export class ChannelBuilder {
  private readonly state: BuilderState

  private constructor(state: BuilderState) {
    this.state = state
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FACTORY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new ChannelBuilder with the given ID.
   */
  static create(id: string): ChannelBuilder {
    return new ChannelBuilder({
      id,
      name: id,
      inlets: new Map(),
      outlets: new Map(),
      junctions: new Map(),
      wires: [],
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // METADATA
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Set the channel name.
   */
  name(name: string): ChannelBuilder {
    return new ChannelBuilder({ ...this.state, name })
  }

  /**
   * Set the channel description.
   */
  description(description: string): ChannelBuilder {
    return new ChannelBuilder({ ...this.state, description })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOPOLOGY — INLETS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Add an inlet to the channel.
   *
   * @param localId - Local identifier for this inlet (used in wiring)
   * @param config - Inlet configuration
   */
  inlet(localId: string, config?: InletBuilderConfig): ChannelBuilder {
    const channelId = this.state.id as ChannelId
    const inletId = `${this.state.id}:inlet:${localId}` as InletId

    const inlet = new Inlet({
      id: inletId,
      name: config?.name ?? localId,
      channelId,
      schema: config?.schema,
      connected: false,
      sourceId: undefined,
    })

    const inlets = new Map(this.state.inlets)
    inlets.set(localId, inlet)

    return new ChannelBuilder({ ...this.state, inlets })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOPOLOGY — OUTLETS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Add an outlet to the channel.
   *
   * @param localId - Local identifier for this outlet (used in wiring)
   * @param config - Outlet configuration
   */
  outlet(localId: string, config?: OutletBuilderConfig): ChannelBuilder {
    const channelId = this.state.id as ChannelId
    const outletId = `${this.state.id}:outlet:${localId}` as OutletId

    const outlet = new Outlet({
      id: outletId,
      name: config?.name ?? localId,
      channelId,
      schema: config?.schema,
      broadcast: config?.broadcast ?? false,
      maxLag: config?.maxLag ?? 16,
      subscriberCount: 0,
    })

    const outlets = new Map(this.state.outlets)
    outlets.set(localId, outlet)

    return new ChannelBuilder({ ...this.state, outlets })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOPOLOGY — JUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Add a junction to the channel.
   *
   * @param localId - Local identifier for this junction (used in wiring)
   * @param config - Junction configuration (must include kind)
   */
  junction(localId: string, config: JunctionBuilderConfig): ChannelBuilder {
    const channelId = this.state.id as ChannelId
    const junctionId = `${this.state.id}:junction:${localId}` as JunctionId

    const junction = new Junction({
      id: junctionId,
      name: config.name ?? localId,
      channelId,
      kind: config.kind,
      config: config.config,
    })

    const junctions = new Map(this.state.junctions)
    junctions.set(localId, junction)

    return new ChannelBuilder({ ...this.state, junctions })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOPOLOGY — WIRES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Wire two components together.
   *
   * @param from - Source local ID (inlet or junction)
   * @param to - Target local ID (junction or outlet)
   */
  wire(from: WireEndpoint, to: WireEndpoint): ChannelBuilder {
    const channelId = this.state.id as ChannelId
    const wireId = `${this.state.id}:wire:${nanoid(8)}` as WireId

    // Resolve the actual IDs
    const fromId = this.resolveEndpoint(from, "from")
    const toId = this.resolveEndpoint(to, "to")

    const wire = new Wire({
      id: wireId,
      channelId,
      from: fromId,
      to: toId,
      active: true,
    })

    return new ChannelBuilder({
      ...this.state,
      wires: [...this.state.wires, wire],
    })
  }

  private resolveEndpoint(
    localId: string,
    direction: "from" | "to"
  ): InletId | JunctionId | OutletId {
    // Check inlets (only valid for "from")
    if (direction === "from" && this.state.inlets.has(localId)) {
      return this.state.inlets.get(localId)!.id
    }

    // Check junctions (valid for both)
    if (this.state.junctions.has(localId)) {
      return this.state.junctions.get(localId)!.id
    }

    // Check outlets (only valid for "to")
    if (direction === "to" && this.state.outlets.has(localId)) {
      return this.state.outlets.get(localId)!.id
    }

    // Return as-is (assume it's a pre-built ID)
    return localId as InletId | JunctionId | OutletId
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROTOCOL — TIMEOUT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Configure timeout behavior.
   *
   * @param duration - Timeout duration (e.g., "5 seconds")
   * @param behavior - What to do on timeout: "fail", "warn", or "skip"
   */
  timeout(duration: string, behavior: TimeoutBehavior = "fail"): ChannelBuilder {
    const timeout = new TimeoutConfig({
      duration,
      behavior,
    })

    return new ChannelBuilder({ ...this.state, timeout })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROTOCOL — CIRCUIT BREAKER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Configure circuit breaker.
   *
   * @param threshold - Number of failures before opening
   * @param resetAfter - Duration to wait before half-open (e.g., "30 seconds")
   */
  circuitBreaker(threshold: number, resetAfter: string): ChannelBuilder {
    const circuitBreaker = new CircuitBreakerConfig({
      threshold,
      resetAfter,
      state: "closed" as CircuitState,
      failureCount: 0,
    })

    return new ChannelBuilder({ ...this.state, circuitBreaker })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROTOCOL — BACKPRESSURE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Configure backpressure handling.
   *
   * @param strategy - "block", "drop-oldest", "drop-newest", or "error"
   * @param capacity - Buffer capacity before strategy kicks in
   */
  backpressure(strategy: BackpressureStrategy, capacity: number): ChannelBuilder {
    const backpressure = new BackpressureConfig({
      strategy,
      capacity,
    })

    return new ChannelBuilder({ ...this.state, backpressure })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROTOCOL — RETRY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Configure retry behavior.
   *
   * @param times - Number of retry attempts
   * @param backoff - Backoff strategy: "fixed", "exponential", or "fibonacci"
   * @param initialDelay - Initial delay between retries (e.g., "100 millis")
   * @param maxDelay - Maximum delay (optional)
   */
  retry(
    times: number,
    backoff: "fixed" | "exponential" | "fibonacci" = "exponential",
    initialDelay: string = "100 millis",
    maxDelay?: string
  ): ChannelBuilder {
    const retry = new RetryConfig({
      times,
      backoff,
      initialDelay,
      maxDelay,
    })

    return new ChannelBuilder({ ...this.state, retry })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build the ChannelState from the accumulated configuration.
   *
   * Returns an Effect that:
   * 1. Validates the topology (all wires connect valid endpoints)
   * 2. Creates the protocol configuration
   * 3. Initializes metrics
   * 4. Returns the complete ChannelState
   */
  build(): Effect.Effect<ChannelState, ChannelBuilderError> {
    const self = this
    return Effect.gen(function* () {
      // Validate topology
      yield* self.validateTopology()

      // Build protocol
      const protocol = new ChannelProtocol({
        timeout: self.state.timeout,
        circuitBreaker: self.state.circuitBreaker,
        backpressure: self.state.backpressure,
        retry: self.state.retry,
      })

      // Build topology
      const topology = new ChannelTopology({
        inlets: Array.from(self.state.inlets.values()),
        outlets: Array.from(self.state.outlets.values()),
        junctions: Array.from(self.state.junctions.values()),
        wires: self.state.wires,
      })

      // Initialize metrics
      const metrics = new ChannelMetrics({
        messagesIn: 0,
        messagesOut: 0,
        bytesIn: 0,
        bytesOut: 0,
        errors: 0,
        latencyMs: 0,
        uptime: 0,
      })

      // Build state
      const channelState = new ChannelState({
        id: self.state.id as ChannelId,
        name: self.state.name,
        status: "idle",
        topology,
        protocol,
        metrics,
        createdAt: Date.now(),
        openedAt: undefined,
        closedAt: undefined,
      })

      return channelState
    })
  }

  /**
   * Build the ChannelConfig (lighter weight, for registration).
   */
  buildConfig(): ChannelConfig {
    const protocol = new ChannelProtocol({
      timeout: this.state.timeout,
      circuitBreaker: this.state.circuitBreaker,
      backpressure: this.state.backpressure,
      retry: this.state.retry,
    })

    return new ChannelConfig({
      id: this.state.id,
      name: this.state.name,
      description: this.state.description,
      protocol,
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ══════════════════════════════════════════════════════════════════════════

  private validateTopology(): Effect.Effect<void, ChannelBuilderError> {
    const self = this
    return Effect.gen(function* () {
      // Validate all wires connect to existing components
      for (const wire of self.state.wires) {
        const fromExists =
          self.isValidFromEndpoint(wire.from as string) ||
          self.isJunction(wire.from as string)
        const toExists =
          self.isValidToEndpoint(wire.to as string) ||
          self.isJunction(wire.to as string)

        if (!fromExists) {
          yield* Effect.fail(
            new ChannelBuilderError({
              message: `Wire source "${wire.from}" does not exist`,
              code: "INVALID_WIRE_SOURCE",
            })
          )
        }

        if (!toExists) {
          yield* Effect.fail(
            new ChannelBuilderError({
              message: `Wire target "${wire.to}" does not exist`,
              code: "INVALID_WIRE_TARGET",
            })
          )
        }
      }

      // Validate at least one inlet
      if (self.state.inlets.size === 0) {
        yield* Effect.fail(
          new ChannelBuilderError({
            message: "Channel must have at least one inlet",
            code: "NO_INLETS",
          })
        )
      }

      // Validate at least one outlet
      if (self.state.outlets.size === 0) {
        yield* Effect.fail(
          new ChannelBuilderError({
            message: "Channel must have at least one outlet",
            code: "NO_OUTLETS",
          })
        )
      }
    })
  }

  private isValidFromEndpoint(id: string): boolean {
    // From can be inlet or junction
    for (const inlet of this.state.inlets.values()) {
      if (inlet.id === id) return true
    }
    return false
  }

  private isValidToEndpoint(id: string): boolean {
    // To can be outlet or junction
    for (const outlet of this.state.outlets.values()) {
      if (outlet.id === id) return true
    }
    return false
  }

  private isJunction(id: string): boolean {
    for (const junction of this.state.junctions.values()) {
      if (junction.id === id) return true
    }
    return false
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INSPECTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get a summary of the current builder state.
   */
  inspect(): BuilderInspection {
    return {
      id: this.state.id,
      name: this.state.name,
      inletCount: this.state.inlets.size,
      outletCount: this.state.outlets.size,
      junctionCount: this.state.junctions.size,
      wireCount: this.state.wires.length,
      hasTimeout: !!this.state.timeout,
      hasCircuitBreaker: !!this.state.circuitBreaker,
      hasBackpressure: !!this.state.backpressure,
      hasRetry: !!this.state.retry,
    }
  }
}

// ============================================================================
// ERROR TYPE
// ============================================================================

export class ChannelBuilderError extends Schema.TaggedError<ChannelBuilderError>()(
  "ChannelBuilderError",
  {
    message: Schema.String,
    code: Schema.Literal(
      "INVALID_WIRE_SOURCE",
      "INVALID_WIRE_TARGET",
      "NO_INLETS",
      "NO_OUTLETS",
      "DUPLICATE_ID",
      "INVALID_CONFIG"
    ),
  }
) {}

// ============================================================================
// INSPECTION TYPE
// ============================================================================

export interface BuilderInspection {
  readonly id: string
  readonly name: string
  readonly inletCount: number
  readonly outletCount: number
  readonly junctionCount: number
  readonly wireCount: number
  readonly hasTimeout: boolean
  readonly hasCircuitBreaker: boolean
  readonly hasBackpressure: boolean
  readonly hasRetry: boolean
}
