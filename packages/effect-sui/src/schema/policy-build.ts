import * as Schema from 'effect/Schema';

export const SuiBuildMode = Schema.Literals(['build-only', 'dry-run', 'execute'] as const);
export type SuiBuildMode = typeof SuiBuildMode.Type;
