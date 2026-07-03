/** Diagnostics service contracts. */

import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';

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
