import { Atom } from '@effect-atom/atom';
import * as Effect from 'effect/Effect';
import type { EguiEvent } from './schemas';

export const MAX_EVENT_LOG = 12;

export const eguiCounterAtom = Atom.make(0);
export const eguiEventLogAtom = Atom.make<readonly EguiEvent[]>([]);

export const findLatestCounter = (events: readonly EguiEvent[]) => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event._tag === 'CounterChanged') {
      return event.value;
    }
  }
  return undefined;
};

export const appendEguiEventLog = (
  events: readonly EguiEvent[],
  existing: readonly EguiEvent[]
) => [...events, ...existing].slice(0, MAX_EVENT_LOG);

export const eguiOps = {
  ingestEvents: Atom.fn<readonly EguiEvent[]>()((events, ctx) =>
    Effect.gen(function* () {
      if (events.length === 0) return;
      const nextLog = appendEguiEventLog(events, ctx(eguiEventLogAtom));
      ctx.set(eguiEventLogAtom, nextLog);

      const latestCounter = findLatestCounter(events);
      if (latestCounter !== undefined) {
        ctx.set(eguiCounterAtom, latestCounter);
      }
    })
  ),
};
