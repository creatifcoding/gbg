/**
 * NEX Schemas
 *
 * Effect Schema definitions for NEX protocol messages:
 * - Auction requests/responses
 * - Workload management
 * - Lifecycle events
 *
 * @module nex/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** Unique identifier for a NEX node */
export const NodeId = Schema.String.pipe(Schema.brand('NodeId'))
export type NodeId = Schema.Schema.Type<typeof NodeId>

/** Unique identifier for a workload */
export const WorkloadId = Schema.String.pipe(Schema.brand('WorkloadId'))
export type WorkloadId = Schema.Schema.Type<typeof WorkloadId>

/** Unique identifier for an auction bidder */
export const BidderId = Schema.String.pipe(Schema.brand('BidderId'))
export type BidderId = Schema.Schema.Type<typeof BidderId>

/** NEX namespace */
export const Namespace = Schema.String.pipe(Schema.brand('Namespace'))
export type Namespace = Schema.Schema.Type<typeof Namespace>

// =============================================================================
// Workload Lifecycle
// =============================================================================

/** Workload lifecycle types */
export const WorkloadLifecycle = Schema.Literal('service', 'job', 'function')
export type WorkloadLifecycle = Schema.Schema.Type<typeof WorkloadLifecycle>

/** Workload status */
export const WorkloadStatus = Schema.Literal(
  'pending',
  'starting',
  'running',
  'stopping',
  'stopped',
  'failed'
)
export type WorkloadStatus = Schema.Schema.Type<typeof WorkloadStatus>

// =============================================================================
// Auction Protocol
// =============================================================================

/** Auction request - sent to find nodes that can run a workload */
export const AuctionRequest = Schema.Struct({
  /** Agent type (e.g., 'native', 'wasm') */
  type: Schema.String,
  /** Tags for placement filtering */
  tags: Schema.Record({ key: Schema.String, value: Schema.String }),
  /** Requested lifecycle */
  lifecycle: WorkloadLifecycle,
})
export type AuctionRequest = Schema.Schema.Type<typeof AuctionRequest>

/** Auction response - node's bid to run the workload */
export const AuctionResponse = Schema.Struct({
  /** Bidder's unique ID */
  bidderId: Schema.String,
  /** Node ID */
  nodeId: Schema.String,
  /** Node's tags */
  tags: Schema.Record({ key: Schema.String, value: Schema.String }),
  /** Supported lifecycles */
  lifecycles: Schema.Array(WorkloadLifecycle),
})
export type AuctionResponse = Schema.Schema.Type<typeof AuctionResponse>

// =============================================================================
// Workload Management
// =============================================================================

/** Request to start a workload */
export const StartWorkloadRequest = Schema.Struct({
  /** Workload name */
  name: Schema.String,
  /** Optional description */
  description: Schema.optional(Schema.String),
  /** Agent type */
  type: Schema.String,
  /** Lifecycle type */
  lifecycle: WorkloadLifecycle,
  /** Agent-specific start parameters */
  startRequest: Schema.Unknown,
  /** Placement tags */
  tags: Schema.Record({ key: Schema.String, value: Schema.String }),
})
export type StartWorkloadRequest = Schema.Schema.Type<typeof StartWorkloadRequest>

/** Response after workload deployment */
export const WorkloadDeployResponse = Schema.Struct({
  /** Assigned workload ID */
  workloadId: Schema.String,
  /** Node hosting the workload */
  nodeId: Schema.String,
  /** Initial status */
  status: Schema.String,
})
export type WorkloadDeployResponse = Schema.Schema.Type<typeof WorkloadDeployResponse>

/** Single workload info */
export const WorkloadInfo = Schema.Struct({
  workloadId: Schema.String,
  name: Schema.String,
  type: Schema.String,
  lifecycle: Schema.String,
  nodeId: Schema.String,
  status: Schema.optional(Schema.String),
  startedAt: Schema.optional(Schema.String),
})
export type WorkloadInfo = Schema.Schema.Type<typeof WorkloadInfo>

/** Response listing workloads */
export const WorkloadListResponse = Schema.Struct({
  workloads: Schema.Array(WorkloadInfo),
})
export type WorkloadListResponse = Schema.Schema.Type<typeof WorkloadListResponse>

/** Request to stop a workload */
export const StopWorkloadRequest = Schema.Struct({
  workloadId: Schema.String,
})
export type StopWorkloadRequest = Schema.Schema.Type<typeof StopWorkloadRequest>

// =============================================================================
// RPC Protocol
// =============================================================================

/** RPC request envelope */
export const RpcRequest = Schema.Struct({
  /** Method name */
  method: Schema.String,
  /** Method parameters */
  params: Schema.Unknown,
})
export type RpcRequest = Schema.Schema.Type<typeof RpcRequest>

/** RPC response envelope */
export const RpcResponse = Schema.Struct({
  /** Result data (if success) */
  result: Schema.Unknown,
  /** Error message (if failure) */
  error: Schema.optional(Schema.String),
})
export type RpcResponse = Schema.Schema.Type<typeof RpcResponse>

// =============================================================================
// Lifecycle Events
// =============================================================================

/** Workload started event */
export const WorkloadStartedEvent = Schema.TaggedStruct('WorkloadStarted', {
  workloadId: Schema.String,
  nodeId: Schema.String,
  name: Schema.String,
  namespace: Schema.String,
  type: Schema.String,
  lifecycle: Schema.String,
  timestamp: Schema.optional(Schema.String),
})
export type WorkloadStartedEvent = Schema.Schema.Type<typeof WorkloadStartedEvent>

/** Workload stopped event */
export const WorkloadStoppedEvent = Schema.TaggedStruct('WorkloadStopped', {
  workloadId: Schema.String,
  nodeId: Schema.String,
  error: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Number),
  timestamp: Schema.optional(Schema.String),
})
export type WorkloadStoppedEvent = Schema.Schema.Type<typeof WorkloadStoppedEvent>

/** Node started event */
export const NodeStartedEvent = Schema.TaggedStruct('NodeStarted', {
  nodeId: Schema.String,
  name: Schema.String,
  namespace: Schema.String,
  timestamp: Schema.optional(Schema.String),
})
export type NodeStartedEvent = Schema.Schema.Type<typeof NodeStartedEvent>

/** Node stopped event */
export const NodeStoppedEvent = Schema.TaggedStruct('NodeStopped', {
  nodeId: Schema.String,
  timestamp: Schema.optional(Schema.String),
})
export type NodeStoppedEvent = Schema.Schema.Type<typeof NodeStoppedEvent>

/** Union of all NEX lifecycle events */
export const NexEvent = Schema.Union(
  WorkloadStartedEvent,
  WorkloadStoppedEvent,
  NodeStartedEvent,
  NodeStoppedEvent
)
export type NexEvent = Schema.Schema.Type<typeof NexEvent>

// =============================================================================
// Log Entry
// =============================================================================

/** Parsed log entry from workload */
export const LogEntry = Schema.Struct({
  /** Workload ID */
  workloadId: Schema.String,
  /** Output stream (stdout/stderr) */
  stream: Schema.Literal('stdout', 'stderr'),
  /** Log content */
  data: Schema.String,
  /** Timestamp when received */
  timestamp: Schema.Date,
})
export type LogEntry = Schema.Schema.Type<typeof LogEntry>
