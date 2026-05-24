/**
 * Schema-backed Sui durable nouns, byte codecs, and typed errors — re-export shim.
 *
 * Logic is decomposed into focused modules under `src/schema/` while this barrel
 * preserves the existing `@tmnl/effect-sui/schema` public namespace.
 *
 * @module
 */

export * from './bytes';
export * from './constants';
export * from './decode';
export * from './descriptors';
export * from './errors';
export * from './move';
export * from './objects';
export * from './policies';
export * from './strings';
