/**
 * TMNL DataManager v2 - Universal DAQ Kernel Types
 *
 * Type definitions for the Universal Data Acquisition kernel system.
 * Adapts to ANY data source: network, filesystem, serial/hardware, search, custom.
 *
 * @experimental v2 API - Universal DAQ pattern
 */

import type { Stream, Effect, Scope } from "effect"
import type { Atom } from "@effect-atom/atom"

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Namespace key format: `${kernelType}:${instanceName}`
 *
 * Examples:
 * - "search:movies" - SearchKernel for movie data
 * - "network:trading" - WebSocket kernel for trading data
 * - "filesystem:logs" - File watcher for log files
 * - "serial:arduino" - Serial port kernel for hardware
 */
export type NamespaceKey = `${KernelType}:${string}`

/**
 * Universal DAQ Kernel Types
 *
 * Extensible union for all supported data acquisition sources.
 */
export type KernelType =
  | "search"      // FlexSearch, Linear, future backends
  | "network"     // WebSocket, WebTransport, SSE, HTTP polling
  | "filesystem"  // File watch, directory scan, log tail
  | "serial"      // Web Serial API
  | "hardware"    // WebUSB, WebHID
  | "custom"      // User-defined kernels

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
export type StreamStatus =
  | "idle"        // No operation in progress
  | "connecting"  // Establishing connection (network/serial)
  | "streaming"   // Data flowing
  | "paused"      // Temporarily paused
  | "complete"    // Stream finished (search)
  | "cancelled"   // User-cancelled
  | "error"       // Error occurred

/**
 * StreamStats - universal metrics for any stream
 */
export interface StreamStats {
  readonly chunks: number
  readonly items: number
  readonly ms: number
  readonly throughput?: number
  readonly bytesReceived?: number  // Network/serial kernels
  readonly latencyMs?: number      // Network kernels
}

/**
 * Generic result with score (search, relevance, confidence)
 */
export interface ScoredResult<T> {
  readonly item: T
  readonly score: number
  readonly metadata?: Record<string, unknown>
  readonly timestamp?: number  // Useful for streaming data
}

/**
 * NamespaceAtoms - the common atom shape all kernels publish
 *
 * This is the "materialized view" contract that any kernel can fulfill.
 * Different kernel types interpret these differently:
 *
 * - SearchKernel: results = search hits, score = relevance
 * - NetworkKernel: results = messages, score = priority
 * - FilesystemKernel: results = file events, score = 1.0
 * - SerialKernel: results = data packets, score = 1.0
 *
 * @template T - Item type in the stream
 */
export interface NamespaceAtoms<T = unknown> {
  /** Progressive results from stream */
  readonly results: Atom.Writable<readonly ScoredResult<T>[]>

  /** Current stream status */
  readonly status: Atom.Writable<StreamStatus>

  /** Stream statistics */
  readonly stats: Atom.Writable<StreamStats>

  /** Current query/filter string */
  readonly query: Atom.Writable<string>

  /** Operation in progress (indexing, connecting, etc.) */
  readonly isProcessing: Atom.Writable<boolean>

  /** Last error if status === "error" */
  readonly lastError: Atom.Writable<Error | null>
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
 * @template Q - Query type (SearchQuery, NetworkMessage, etc.)
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

  /** Dispose resources */
  readonly dispose: () => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Kernel Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base config for all kernel types
 */
export interface KernelConfig {
  /** Instance name (unique within kernel type) */
  readonly instance: string

  /** Pre-warm the kernel on creation */
  readonly warmUp?: boolean

  /** Dispose atoms when kernel is released */
  readonly autoDispose?: boolean

  /** Buffer size for streaming kernels */
  readonly bufferSize?: number

  /** Enable reconnection logic (network/serial) */
  readonly reconnect?: boolean

