// Re-export library functions
export * from './lib/specs-core';

// Effect library exports and utilities
import { Effect, Console, pipe } from 'effect';

/**
 * Simple greeting effect for Lens Studio
 * Demonstrates basic Effect usage with logging
 */
export const greetEffect = (name: string) =>
  pipe(
    Effect.succeed(`Hello from Lens Studio, ${name}!`),
    Effect.tap((msg) => Console.log(msg))
  );

/**
 * Computation effect with error handling
 * Shows Effect's error handling capabilities
 */
export const computeEffect = (x: number, y: number) =>
  pipe(
    Effect.try({
      try: () => {
        if (y === 0) throw new Error('Division by zero');
        return x / y;
      },
      catch: (error) => new Error(String(error)),
    }),
    Effect.tap((result) => Console.log(`Result: ${result}`))
  );

/**
 * Helper to run effects synchronously
 * Useful for Lens Studio's require() based imports
 */
export const runEffectSync = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runSync(effect);
};

/**
 * Helper to run effects as promises
 * For async operations in Lens Studio
 */
export const runEffectPromise = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runPromise(effect);
};

// Example usage demonstration
export const exampleUsage = () => {
  const greeting = runEffectSync(greetEffect('Developer'));
  const computation = runEffectSync(
    Effect.catchAll(computeEffect(10, 2), (error) =>
      Console.log(`Error: ${error.message}`).pipe(Effect.as(0))
    )
  );

  return { greeting, computation };
};
