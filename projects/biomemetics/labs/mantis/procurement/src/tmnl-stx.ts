import { useMemo, useSyncExternalStore } from 'react';
import { Atom, AtomRegistry } from 'effect/unstable/reactivity';

export type StxLens<S, A> = {
  get: (state: S) => A;
  replace: (value: A, state: S) => S;
  _optic: object;
};

export type StxInstance<S extends object> = {
  atom: Atom.Writable<S>;
  registry: AtomRegistry.AtomRegistry;
  lens: { readonly [K in keyof S]: StxLens<S, S[K]> };
  set: (next: S) => void;
  setAt: <A>(lens: StxLens<S, A>, value: A) => void;
  get: () => S;
  focus: <A>(lens: StxLens<S, A>) => Atom.Atom<A>;
};

const lensOf = <S extends object>(key: string): StxLens<S, S[keyof S]> => ({
  get: (state) => state[key as keyof S],
  replace: (value, state) => ({ ...state, [key]: value }) as S,
  _optic: { key },
});

export function stx<S extends object>(initial: S): StxInstance<S> {
  const registry = AtomRegistry.make();
  const atom = Atom.make(initial);
  registry.mount(atom);

  const lens = Object.fromEntries(
    Object.keys(initial).map((key) => [key, lensOf<S>(key)]),
  ) as unknown as StxInstance<S>['lens'];

  const set = (next: S): void => {
    registry.set(atom, next);
  };

  const setAt = <A>(focused: StxLens<S, A>, value: A): void => {
    set(focused.replace(value, registry.get(atom)));
  };

  const focusCache = new WeakMap<object, Atom.Atom<unknown>>();
  const focus = <A>(focused: StxLens<S, A>): Atom.Atom<A> => {
    const cached = focusCache.get(focused._optic);
    if (cached !== undefined) {
      return cached as Atom.Atom<A>;
    }
    const derived = Atom.make((get) => focused.get(get(atom)));
    registry.mount(derived);
    focusCache.set(focused._optic, derived);
    return derived;
  };

  return {
    atom,
    registry,
    lens,
    set,
    setAt,
    get: () => registry.get(atom),
    focus,
  };
}

export function useAtomValue<A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<A>,
): A {
  const store = useMemo(
    () => ({
      subscribe: (onStoreChange: () => void) =>
        registry.subscribe(atom, onStoreChange),
      snapshot: () => registry.get(atom),
    }),
    [registry, atom],
  );
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

export function useStx<S extends object>(instance: StxInstance<S>) {
  const value = useAtomValue(instance.registry, instance.atom);
  return {
    value,
    lens: instance.lens,
    setAt: instance.setAt,
    set: instance.set,
    get: instance.get,
    focus: instance.focus,
    registry: instance.registry,
  };
}

export function useFocus<S extends object, A>(
  instance: StxInstance<S>,
  lens: StxLens<S, A>,
): A {
  const focused = useMemo(
    () => instance.focus(lens),
    [instance, lens],
  );
  return useAtomValue(instance.registry, focused);
}

export function useStxSet<S extends object>(instance: StxInstance<S>) {
  return {
    set: instance.set,
    setAt: instance.setAt,
    lens: instance.lens,
  };
}
