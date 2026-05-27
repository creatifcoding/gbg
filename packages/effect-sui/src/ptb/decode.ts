/** PTB AST decode helpers. */

import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';

import { SuiPtbCommandAst } from './commands';
import { normalizePtbError, type SuiPtbError } from './errors';
import { SuiPtbInputAst } from './inputs';

export function decodeInput(entry: unknown, index: number): Effect.Effect<SuiPtbInputAst, SuiPtbError> {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(SuiPtbInputAst)(entry, { errors: 'all' } as never) as SuiPtbInputAst,
    catch: (cause) => normalizePtbError(`input.${index}`, cause),
  });
}

export function decodeCommand(entry: unknown, index: number): Effect.Effect<SuiPtbCommandAst, SuiPtbError> {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(SuiPtbCommandAst)(entry, { errors: 'all' } as never) as SuiPtbCommandAst,
    catch: (cause) => normalizePtbError(`command.${index}`, cause),
  });
}
