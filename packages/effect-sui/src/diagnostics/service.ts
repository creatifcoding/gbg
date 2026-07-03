import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';

import { SuiDiagnosticEvent, type SuiDiagnostic } from '../schema';
import { SuiDiagnostics, type SuiDiagnosticsShape } from '../services';
import { classifyCause, classifyExit, classifyUnknown } from './classify';

export interface SuiDiagnosticsOptions {
  readonly sink?: (event: SuiDiagnosticEvent) => void;
}

export const makeDiagnostics = (options: SuiDiagnosticsOptions = {}): SuiDiagnosticsShape => ({
  record: (event) => Effect.sync(() => {
    try {
      options.sink?.(event);
    } catch {
      // Diagnostics must degrade silently; never perturb execution semantics.
    }
  }),
  classify: (cause) => Effect.sync(() => classifyUnknown(cause)),
  classifyCause: (cause) => Effect.sync(() => classifyCause(cause)),
  classifyExit: (exit) => Effect.sync(() => classifyExit(exit)),
});

export const makeDiagnosticEvent = (options: {
  readonly name: string;
  readonly diagnostic: SuiDiagnostic;
  readonly stage?: string;
  readonly attributes?: Record<string, unknown>;
}): SuiDiagnosticEvent => new SuiDiagnosticEvent(options);

export const SuiDiagnosticsLive = Layer.succeed(SuiDiagnostics)(makeDiagnostics());
