/**
 * useAtomStream Hook
 *
 * Ergonomic hook for consuming atoms that wrap Effect Streams.
 * When you create an atom with Atom.make(stream), you get Atom<Result<A, E>>.
 * This hook provides convenient accessors and the Result.builder pattern.
 *
 * @module connection-ports/hooks/useAtomStream
 */

import { useMemo } from 'react';
import { useAtomValue, useAtomSuspense, Atom, Result } from '@effect-atom/atom-react';
import { Cause, Option } from 'effect';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for useAtomStream hook.
 * Provides ergonomic access to stream data with Result pattern.
 */
export interface UseAtomStreamReturn<A, E> {
  /** Raw Result - use for Result.builder() or Result.match() */
  result: Result.Result<A, E>;

  /** Convenience: unwrapped value (undefined if not success) */
  value: A | undefined;

  /** Convenience: error cause (undefined if not failure) */
  cause: Cause.Cause<E> | undefined;

  /** Is in initial state (not yet started) */
  isInitial: boolean;

  /** Is waiting (loading, may have previous data) */
  isWaiting: boolean;

  /** Is success state */
  isSuccess: boolean;

  /** Is failure state */
  isFailure: boolean;

  /** Previous successful value (available in Failure state) */
  previousValue: A | undefined;

  /**
   * Result builder for declarative rendering.
   * Equivalent to Result.builder(result).
   *
   * @example
   * ```tsx
   * const { builder } = useAtomStream(myStreamAtom);
   *
   * return builder()
   *   .onInitial(() => <Skeleton />)
   *   .onWaiting(() => <Spinner />)
   *   .onSuccess((value) => <DataView data={value} />)
   *   .onFailure((cause) => <ErrorView cause={cause} />)
   *   .render();
   * ```
   */
  builder: () => Result.Builder<never, A, E, A extends never ? never : true>;

  /**
   * Match helper for pattern matching on result state.
   * Equivalent to Result.match(result, options).
   *
   * @example
   * ```tsx
   * const { match } = useAtomStream(myStreamAtom);
   *
   * const content = match({
   *   onInitial: () => 'Loading...',
   *   onFailure: (cause) => `Error: ${Cause.pretty(cause)}`,
   *   onSuccess: (value) => `Data: ${JSON.stringify(value)}`,
   * });
   * ```
   */
  match: <X, Y, Z>(options: {
    readonly onInitial: (result: Result.Initial<A, E>) => X;
    readonly onFailure: (result: Result.Failure<A, E>) => Y;
    readonly onSuccess: (result: Result.Success<A, E>) => Z;
  }) => X | Y | Z;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for consuming atoms that wrap Effect Streams.
 *
 * When you create an atom with `Atom.make(stream)`, you get `Atom<Result<A, E>>`.
 * This hook provides ergonomic access to the Result with convenience helpers.
 *
 * @example
 * ```tsx
 * // Create a stream atom
 * const eventsAtom = Atom.make(
 *   Stream.fromAsyncIterable(eventSource, identity)
 * );
 *
 * function EventList() {
 *   const { result, isSuccess, value, builder } = useAtomStream(eventsAtom);
 *
 *   // Option 1: Use convenience accessors
 *   if (isSuccess && value) {
 *     return <List items={value} />;
 *   }
 *
 *   // Option 2: Use builder for declarative rendering
 *   return builder()
 *     .onInitial(() => <Loading />)
 *     .onSuccess((events) => <EventList events={events} />)
 *     .onFailure((cause) => <Error cause={cause} />)
 *     .render();
 * }
 * ```
 *
 * @example Derived stream atoms
 * ```tsx
 * // Derive from another atom using Context.stream
 * const countAtom = Atom.make(0);
 * const doubledAtom = Atom.make((get) =>
 *   get.stream(countAtom).pipe(Stream.map((n) => n * 2))
 * );
 *
 * function DoubledValue() {
 *   const { value, isSuccess } = useAtomStream(doubledAtom);
 *   return isSuccess ? <span>{value}</span> : <span>Loading...</span>;
 * }
 * ```
 */
export function useAtomStream<A, E = never>(
  atom: Atom.Atom<Result.Result<A, E>>
): UseAtomStreamReturn<A, E> {
  // Subscribe to the atom reactively
  const result = useAtomValue(atom);

  // Derive convenience values
  return useMemo(() => {
    const isInitial = Result.isInitial(result);
    const isSuccess = Result.isSuccess(result);
    const isFailure = Result.isFailure(result);
    const isWaiting = Result.isWaiting(result);

    // Extract value (from Success or previous in Failure)
    const value = Option.getOrUndefined(Result.value(result)) as A | undefined;

    // Extract cause from Failure
    const cause = isFailure
      ? (result as Result.Failure<A, E>).cause
      : undefined;

    // Extract previous value from Failure
    const previousValue = isFailure
      ? Option.getOrUndefined(
          Option.map(
            (result as Result.Failure<A, E>).previousSuccess,
            (s) => s.value
          )
        )
      : undefined;

    return {
      result,
      value,
      cause,
      isInitial,
      isWaiting,
      isSuccess,
      isFailure,
      previousValue,
      builder: () => Result.builder(result) as any,
      match: <X, Y, Z>(options: {
        readonly onInitial: (result: Result.Initial<A, E>) => X;
        readonly onFailure: (result: Result.Failure<A, E>) => Y;
        readonly onSuccess: (result: Result.Success<A, E>) => Z;
      }) => Result.match(result, options),
    };
  }, [result]);
}

/**
 * Hook variant that suspends on Initial/Waiting states.
 * Use with React.Suspense for loading states.
 *
 * @example
 * ```tsx
 * function DataView() {
 *   // Will suspend until data is available
 *   const { value, isSuccess } = useAtomStreamSuspense(dataAtom);
 *   return <div>{value}</div>;
 * }
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<Loading />}>
 *       <DataView />
 *     </Suspense>
 *   );
 * }
 * ```
 */
export function useAtomStreamSuspense<A, E = never>(
  atom: Atom.Atom<Result.Result<A, E>>,
  options?: {
    /** Also suspend on waiting state (default: false) */
    readonly suspendOnWaiting?: boolean;
  }
): UseAtomStreamReturn<A, E> & { value: A } {
  // useAtomSuspense from @effect-atom/atom-react handles the suspension
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: options?.suspendOnWaiting ?? false,
    includeFailure: true, // We handle failure in our return
  }) as Result.Success<A, E> | Result.Failure<A, E>;

  return useMemo(() => {
    const isSuccess = Result.isSuccess(result);
    const isFailure = Result.isFailure(result);
    const isWaiting = Result.isWaiting(result);

    const value = isSuccess
      ? (result as Result.Success<A, E>).value
      : undefined;

    const cause = isFailure
      ? (result as Result.Failure<A, E>).cause
      : undefined;

    const previousValue = isFailure
      ? Option.getOrUndefined(
          Option.map(
            (result as Result.Failure<A, E>).previousSuccess,
            (s) => s.value
          )
        )
      : undefined;

    return {
      result,
      value: value as A, // Type assertion since we suspend on Initial
      cause,
      isInitial: false, // Never initial after suspend
      isWaiting,
      isSuccess,
      isFailure,
      previousValue,
      builder: () => Result.builder(result) as any,
      match: <X, Y, Z>(options: {
        readonly onInitial: (result: Result.Initial<A, E>) => X;
        readonly onFailure: (result: Result.Failure<A, E>) => Y;
        readonly onSuccess: (result: Result.Success<A, E>) => Z;
      }) => Result.match(result as Result.Result<A, E>, options),
    };
  }, [result]);
}
