import * as Effect from 'effect/Effect';
import { type SuiPtbArgument } from './arguments';
import { ptbInvariant, type SuiPtbError } from './errors';
import type { MystenArgument } from './compiler-types';

export const compileArg = (
  arg: SuiPtbArgument,
  inputs: ReadonlyArray<MystenArgument>,
): Effect.Effect<MystenArgument, SuiPtbError> => {
  switch (arg._tag) {
    case 'GasCoin':
      return Effect.succeed({ $kind: 'GasCoin', GasCoin: true });
    case 'Input': {
      const resolved = inputs[arg.index];
      return resolved ? Effect.succeed(resolved) : Effect.fail(ptbInvariant('compile', `Missing input ${arg.index}`));
    }
    case 'Result':
      return Effect.succeed({ $kind: 'Result', Result: arg.index });
    case 'NestedResult':
      return Effect.succeed({ $kind: 'NestedResult', NestedResult: [arg.index, arg.nestedIndex] });
  }
};
