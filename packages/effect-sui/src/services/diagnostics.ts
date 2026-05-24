/** Diagnostics service contracts. */

import * as Context from 'effect-v4/Context';
import type * as Effect from 'effect-v4/Effect';

export interface SuiDiagnosticsShape {
  readonly record: (event: unknown) => Effect.Effect<void, never, never>;
  readonly classify: (cause: unknown) => Effect.Effect<string, never, never>;
}

export class SuiDiagnostics extends Context.Service<SuiDiagnostics, SuiDiagnosticsShape>()(
  '@tmnl/effect-sui/SuiDiagnostics',
) {}
