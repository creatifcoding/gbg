/**
 * TMNL DataManager v1 - Namespace Types
 *
 * Type definitions for kernel namespacing, enabling reusable atom shapes
 * across different kernel types (search, senml, websocket, etc.)
 *
 * @experimental v1 API - additive extension to existing v1
 */

import type { Stream } from "effect"
import type { Atom } from "@effect-atom/atom"

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Namespace key format: `${kernelType}:${instanceName}`
 *
 * Examples:
 * - "search:movies" - SearchKernel for movie data
 * - "search:users" - SearchKernel for user data
 * - "senml:telemetry" - SenML kernel for IoT telemetry
 * - "websocket:trading" - WebSocket kernel for trading data
 */
export type NamespaceKey = `${KernelType}:${string}`

/**
 * Kernel type discriminator (extensible)
 */
export type KernelType = "search" | "senml" | "websocket" | "transform"

/**
 * Parse namespace key into components
 */
export interface NamespaceParts {
  readonly type: KernelType
  readonly instance: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Common Atom Shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StreamStatus - universal across all streaming kernels
 */
export type StreamStatus = "idle" | "streaming" | "complete" | "cancelled" | "error"

/**
 * StreamStats - universal metrics for any stream
 */
export interface StreamStats {
  readonly chunks: number
  readonly items: number
  readonly ms: number
  readonly throughput?: number
}

/**
 * Generic result with score (search, relevance, confidence)
 */
export interface ScoredResult<T> {
  readonly item: T
  readonly score: number
  readonly metadata?: Record<string, unknown>
}

/**
 * NamespaceAtoms - the common atom shape all kernels publish
 *
 * This is the "materialized view" contract that any kernel can fulfill.
 * Different kernel types may interpret these differently:
 *
 * - SearchKernel: results = search hits, score = relevance
 * - SenMLKernel: results = sensor readings, score = confidence
 * - WebSocketKernel: results = messages, score = priority
 *
 * @template T - Item type in the stream
 */
export interface NamespaceAtoms<T = unknown> {
  /** Progressive results from stream */
  readonly results: Atom.Atom<readonly ScoredResult<T>[]>

  /** Current stream status */
  readonly status: Atom.Atom<StreamStatus>

  /** Stream statistics */
  readonly stats: Atom.Atom<StreamStats>

  /** Current query/filter string */
  readonly query: Atom.Atom<string>

  /** Operation in progress (indexing, connecting, etc.) */
  readonly isProcessing: Atom.Atom<boolean>

  /** Last error if status === "error" */
  readonly lastError: Atom.Atom<Error | null>
}

// ─────────────────────────────────────────────────────────────────────────────
// Kernel Shape Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KernelShape - what a kernel instance provides
 *
 * Every kernel implements this interface plus kernel-specific extensions.
 * The atoms are created via the namespace family, ensuring proper scoping.
 *
 * @template T - Item type
 * @template Q - Query type (SearchQuery, SenMLFilter, etc.)
 */
export interface KernelShape<T = unknown, Q = unknown> {
  /** Kernel type identifier */
  readonly type: KernelType

  /** Instance name within the type namespace */
  readonly instance: string

  /** Full namespace key */
  readonly namespaceKey: NamespaceKey

  /** Stream data matching query */
  readonly stream: (query: Q) => Stream.Stream<ScoredResult<T>>

  /** Atoms for this namespace (from family) */
  readonly atoms: NamespaceAtoms<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Kernel Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base config for creating kernel instances
 */
export interface KernelConfig {
  /** Instance name (unique within kernel type) */
  readonly instance: string

  /** Optional: pre-warm the kernel on creation */
  readonly warmUp?: boolean

  /** Optional: dispose atoms when kernel is released */
  readonly autoDispose?: boolean
}

/**
 * SearchKernel specific config
 */
export interface SearchKernelConfig extends KernelConfig {
  readonly driver?: "flex" | "linear"
  readonly fields?: readonly string[]
}

/**
 * SenML kernel config (future)
 */
export interface SenMLKernelConfig extends KernelConfig {
  readonly endpoint: string
  readonly protocol?: "websocket" | "webtransport"
  readonly bufferSize?: number
}
