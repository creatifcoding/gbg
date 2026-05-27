/** Diagnostics service contracts. */

import * as Cause from 'effect-v4/Cause';
import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';
import * as Exit from 'effect-v4/Exit';

import type { SuiDiagnostic, SuiDiagnosticEvent } from '../schema';

export interface SuiDiagnosticsShape {
  readonly record: (event: SuiDiagnosticEvent) => Effect.Effect<void, never, never>;
  readonly classify: (cause: unknown) => Effect.Effect<SuiDiagnostic, never, never>;
  readonly classifyCause: (cause: Cause.Cause<unknown>) => Effect.Effect<SuiDiagnostic, never, never>;
  readonly classifyExit: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<SuiDiagnostic | undefined, never, never>;
}

export class SuiDiagnostics extends Context.Service<SuiDiagnostics, SuiDiagnosticsShape>()(
  '@tmnl/effect-sui/SuiDiagnostics',
) {}
