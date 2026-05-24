/**
 * Runtime-owned STM reservation state for Sui objects, gas, payment, and dispatch — re-export shim.
 *
 * Logic is decomposed into focused modules under `src/reservation/` while this
 * barrel preserves the existing `@tmnl/effect-sui/reservation` public namespace.
 *
 * @module
 */

export * from './resources';
export * from './service';
export * from './state';
export * from './types';
