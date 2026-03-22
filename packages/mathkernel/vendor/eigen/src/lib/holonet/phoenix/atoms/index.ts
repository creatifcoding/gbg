/**
 * Holonet Phoenix Atoms
 *
 * Atom-backed UI surface for Phoenix session state and bounded event projections.
 *
 * @module holonet/phoenix/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import { Effect, Layer, Stream } from 'effect';
import type { PhoenixEnvelope } from '../schemas';
import {
  PhoenixChannelSession,
  PhoenixChannelSessionConfigDefault,
  type PhoenixChannelSessionConfigShape,
} from '../services/PhoenixChannelSession';
import { PhoenixAuthTokenProvider } from '../services/PhoenixAuthTokenProvider';
import { PhoenixReplayCoordinator } from '../services/PhoenixReplayCoordinator';
import { PhoenixJsTransport } from '../transport/PhoenixJsTransport';

const runtimeLayer = Layer.mergeAll(
  PhoenixChannelSessionConfigDefault,
  PhoenixAuthTokenProvider.Default,
  PhoenixReplayCoordinator.Default,
  PhoenixJsTransport.Default,
  PhoenixChannelSession.Default,
);

export const holonetPhoenixRuntimeAtom = Atom.runtime(runtimeLayer);

export const phoenixEventWindowAtom = Atom.make<readonly PhoenixEnvelope[]>([]).pipe(
  Atom.keepAlive,
);

export const phoenixEventWindowMaxAtom = Atom.make<number>(250).pipe(Atom.keepAlive);

export const phoenixStreamAttachedAtom = Atom.make<boolean>(false).pipe(Atom.keepAlive);

export const phoenixSnapshotAtom = holonetPhoenixRuntimeAtom.atom(
  Effect.gen(function* () {
    const session = yield* PhoenixChannelSession;
    return yield* session.snapshot;
  }),
);

export const phoenixOps = {
  connect: holonetPhoenixRuntimeAtom.fn<Partial<PhoenixChannelSessionConfigShape> | void>()(
    (arg, _ctx) =>
      Effect.gen(function* () {
        const session = yield* PhoenixChannelSession;
        yield* session.connect((arg as Partial<PhoenixChannelSessionConfigShape> | undefined) ?? {});
      }),
  ),

  disconnect: holonetPhoenixRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;
      yield* session.disconnect();
    }),
  ),

  reconnectNow: holonetPhoenixRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;
      yield* session.reconnectNow();
    }),
  ),

  attachEventStream: holonetPhoenixRuntimeAtom.fn<void>()((_arg, ctx) =>
    Effect.gen(function* () {
      if (ctx(phoenixStreamAttachedAtom)) {
        return;
      }

      const session = yield* PhoenixChannelSession;
      yield* Effect.forkDaemon(
        Stream.runForEach(session.events, (event) =>
          Effect.sync(() => {
            const current = ctx(phoenixEventWindowAtom);
            const max = ctx(phoenixEventWindowMaxAtom);
            const next = [...current, event];
            ctx.set(
              phoenixEventWindowAtom,
              next.length > max ? next.slice(next.length - max) : next,
            );
          }),
        ),
      );

      ctx.set(phoenixStreamAttachedAtom, true);
    }),
  ),

  clearEventWindow: holonetPhoenixRuntimeAtom.fn<void>()((_arg, ctx) =>
    Effect.sync(() => {
      ctx.set(phoenixEventWindowAtom, []);
    }),
  ),
};
