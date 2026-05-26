import * as Effect from 'effect-v4/Effect';
import { SuiInvariantViolation } from '../schema';
import { type SuiPtbArgument } from './arguments';
import { type SuiPtbCommandAst } from './commands';
import { knownCommandResultArity } from './analyzer-arity';
import { ptbInvariant } from './errors';

export const commandArguments = (command: SuiPtbCommandAst): ReadonlyArray<SuiPtbArgument> => {
  switch (command._tag) {
    case 'SplitCoins':
      return [command.coin, ...command.amounts];
    case 'MergeCoins':
      return [command.destination, ...command.sources];
    case 'TransferObjects':
      return [...command.objects, command.address];
    case 'MoveCall':
      return command.arguments;
    case 'MakeMoveVec':
      return command.elements;
    case 'Publish':
      return [];
    case 'Upgrade':
      return [command.ticket];
  }
};

export const validateArgument = (
  arg: SuiPtbArgument,
  commandIndex: number,
  argIndex: number,
  inputCount: number,
  commands: ReadonlyArray<SuiPtbCommandAst>,
): Effect.Effect<void, SuiInvariantViolation> => {
  switch (arg._tag) {
    case 'Input':
      return arg.index >= inputCount
        ? Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references missing input ${arg.index}`))
        : Effect.void;
    case 'Result': {
      if (arg.index >= commandIndex) {
        return Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references unavailable result ${arg.index}`));
      }
      const arity = knownCommandResultArity(commands[arg.index]);
      return arity !== undefined && arity !== 1
        ? Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} uses Result(${arg.index}) but command ${arg.index} has ${arity} results`))
        : Effect.void;
    }
    case 'NestedResult': {
      if (arg.index >= commandIndex) {
        return Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references unavailable nested result ${arg.index}`));
      }
      const arity = knownCommandResultArity(commands[arg.index]);
      return arity !== undefined && arg.nestedIndex >= arity
        ? Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references missing nested result ${arg.index}.${arg.nestedIndex}`))
        : Effect.void;
    }
    case 'GasCoin':
      return Effect.void;
  }
};

export const rejectGasCoin = (arg: SuiPtbArgument, context: string): Effect.Effect<void, SuiInvariantViolation> =>
  arg._tag === 'GasCoin'
    ? Effect.fail(ptbInvariant('analyze', `${context} cannot use GasCoin by value`))
    : Effect.void;
