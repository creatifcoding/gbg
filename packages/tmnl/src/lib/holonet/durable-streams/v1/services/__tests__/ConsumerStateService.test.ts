/**
 * ConsumerStateService Tests
 *
 * Unit tests with mocked NatsInnerService.
 */

import { describe, it, expect, vi } from 'vitest';
import { Effect, Layer } from 'effect';
import type { Consumer, ConsumerInfo } from 'nats.ws';

import {
  ConsumerStateService,
  ConsumerStateError,
  ConsumerNotFoundError,
} from '../ConsumerStateService';
import { NatsInnerService } from '@/lib/holonet/nats/inner';
import { Inner } from '@/lib/holonet/nats/errors';

// =============================================================================
// Mock Helpers
// =============================================================================

const createMockConsumer = (name: string): Consumer =>
  ({
    name,
    info: vi.fn().mockResolvedValue({
      name,
      ack_floor: { stream_seq: 10, consumer_seq: 10 },
      delivered: { stream_seq: 15, consumer_seq: 15 },
      num_pending: 5,
      num_redelivered: 1,
    } as unknown as ConsumerInfo),
    next: vi.fn(),
    fetch: vi.fn(),
    consume: vi.fn(),
    delete: vi.fn(),
  }) as unknown as Consumer;

// =============================================================================
// Tests
// =============================================================================

