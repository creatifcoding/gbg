import { Effect } from 'effect';
export * from './lib/specs-core';
/**
 * Simple greeting effect for Lens Studio
 * Demonstrates basic Effect usage with logging
 */
export declare const greetEffect: (name: string) => Effect.Effect<string, never, never>;
/**
 * Computation effect with error handling
 * Shows Effect's error handling capabilities
 */
export declare const computeEffect: (x: number, y: number) => Effect.Effect<number, Error, never>;
/**
 * Helper to run effects synchronously
 * Useful for Lens Studio's require() based imports
 */
export declare const runEffectSync: <A, E>(effect: Effect.Effect<A, E>) => A;
/**
 * Helper to run effects as promises
 * For async operations in Lens Studio
 */
export declare const runEffectPromise: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;
export declare const exampleUsage: () => {
    greeting: string;
    computation: number;
};
