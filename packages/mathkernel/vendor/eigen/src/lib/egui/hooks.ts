import { useAtomSet } from '@effect-atom/atom-react';
import type * as Atom from '@effect-atom/atom/Atom';
import type { Registry as AtomRegistry } from '@effect-atom/atom/Registry';
import { useCallback, useSyncExternalStore } from 'react';
import type { EguiEvent } from './schemas';
import { eguiOps } from './atoms';
import { eguiRegistry } from './registry';

export const useEguiAtomSync = () => {
  const ingestEvents = useAtomSet(eguiOps.ingestEvents, {
    mode: 'promiseExit',
  });

  return useCallback(
    (events: readonly EguiEvent[]) => {
      if (events.length === 0) return;
      void ingestEvents(events);
    },
    [ingestEvents]
  );
};

export const useEguiAtomValue = <A>(
  atom: Atom.Atom<A>,
  registry: AtomRegistry = eguiRegistry
): A =>
  useSyncExternalStore(
    (listener) => registry.subscribe(atom, listener),
    () => registry.get(atom),
    () => registry.get(atom)
  );
