/** PTB analyzer/compiler service contracts. */

import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiPTB, SuiPtbBuildArtifact, SuiPtbCommand, SuiPtbInput } from '../effectable';
import type { SuiObjectId } from '../schema';

export interface SuiPtbAnalysis {
  readonly inputs: ReadonlyArray<SuiPtbInput>;
  readonly commands: ReadonlyArray<SuiPtbCommand>;
  readonly objectIds: ReadonlyArray<SuiObjectId>;
  readonly diagnostics: ReadonlyArray<string>;
}

export interface SuiPtbAnalyzerShape {
  readonly analyze: (ptb: SuiPTB<unknown, unknown, unknown>) => Effect.Effect<SuiPtbAnalysis, unknown, never>;
}

export class SuiPtbAnalyzer extends Context.Service<SuiPtbAnalyzer, SuiPtbAnalyzerShape>()(
  '@tmnl/effect-sui/SuiPtbAnalyzer',
) {}

export interface SuiPtbCompileRequest {
  readonly ptb: SuiPTB<unknown, unknown, unknown>;
  readonly analysis?: SuiPtbAnalysis;
  readonly buildMode?: unknown;
}

export interface SuiPtbCompilerShape {
  readonly compile: (
    request: SuiPtbCompileRequest,
  ) => Effect.Effect<SuiPtbBuildArtifact<unknown>, unknown, never>;
}

export class SuiPtbCompiler extends Context.Service<SuiPtbCompiler, SuiPtbCompilerShape>()(
  '@tmnl/effect-sui/SuiPtbCompiler',
) {}
