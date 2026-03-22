/**
 * NEX Error Types
 *
 * Tagged errors for NEX operations using Effect's Data.TaggedError pattern.
 *
 * @module nex/errors
 */

import { Data, ParseResult } from 'effect'

// =============================================================================
// Decode Errors
// =============================================================================

/** Error decoding a NATS message */
export class DecodeError extends Data.TaggedError('DecodeError')<{
  readonly message: string
  readonly cause: ParseResult.ParseError
}> {}

// =============================================================================
// NEX Client Errors
// =============================================================================

/** Generic NEX operation error */
export class NexError extends Data.TaggedError('NexError')<{
  readonly message: string
  readonly operation: string
  readonly cause?: unknown
}> {}

/** Auction failed (no bidders, timeout) */
export class AuctionError extends Data.TaggedError('AuctionError')<{
  readonly message: string
  readonly type: string
  readonly tags: Record<string, string>
}> {}

/** Workload deployment failed */
export class DeployError extends Data.TaggedError('DeployError')<{
  readonly message: string
  readonly workloadName: string
  readonly bidderId: string
  readonly cause?: unknown
}> {}

/** Workload not found */
export class WorkloadNotFoundError extends Data.TaggedError('WorkloadNotFoundError')<{
  readonly workloadId: string
}> {}

// =============================================================================
// RPC Errors
// =============================================================================

/** RPC call failed */
export class RpcError extends Data.TaggedError('RpcError')<{
  readonly message: string
  readonly method?: string
  readonly subject?: string
  readonly cause?: unknown
}> {}

/** RPC timeout */
export class RpcTimeoutError extends Data.TaggedError('RpcTimeoutError')<{
  readonly subject: string
  readonly method: string
  readonly timeoutMs: number
}> {}

// =============================================================================
// Event Errors
// =============================================================================

/** Failed to subscribe to events */
export class EventSubscriptionError extends Data.TaggedError('EventSubscriptionError')<{
  readonly message: string
  readonly subject: string
  readonly cause?: unknown
}> {}
