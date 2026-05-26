/** ManagedRuntime-backed SuiQuery public edge. */

export type { SuiQueryClient, SuiQueryRuntime, SuiQueryRuntimeOptions, SuiQueryServices } from './runtime-types';
export { SuiQueryLive, makeLayer } from './runtime-layer';
export { makeClient, makeRuntime } from './runtime-client';