  /** Max reconnection attempts */
  readonly maxReconnectAttempts?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Kernel Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search kernel configuration
 */
export interface SearchKernelConfig extends KernelConfig {
  readonly driver?: "flex" | "linear"
  readonly fields?: readonly string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Kernel Configs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WebSocket kernel configuration
 */
export interface WebSocketKernelConfig extends KernelConfig {
  readonly url: string
  readonly protocols?: readonly string[]
  readonly heartbeatMs?: number
  readonly binaryType?: "arraybuffer" | "blob"
}

/**
 * Server-Sent Events kernel configuration
 */
export interface SSEKernelConfig extends KernelConfig {
  readonly url: string
  readonly withCredentials?: boolean
  readonly eventTypes?: readonly string[]  // Filter specific event types
}

/**
 * HTTP polling kernel configuration
 */
export interface PollingKernelConfig extends KernelConfig {
  readonly url: string
  readonly intervalMs: number
  readonly method?: "GET" | "POST"
  readonly headers?: Record<string, string>
  readonly body?: unknown
}

/**
 * WebTransport kernel configuration (experimental)
 */
export interface WebTransportKernelConfig extends KernelConfig {
  readonly url: string
  readonly serverCertificateHashes?: readonly ArrayBuffer[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem Kernel Configs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * File watch kernel configuration
 */
export interface FileWatchKernelConfig extends KernelConfig {
  readonly path: string
  readonly recursive?: boolean
  readonly debounceMs?: number
  readonly filter?: string  // Glob pattern
}

/**
 * Directory scan kernel configuration
 */
export interface DirectoryScanKernelConfig extends KernelConfig {
  readonly path: string
  readonly pattern?: string  // Glob pattern
  readonly recursive?: boolean
  readonly includeHidden?: boolean
}

/**
 * Log tail kernel configuration
 */
export interface LogTailKernelConfig extends KernelConfig {
  readonly path: string
  readonly fromEnd?: number  // Lines from end to start
  readonly follow?: boolean
  readonly encoding?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Serial/Hardware Kernel Configs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Web Serial API kernel configuration
 */
export interface SerialKernelConfig extends KernelConfig {
  readonly baudRate: number
  readonly dataBits?: 7 | 8
  readonly stopBits?: 1 | 2
  readonly parity?: "none" | "even" | "odd"
  readonly flowControl?: "none" | "hardware"
  readonly filters?: readonly SerialPortFilter[]
}

/**
 * Serial port filter for device selection
 */
export interface SerialPortFilter {
  readonly usbVendorId?: number
  readonly usbProductId?: number
}

/**
 * WebUSB kernel configuration
 */
export interface USBKernelConfig extends KernelConfig {
  readonly filters: readonly USBDeviceFilter[]
}

/**
 * USB device filter
 */
export interface USBDeviceFilter {
  readonly vendorId?: number
  readonly productId?: number
  readonly classCode?: number
  readonly subclassCode?: number
  readonly protocolCode?: number
  readonly serialNumber?: string
}

/**
 * WebHID kernel configuration
 */
export interface HIDKernelConfig extends KernelConfig {
  readonly filters: readonly HIDDeviceFilter[]
}

/**
 * HID device filter
 */
export interface HIDDeviceFilter {
  readonly vendorId?: number
  readonly productId?: number
  readonly usagePage?: number
  readonly usage?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Kernel Config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Custom kernel configuration
 *
 * For user-defined kernel implementations
 */
export interface CustomKernelConfig<T = unknown, Q = unknown> extends KernelConfig {
  /** Factory function to create kernel stream */
  readonly factory: (query: Q) => Stream.Stream<T, Error, Scope.Scope>

  /** Optional transformer for items */
  readonly transform?: (item: T) => ScoredResult<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Kernel Factory Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel factory function signature
 */
export type KernelFactory<T, Q, C extends KernelConfig> = (
  config: C
) => Effect.Effect<KernelShape<T, Q>, Error, Scope.Scope>

/**
 * Union type for all kernel configs
 */
export type AnyKernelConfig =
  | SearchKernelConfig
  | WebSocketKernelConfig
  | SSEKernelConfig
  | PollingKernelConfig
  | WebTransportKernelConfig
  | FileWatchKernelConfig
  | DirectoryScanKernelConfig
  | LogTailKernelConfig
  | SerialKernelConfig
  | USBKernelConfig
  | HIDKernelConfig
  | CustomKernelConfig

// ─────────────────────────────────────────────────────────────────────────────
// Search Types (from v1, for compatibility)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search query parameters
 */
export interface SearchQuery {
  readonly query: string
  readonly limit?: number
  readonly offset?: number
  readonly threshold?: number
  readonly suggest?: boolean
}

/**
 * Field match for search highlighting
 */
export interface FieldMatch {
  readonly field: string
  readonly snippet: string
  readonly positions?: readonly [number, number][]
}

/**
 * Search result with matches
 */
export interface SearchResult<T> extends ScoredResult<T> {
  readonly matches?: readonly FieldMatch[]
}
