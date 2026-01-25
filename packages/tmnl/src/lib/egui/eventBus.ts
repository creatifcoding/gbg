import { RegistryContext } from '@effect-atom/atom-react';
import type { Registry as AtomRegistry } from '@effect-atom/atom/Registry';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import { useContext, useEffect } from 'react';
import type { EguiEvent } from './schemas';
import {
  appendEguiEventLog,
  eguiCounterAtom,
  eguiEventLogAtom,
  findLatestCounter,
} from './atoms';

const EVENT_BUS_CAPACITY = 32;

const eguiEventPubSub = Effect.runSync(
  PubSub.sliding<readonly EguiEvent[]>(EVENT_BUS_CAPACITY)
);

type StreamEntry = {
  fiber: Fiber.RuntimeFiber<void, never>;
  refCount: number;
};

const streamEntries = new WeakMap<AtomRegistry, StreamEntry>();

export const publishEguiEvents = (events: readonly EguiEvent[]) => {
  if (events.length === 0) return;
  Effect.runFork(PubSub.publish(eguiEventPubSub, events));
};

const startStream = (registry: AtomRegistry) => {
  if (streamEntries.has(registry)) {
    const entry = streamEntries.get(registry);
    if (entry) entry.refCount += 1;
    return;
  }

  const effect = Stream.runForEach(
    Stream.fromPubSub(eguiEventPubSub),
    (events) =>
      Effect.sync(() => {
        const currentLog = registry.get(
          eguiEventLogAtom
        ) as readonly EguiEvent[];
        registry.set(eguiEventLogAtom, appendEguiEventLog(events, currentLog));

        const latestCounter = findLatestCounter(events);
        if (latestCounter !== undefined) {
          registry.set(eguiCounterAtom, latestCounter);
        }
      })
  );

  const fiber = Effect.runFork(effect) as Fiber.RuntimeFiber<void, never>;
  streamEntries.set(registry, { fiber, refCount: 1 });
};

const stopStream = (registry: AtomRegistry) => {
  const entry = streamEntries.get(registry);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;
  Effect.runFork(Fiber.interrupt(entry.fiber));
  streamEntries.delete(registry);
};

export const useEguiEventStream = (registryOverride?: AtomRegistry) => {
  const contextRegistry = useContext(RegistryContext);
  const registry = registryOverride ?? contextRegistry;

  useEffect(() => {
    startStream(registry);
    return () => stopStream(registry);
  }, [registry]);
};