describe('ConsumerStateService', () => {
  describe('consumerName', () => {
    const mockLayer = () => {
      const mockInner = {
        consumers: {
          get: vi.fn(),
          add: vi.fn(),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      return ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );
    };

    it('generates NATS-safe consumer names', () =>
      Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        expect(service.consumerName('my-stream', 'client-123')).toBe(
          'ds-my-stream-client-123'
        );
      }).pipe(Effect.provide(mockLayer()), Effect.runPromise));

    it('sanitizes special characters', () =>
      Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        expect(service.consumerName('my.stream', 'client/123')).toBe(
          'ds-my_stream-client_123'
        );
      }).pipe(Effect.provide(mockLayer()), Effect.runPromise));
  });

  describe('getOrCreateConsumer', () => {
    it('returns existing consumer if found', () => {
      const mockConsumer = createMockConsumer('ds-stream1-client1');
      const mockInner = {
        consumers: {
          get: vi.fn().mockReturnValue(Effect.succeed(mockConsumer)),
          add: vi.fn(),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        const result = yield* service.getOrCreateConsumer('stream1', 'client1');

        expect(result).toBe(mockConsumer);
        expect(mockInner.consumers.get).toHaveBeenCalledWith(
          'stream1',
          'ds-stream1-client1'
        );
        expect(mockInner.consumers.add).not.toHaveBeenCalled();
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });

    it('creates new consumer if not found', () => {
      const mockConsumer = createMockConsumer('ds-stream1-client1');
      let callCount = 0;

      const mockInner = {
        consumers: {
          get: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Effect.fail(
                new Inner.Consumers.GetError({
                  message: 'Consumer not found',
                  streamName: 'stream1',
                  consumerName: 'ds-stream1-client1',
                  cause: new Error('consumer not found'),
                })
              );
            }
            return Effect.succeed(mockConsumer);
          }),
          add: vi.fn().mockReturnValue(Effect.void),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        const result = yield* service.getOrCreateConsumer('stream1', 'client1');

        expect(result).toBe(mockConsumer);
        expect(mockInner.consumers.add).toHaveBeenCalledWith('stream1', {
          durableName: 'ds-stream1-client1',
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          maxAckPending: 100,
          ackWait: 30000,
          maxDeliver: 3,
        });
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });

    it('creates consumer with "all" policy when offset is -1', () => {
      const mockConsumer = createMockConsumer('ds-stream1-client1');
      let callCount = 0;

      const mockInner = {
        consumers: {
          get: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Effect.fail(
                new Inner.Consumers.GetError({
                  message: 'Consumer not found',
                  streamName: 'stream1',
                  consumerName: 'ds-stream1-client1',
                  cause: new Error('consumer not found'),
                })
              );
            }
            return Effect.succeed(mockConsumer);
          }),
          add: vi.fn().mockReturnValue(Effect.void),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        yield* service.getOrCreateConsumer('stream1', 'client1', {
          fromOffset: -1,
        });

        expect(mockInner.consumers.add).toHaveBeenCalledWith('stream1', {
          durableName: 'ds-stream1-client1',
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
          maxAckPending: 100,
          ackWait: 30000,
          maxDeliver: 3,
        });
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });
  });

  describe('getState', () => {
    it('returns consumer state with offset info', () => {
      const mockConsumer = createMockConsumer('ds-stream1-client1');
      const mockInner = {
        consumers: {
          get: vi.fn().mockReturnValue(Effect.succeed(mockConsumer)),
          add: vi.fn(),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        const state = yield* service.getState('stream1', 'client1');

        expect(state.streamId).toBe('stream1');
        expect(state.clientId).toBe('client1');
        expect(state.consumerName).toBe('ds-stream1-client1');
        expect(state.ackFloorSeq).toBe(10);
        expect(state.deliveredSeq).toBe(15);
        expect(state.numPending).toBe(5);
        expect(state.numRedelivered).toBe(1);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });

    it('fails with ConsumerNotFoundError when consumer not found', () => {
      const mockInner = {
        consumers: {
          get: vi.fn().mockReturnValue(
            Effect.fail(
              new Inner.Consumers.GetError({
                message: 'Consumer not found',
                streamName: 'stream1',
                consumerName: 'ds-stream1-client1',
                cause: new Error('consumer not found'),
              })
            )
          ),
          add: vi.fn(),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        const result = yield* service
          .getState('stream1', 'client1')
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ConsumerNotFoundError);
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });
  });

  describe('getOffset', () => {
    it('returns ackFloorSeq from consumer state', () => {
      const mockConsumer = createMockConsumer('ds-stream1-client1');
      const mockInner = {
        consumers: {
          get: vi.fn().mockReturnValue(Effect.succeed(mockConsumer)),
          add: vi.fn(),
          delete: vi.fn(),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        const offset = yield* service.getOffset('stream1', 'client1');

        expect(offset).toBe(10); // ackFloorSeq from mock
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });
  });

  describe('deleteConsumer', () => {
    it('deletes existing consumer', () => {
      const mockInner = {
        consumers: {
          get: vi.fn(),
          add: vi.fn(),
          delete: vi.fn().mockReturnValue(Effect.void),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        yield* service.deleteConsumer('stream1', 'client1');

        expect(mockInner.consumers.delete).toHaveBeenCalledWith(
          'stream1',
          'ds-stream1-client1'
        );
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });

    it('succeeds silently if consumer not found', () => {
      const mockInner = {
        consumers: {
          get: vi.fn(),
          add: vi.fn(),
          delete: vi.fn().mockReturnValue(
            Effect.fail(
              new Inner.Consumers.DeleteError({
                message: 'Consumer not found',
                streamName: 'stream1',
                consumerName: 'ds-stream1-client1',
                cause: new Error('consumer not found'),
              })
            )
          ),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        // Should not throw
        yield* service.deleteConsumer('stream1', 'client1');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });

    it('fails on other errors', () => {
      const mockInner = {
        consumers: {
          get: vi.fn(),
          add: vi.fn(),
          delete: vi.fn().mockReturnValue(
            Effect.fail(
              new Inner.Consumers.DeleteError({
                message: 'Connection lost',
                streamName: 'stream1',
                consumerName: 'ds-stream1-client1',
                cause: new Error('connection refused'),
              })
            )
          ),
        },
      } as unknown as NatsInnerService;

      const TestLayer = ConsumerStateService.Default.pipe(
        Layer.provide(Layer.succeed(NatsInnerService, mockInner))
      );

      return Effect.gen(function* () {
        const service = yield* ConsumerStateService;
        const result = yield* service
          .deleteConsumer('stream1', 'client1')
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(ConsumerStateError);
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise);
    });
  });
});
