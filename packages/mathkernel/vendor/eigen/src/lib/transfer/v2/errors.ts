/**
 * Transfer v2 Error Types
 *
 * Tagged errors for the Effect error channel.
 * See: src/lib/transfer/docs/redesign/02-transfer-schema-redesign.md
 *
 * @since v2
 */
import { Data, Schema } from 'effect'

/**
 * Error raised when a transfer is rejected by the target scope.
 * Carries the targetId, reason, and optionally the token that was rejected.
 */
export class TransferRejectError extends Data.TaggedError('TransferRejectError')<{
  readonly targetId: string
  readonly reason: string
  readonly tokenId?: string | undefined
}> {}

/**
 * Error raised when token decoding fails (clipboard paste, drag data).
 */
export class TransferDecodeError extends Data.TaggedError('TransferDecodeError')<{
  readonly input: string
  readonly cause: unknown
}> {}

/**
 * Error raised when a scope is not found in the bus registry.
 */
export class TransferScopeNotFoundError extends Data.TaggedError('TransferScopeNotFoundError')<{
  readonly surfaceId: string
}> {}
