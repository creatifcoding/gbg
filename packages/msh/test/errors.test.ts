/**
 * Error Architecture Tests
 *
 * Verifies Schema.TaggedErrorClass errors are yieldable, catchable,
 * and preserve the namespace union pattern.
 *
 * @module @tmnl/msh/test/errors
 */

import { describe, it, expect } from 'vitest';
import * as Effect from 'effect-v4/Effect';

import { Connection, Inner, Codec, KV, Hub, Micro } from '../src/nats/errors';
import { Subject } from '../src/subject/errors';
import { MshDecodeError } from '../src/schemas/errors';

describe('Error Architecture', () => {
  describe('Schema.TaggedErrorClass basics', () => {
    it('constructs with _tag', () => {
      const err = new Connection.ConnectError({
        message: 'test',
        servers: 'ws://localhost',
      });
      expect(err._tag).toBe('Connection/Connect');
      expect(err.message).toBe('test');
      expect(err.servers).toBe('ws://localhost');
    });

    it('constructs with array servers', () => {
      const err = new Connection.ConnectError({
        message: 'test',
        servers: ['ws://a', 'ws://b'],
      });
      expect(err.servers).toEqual(['ws://a', 'ws://b']);
    });

    it('is yieldable in Effect.gen', async () => {
      const program = Effect.gen(function* () {
        yield* new Connection.ConnectError({
          message: 'boom',
          servers: 'ws://localhost',
        });
        return 'unreachable';
      });

      const result = await Effect.runPromise(Effect.result(program));
      expect(result._tag).toBe('Failure');
    });

    it('is catchable via Effect.catchTag', async () => {
      const program = Effect.gen(function* () {
        yield* new Codec.EncodeError({ message: 'encode failed' });
        return 'unreachable';
      }).pipe(
        Effect.catchTag('Codec/Encode', (e) =>
          Effect.succeed(`caught: ${e.message}`),
        ),
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe('caught: encode failed');
    });
  });

  describe('Namespace unions', () => {
    it('Connection.Error union discriminates', () => {
      const handle = (err: Connection.Error): string => {
        switch (err._tag) {
          case 'Connection/Connect': return `connect: ${err.message}`;
          case 'Connection/Disconnect': return `disconnect: ${err.wasClean}`;
          case 'Connection/JetStreamManager': return `jsm: ${err.message}`;
        }
      };

      expect(handle(new Connection.ConnectError({ message: 'fail', servers: 'x' }))).toBe('connect: fail');
      expect(handle(new Connection.DisconnectError({ message: 'closed', wasClean: true }))).toBe('disconnect: true');
    });

    it('Inner.Core.Error covers all core ops', () => {
      const tags: string[] = [
        new Inner.Core.PublishError({ message: 'x', subject: 's' })._tag,
        new Inner.Core.SubscribeError({ message: 'x', subject: 's' })._tag,
        new Inner.Core.RequestError({ message: 'x', subject: 's' })._tag,
        new Inner.Core.TimeoutError({ subject: 's', timeoutMs: 5000 })._tag,
        new Inner.Core.FlushError({ message: 'x' })._tag,
      ];
      expect(tags).toEqual([
        'Inner/Core/Publish', 'Inner/Core/Subscribe', 'Inner/Core/Request',
        'Inner/Core/Timeout', 'Inner/Core/Flush',
      ]);
    });

    it('Subject errors have correct tags', () => {
      const err = new Subject.PatternConflictError({
        pattern: 'x.y.z',
        conflictsWith: 'other' as any,
      });
      expect(err._tag).toBe('Subject/PatternConflict');
    });

    it('MshDecodeError is yieldable', async () => {
      const program = Effect.gen(function* () {
        yield* new MshDecodeError({ message: 'bad json', subject: 'test.sub' });
        return 'unreachable';
      });

      const result = await Effect.runPromise(Effect.result(program));
      expect(result._tag).toBe('Failure');
    });
  });
});
