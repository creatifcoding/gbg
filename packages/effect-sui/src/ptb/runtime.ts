/** ManagedRuntime-backed PTB builder edge. */

import type * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

import { SuiPTB, type SuiPtbBuildArtifact } from '../effectable';
import { SuiPtbAnalyzer, SuiPtbCompiler } from '../services';
import { SuiPtbAnalyzerLive } from './analyzer';
import { SuiPtbCompilerLive } from './compiler';

export const SuiPtbLive = Layer.merge(SuiPtbAnalyzerLive, SuiPtbCompilerLive);

export type SuiPtbRuntime = ManagedRuntime.ManagedRuntime<SuiPtbAnalyzer | SuiPtbCompiler, never>;

export interface SuiPtbBuilder {
  readonly runtime: SuiPtbRuntime;
  readonly build: <A, E>(
    ptb: SuiPTB<A, E, SuiPtbAnalyzer | SuiPtbCompiler>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiPtbBuildArtifact<A>>;
  readonly buildSync: <A, E>(ptb: SuiPTB<A, E, SuiPtbAnalyzer | SuiPtbCompiler>) => SuiPtbBuildArtifact<A>;
  readonly buildExit: <A, E>(
    ptb: SuiPTB<A, E, SuiPtbAnalyzer | SuiPtbCompiler>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiPtbBuildArtifact<A>, E>>;
  readonly dispose: () => Promise<void>;
}

export const makeRuntime = (
  layer: Layer.Layer<SuiPtbAnalyzer | SuiPtbCompiler, never, never> = SuiPtbLive,
): SuiPtbRuntime => ManagedRuntime.make(layer);

export const makeBuilder = (runtime: SuiPtbRuntime = makeRuntime()): SuiPtbBuilder => ({
  runtime,
  build: (ptb, options) => runtime.runPromise(ptb, options),
  buildSync: (ptb) => runtime.runSync(ptb),
  buildExit: (ptb, options) => runtime.runPromiseExit(ptb, options),
  dispose: () => runtime.dispose(),
});
