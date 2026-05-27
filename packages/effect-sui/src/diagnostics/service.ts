import * as Cause from 'effect-v4/Cause';
import * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';

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
