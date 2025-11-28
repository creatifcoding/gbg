/**
 * Encode with Transferables
 *
 * Worker.Options.encode implementation that registers ArrayBuffers
 * with Effect's Transferable collector for zero-copy transfer.
 *
 * @remarks
 * - Uses Transferable.addAll to register numeric buffers
 * - Must be used with makePoolSerialized for proper transfer handling
 * - After transfer, original ArrayBuffers become detached (length 0)
 *
 * ARCHITECTURE NOTE:
 * The encode function is called by the Worker platform when sending messages.
 * By calling Transferable.addAll inside encode, we register the ArrayBuffers
 * so that postMessage is called with the correct transfer list.
 */

import * as Effect from 'effect/Effect';
import * as Transferable from '@effect/platform/Transferable';
import type { ProcessorRequest, RawTableBinary } from './worker-protocol';

/**
 * Extract all ArrayBuffers from a RawTableBinary that should be transferred.
 *
 * @param raw - Binary table representation
 * @returns Array of ArrayBuffers to transfer
 */
function extractTransferableBuffers(raw: RawTableBinary): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  for (const key of Object.keys(raw.numericBuffers)) {
    const buffer = raw.numericBuffers[key];
    if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) {
      buffers.push(buffer);
    }
  }
  return buffers;
}

/**
 * Encode function for Worker.Options that registers Transferables.
 *
 * This function is called by makeManager/makePoolSerialized when sending
 * a message to the worker. It:
 * 1. Inspects the request for Process requests with binary data
 * 2. Extracts ArrayBuffers from the RawTableBinary payload
 * 3. Registers them with Transferable.addAll for zero-copy transfer
 *
 * IMPORTANT: After the message is sent, the ArrayBuffers in the request
 * will be detached (neutered). Do not reuse the RawTableBinary after sending.
 *
 * @example
 * ```ts
 * const poolLayer = Worker.makePoolSerializedLayer({
 *   encode: encodeWithTransferables,
 *   // ... other options
 * });
 * ```
 *
 * @param message - The message to encode (ProcessorRequest)
 * @returns Effect that registers Transferables and returns the message
 */
export function encodeWithTransferables<A extends ProcessorRequest>(
  message: A,
): Effect.Effect<A> {
  // Only Process requests have transferable buffers
  if (message._tag === 'Process') {
    const raw = message.payload.raw;
    const buffers = extractTransferableBuffers(raw);

    if (buffers.length > 0) {
      // Register all ArrayBuffers with the Transferable collector.
      // This tells the Worker platform to include them in the transfer list
      // when calling postMessage, enabling zero-copy transfer.
      return Effect.as(Transferable.addAll(buffers), message);
    }
  }

  // Return the original message (schemas handle serialization)
  return Effect.succeed(message);
}

/**
 * Type-safe encode wrapper that asserts the message type.
 * Use this when you need explicit typing in the layer configuration.
 */
export const createEncodeFunction = <R extends ProcessorRequest>(): ((
  message: R,
) => Effect.Effect<R>) => {
  return (message: R) => encodeWithTransferables(message) as Effect.Effect<R>;
};

/**
 * Decode function (identity) - responses don't need special handling.
 *
 * Worker responses are decoded by the schema layer. This decode function
 * is provided for symmetry and potential future use (e.g., reconstructing
 * typed arrays from transferred buffers if the worker sends buffers back).
 */
export function decodeResponse<A>(message: A): Effect.Effect<A> {
  return Effect.succeed(message);
}
