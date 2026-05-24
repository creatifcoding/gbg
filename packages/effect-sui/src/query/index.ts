/**
 * Transport-safe Sui read/query programs and BCS helpers — re-export shim.
 *
 * Logic is decomposed into focused modules under `src/query/` while this barrel
 * preserves the existing `@tmnl/effect-sui/query` public namespace.
 *
 * @module
 */

export * from './bcs';
export * from './operations';
export * from './resolver';
export * from './runtime';
export * from './schema';
export * from './types';
