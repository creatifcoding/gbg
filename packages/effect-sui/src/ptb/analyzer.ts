/** PTB static analyzer. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import { SuiInvariantViolation, type SuiObjectId } from '../schema';
import { SuiPtbAnalyzer, type SuiPtbAnalysis, type SuiPtbAnalyzerShape } from '../services';
import { type SuiPtbArgument } from './arguments';
import { type SuiPtbCommandAst } from './commands';
import { decodeCommand, decodeInput } from './decode';
import { ptbInvariant } from './errors';

export const makeAnalyzer = (): SuiPtbAnalyzerShape => ({
  analyze: (ptb) => analyzePtb(ptb.label, ptb.inputs, ptb.commands),
});

export const SuiPtbAnalyzerLive = Layer.succeed(SuiPtbAnalyzer)(makeAnalyzer());

export function analyzePtb(
  label: string,
  inputs: ReadonlyArray<unknown>,
  commands: ReadonlyArray<unknown>,
): Effect.Effect<SuiPtbAnalysis, SuiInvariantViolation> {
  return Effect.gen(function* () {
    const parsedInputs = yield* Effect.all(inputs.map((entry, index) => decodeInput(entry, index)));
    const parsedCommands = yield* Effect.all(commands.map((entry, index) => decodeCommand(entry, index)));
    const diagnostics: string[] = [];
    const objectIds = new Set<SuiObjectId>();

    const seenNames = new Set<string>();
    for (const entry of parsedInputs) {
      if (entry.name) {
        if (seenNames.has(entry.name)) diagnostics.push(`duplicate input name: ${entry.name}`);
        seenNames.add(entry.name);
      }

      switch (entry._tag) {
        case 'ObjectInput':
          objectIds.add(entry.objectId);
          break;
        case 'ObjectRefInput':
        case 'ReceivingObjectInput':
          objectIds.add(entry.ref.objectId);
          break;
        case 'SharedObjectInput':
          objectIds.add(entry.ref.objectId);
          break;
        case 'PureInput':
          break;
      }
    }

    for (const [commandIndex, command] of parsedCommands.entries()) {
      const args = commandArguments(command);
      for (const [argIndex, arg] of args.entries()) {
        yield* validateArgument(arg, commandIndex, argIndex, parsedInputs.length, parsedCommands);
      }

      switch (command._tag) {
        case 'SplitCoins':
          if (command.amounts.length === 0) diagnostics.push(`command ${commandIndex} SplitCoins has no amounts`);
          for (const [amountIndex, amount] of command.amounts.entries()) {
            yield* rejectGasCoin(amount, `command ${commandIndex} SplitCoins amount ${amountIndex}`);
          }
          break;
        case 'MergeCoins':
          if (command.sources.length === 0) diagnostics.push(`command ${commandIndex} MergeCoins has no sources`);
          break;
        case 'TransferObjects':
          if (command.objects.length === 0) diagnostics.push(`command ${commandIndex} TransferObjects has no objects`);
          yield* rejectGasCoin(command.address, `command ${commandIndex} TransferObjects address`);
          break;
        case 'MoveCall':
          if (!command.module || !command.functionName) {
            diagnostics.push(`command ${commandIndex} MoveCall is missing module/function`);
          }
          break;
        case 'MakeMoveVec':
          if (command.elements.length === 0) diagnostics.push(`command ${commandIndex} MakeMoveVec has no elements`);
          break;
        case 'Publish':
          if (command.modules.length === 0) diagnostics.push(`command ${commandIndex} Publish has no modules`);
          break;
        case 'Upgrade':
          if (command.modules.length === 0) diagnostics.push(`command ${commandIndex} Upgrade has no modules`);
          yield* rejectGasCoin(command.ticket, `command ${commandIndex} Upgrade ticket`);
          break;
      }
    }

    return {
      inputs: parsedInputs,
      commands: parsedCommands,
      objectIds: [...objectIds],
      diagnostics: diagnostics.map((message) => `${label}: ${message}`),
    };
  });
}

function commandArguments(command: SuiPtbCommandAst): ReadonlyArray<SuiPtbArgument> {
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
}

function validateArgument(
  arg: SuiPtbArgument,
  commandIndex: number,
  argIndex: number,
  inputCount: number,
  commands: ReadonlyArray<SuiPtbCommandAst>,
): Effect.Effect<void, SuiInvariantViolation> {
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
        ? Effect.fail(ptbInvariant(
            'analyze',
            `command ${commandIndex} arg ${argIndex} uses Result(${arg.index}) but command ${arg.index} has ${arity} results`,
          ))
        : Effect.void;
    }
    case 'NestedResult': {
      if (arg.index >= commandIndex) {
        return Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references unavailable nested result ${arg.index}`));
      }
      const arity = knownCommandResultArity(commands[arg.index]);
      return arity !== undefined && arg.nestedIndex >= arity
        ? Effect.fail(ptbInvariant(
            'analyze',
            `command ${commandIndex} arg ${argIndex} references missing nested result ${arg.index}.${arg.nestedIndex}`,
          ))
        : Effect.void;
    }
    case 'GasCoin':
      return Effect.void;
  }
}

function rejectGasCoin(arg: SuiPtbArgument, context: string): Effect.Effect<void, SuiInvariantViolation> {
  return arg._tag === 'GasCoin'
    ? Effect.fail(ptbInvariant('analyze', `${context} cannot use GasCoin by value`))
    : Effect.void;
}

function knownCommandResultArity(command: SuiPtbCommandAst | undefined): number | undefined {
  switch (command?._tag) {
    case 'SplitCoins':
      return command.amounts.length;
    case 'MergeCoins':
    case 'TransferObjects':
      return 0;
    case 'MakeMoveVec':
    case 'Publish':
    case 'Upgrade':
      return 1;
    case 'MoveCall':
    case undefined:
      return undefined;
  }
}
