/**
 * @fileoverview DataTransferService - Effect.Service for actual data flow between ports
 *
 * BEDROCK LAYER: This handles the actual transfer of data between blocks.
 * - Each output port has an Effect.PubSub (broadcast to subscribers)
 * - Each input port has an Effect.Queue (buffer incoming data)
 * - Links wire source pubsub → target queue
 *
 * Simple block API:
 * - Output: push(data) → broadcasts to all linked inputs
 * - Input: stream → Effect.Stream of incoming data
 */

import { Effect, PubSub, Queue, Stream, Fiber, Ref, Layer, pipe, Scope } from 'effect';
import type { PortId, LinkId, BlockId } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

/** Configuration for creating a port's data channel */
export interface PortChannelConfig {
  readonly portId: PortId;
  readonly blockId: BlockId;
  readonly direction: 'in' | 'out' | 'inout';
  readonly capacity?: number; // Queue/PubSub capacity, default unbounded
}

/** Internal port channel state */
interface PortChannel<T = unknown> {
  readonly portId: PortId;
  readonly blockId: BlockId;
  readonly direction: 'in' | 'out' | 'inout';
  /** For output ports: PubSub to broadcast data */
  readonly pubsub: PubSub.PubSub<T> | null;
  /** For input ports: Queue to buffer incoming data */
  readonly queue: Queue.Queue<T> | null;
}

/** Active link wiring (fiber that pipes source → target) */
interface LinkWiring {
  readonly linkId: LinkId;
  readonly sourcePortId: PortId;
  readonly targetPortId: PortId;
  readonly fiber: Fiber.RuntimeFiber<void, never>;
}

/** Service state */
interface DataTransferState {
  readonly channels: ReadonlyMap<PortId, PortChannel>;
  readonly wirings: ReadonlyMap<LinkId, LinkWiring>;
}

const initialState: DataTransferState = {
  channels: new Map(),
  wirings: new Map(),
};

// =============================================================================
// Service Interface
// =============================================================================

export interface DataTransferServiceShape {
  /**
   * Create a data channel for a port.
   * - Output ports get a PubSub (broadcast)
   * - Input ports get a Queue (buffer)
   * - Inout ports get both
   */
  readonly createChannel: (config: PortChannelConfig) => Effect.Effect<void>;

  /**
   * Destroy a port's data channel.
   * Also removes any link wirings connected to this port.
   */
  readonly destroyChannel: (portId: PortId) => Effect.Effect<void>;

  /**
   * Push data to an output port.
   * Data is broadcast to all subscribers (linked input ports).
   */
  readonly push: <T>(portId: PortId, data: T) => Effect.Effect<void>;

  /**
   * Get a stream of data from an input port.
   * Returns Effect.Stream that yields data as it arrives.
   */
  readonly getInputStream: <T>(portId: PortId) => Effect.Effect<Stream.Stream<T, never, never>>;

  /**
   * Wire a link: subscribe source port's pubsub to target port's queue.
   * Data pushed to source will flow to target.
   */
  readonly wireLink: (
    linkId: LinkId,
    sourcePortId: PortId,
    targetPortId: PortId
  ) => Effect.Effect<void>;

  /**
   * Unwire a link: stop the data flow fiber.
   */
  readonly unwireLink: (linkId: LinkId) => Effect.Effect<void>;

  /**
   * Check if a port has a channel.
   */
  readonly hasChannel: (portId: PortId) => Effect.Effect<boolean>;

