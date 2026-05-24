/**
 * Effectable Sui ontology and supporting execution algebras — re-export shim.
 *
 * Public lattice:
 * - SuiObject: state + object capability
 * - SuiPTB: full programmable transaction block build program
 * - SuiTx: payable/authenticated transaction lifecycle
 * - SuiPackage / SuiModule: immutable code/type factory surface
 *
 * Logic is decomposed into focused modules under `src/effectable/` while this
 * barrel preserves the existing `@tmnl/effect-sui/effectable` public namespace.
 *
 * @module
 */

export * from './base';
export * from './object';
export * from './package';
export * from './ptb';
export * from './tx';