  /**
   * Get all active link wirings.
   */
  readonly getActiveWirings: () => Effect.Effect<ReadonlyArray<LinkWiring>>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class DataTransferService extends Effect.Service<DataTransferService>()(
  'tmnl/DataTransferService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<DataTransferState>(initialState);
      const scope = yield* Scope.make();

      // -----------------------------------------------------------------------
      // Channel Management
      // -----------------------------------------------------------------------

      const createChannel = (config: PortChannelConfig) =>
        Effect.gen(function* () {
          const { portId, blockId, direction, capacity } = config;

          // Create PubSub for output capability
          const pubsub =
            direction === 'out' || direction === 'inout'
              ? yield* (capacity
                  ? PubSub.bounded<unknown>(capacity)
                  : PubSub.unbounded<unknown>())
              : null;

          // Create Queue for input capability
          const queue =
            direction === 'in' || direction === 'inout'
              ? yield* (capacity
                  ? Queue.bounded<unknown>(capacity)
                  : Queue.unbounded<unknown>())
              : null;

          const channel: PortChannel = {
            portId,
            blockId,
            direction,
            pubsub,
            queue,
          };

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            channels: new Map([...s.channels, [portId, channel]]),
          }));
        });

      const destroyChannel = (portId: PortId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          const channel = state.channels.get(portId);

          if (!channel) return;

          // Shutdown PubSub and Queue
          if (channel.pubsub) {
            yield* PubSub.shutdown(channel.pubsub);
          }
          if (channel.queue) {
            yield* Queue.shutdown(channel.queue);
          }

          // Remove any wirings connected to this port
          const wiringIds = [...state.wirings.entries()]
            .filter(
              ([, w]) => w.sourcePortId === portId || w.targetPortId === portId
            )
            .map(([id]) => id);

          for (const linkId of wiringIds) {
            yield* unwireLink(linkId);
          }

          yield* Ref.update(stateRef, (s) => {
            const channels = new Map(s.channels);
            channels.delete(portId);
            return { ...s, channels };
          });
        });

      // -----------------------------------------------------------------------
      // Data Flow
      // -----------------------------------------------------------------------

      const push = <T>(portId: PortId, data: T) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          const channel = state.channels.get(portId);

          if (!channel?.pubsub) {
            yield* Effect.logWarning(
              `[DataTransfer] Cannot push to port ${portId}: no pubsub (not an output port?)`
            );
            return;
          }

          yield* PubSub.publish(channel.pubsub, data);
        });

      const getInputStream = <T>(portId: PortId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          const channel = state.channels.get(portId);

          if (!channel?.queue) {
            yield* Effect.logWarning(
              `[DataTransfer] Cannot get stream from port ${portId}: no queue (not an input port?)`
            );
            // Return empty stream
            return Stream.empty as Stream.Stream<T, never, never>;
          }

          // Create stream from queue
          return Stream.fromQueue(channel.queue) as Stream.Stream<T, never, never>;
        });

      // -----------------------------------------------------------------------
      // Link Wiring
      // -----------------------------------------------------------------------

      const wireLink = (
        linkId: LinkId,
        sourcePortId: PortId,
        targetPortId: PortId
      ) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);

          // Check if already wired
          if (state.wirings.has(linkId)) {
            yield* Effect.logWarning(
              `[DataTransfer] Link ${linkId} already wired`
            );
            return;
          }

          const sourceChannel = state.channels.get(sourcePortId);
          const targetChannel = state.channels.get(targetPortId);

          if (!sourceChannel?.pubsub) {
            yield* Effect.logWarning(
              `[DataTransfer] Cannot wire link: source port ${sourcePortId} has no pubsub`
            );
            return;
          }

          if (!targetChannel?.queue) {
            yield* Effect.logWarning(
              `[DataTransfer] Cannot wire link: target port ${targetPortId} has no queue`
            );
            return;
          }

          // Subscribe to source pubsub
          const dequeue = yield* PubSub.subscribe(sourceChannel.pubsub);

          // Create fiber that pipes pubsub → queue
          const fiber = yield* pipe(
            Stream.fromQueue(dequeue),
            Stream.tap((data) => Queue.offer(targetChannel.queue!, data)),
            Stream.runDrain,
            Effect.forkIn(scope)
          );

          const wiring: LinkWiring = {
            linkId,
            sourcePortId,
            targetPortId,
            fiber,
          };

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            wirings: new Map([...s.wirings, [linkId, wiring]]),
          }));

          yield* Effect.log(
            `[DataTransfer] Wired link ${linkId}: ${sourcePortId} → ${targetPortId}`
          );
        });

      const unwireLink = (linkId: LinkId) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          const wiring = state.wirings.get(linkId);

          if (!wiring) return;

          // Interrupt the piping fiber
          yield* Fiber.interrupt(wiring.fiber);

          yield* Ref.update(stateRef, (s) => {
            const wirings = new Map(s.wirings);
            wirings.delete(linkId);
            return { ...s, wirings };
          });

          yield* Effect.log(`[DataTransfer] Unwired link ${linkId}`);
        });

      // -----------------------------------------------------------------------
      // Queries
      // -----------------------------------------------------------------------

      const hasChannel = (portId: PortId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => s.channels.has(portId))
        );

      const getActiveWirings = () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => Array.from(s.wirings.values()))
        );

      // -----------------------------------------------------------------------
      // Return Service Shape
      // -----------------------------------------------------------------------

      return {
        createChannel,
        destroyChannel,
        push,
        getInputStream,
        wireLink,
        unwireLink,
        hasChannel,
        getActiveWirings,
      } satisfies DataTransferServiceShape;
    }),
  }
) {}

// =============================================================================
// Layer
// =============================================================================

export const DataTransferServiceLive = DataTransferService.Default;
