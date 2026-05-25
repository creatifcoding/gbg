import * as Effect from 'effect-v4/Effect';
import { SuiInvariantViolation, type SuiObjectId } from '../schema';
import type { SuiPtbAnalysis } from '../services';
import { type SuiPtbCommandAst } from './commands';
import { decodeCommand, decodeInput } from './decode';
import { commandArguments, rejectGasCoin, validateArgument } from './analyzer-arguments';

export const analyzePtb = (
  label: string,
  inputs: ReadonlyArray<unknown>,
  commands: ReadonlyArray<unknown>,
): Effect.Effect<SuiPtbAnalysis, SuiInvariantViolation> => Effect.gen(function* () {
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
    yield* collectCommandDiagnostics(command, commandIndex, diagnostics);
  }

  return {
    inputs: parsedInputs,
    commands: parsedCommands,
    objectIds: [...objectIds],
    diagnostics: diagnostics.map((message) => `${label}: ${message}`),
  };
});

const collectCommandDiagnostics = (
  command: SuiPtbCommandAst,
  commandIndex: number,
  diagnostics: string[],
): Effect.Effect<void, SuiInvariantViolation> => Effect.gen(function* () {
  switch (command._tag) {
    case 'SplitCoins':
      if (command.amounts.length === 0) diagnostics.push(`command ${commandIndex} SplitCoins has no amounts`);
      for (const [amountIndex, amount] of command.amounts.entries()) {
        yield* rejectGasCoin(amount, `command ${commandIndex} SplitCoins amount ${amountIndex}`);
      }
      return;
    case 'MergeCoins':
      if (command.sources.length === 0) diagnostics.push(`command ${commandIndex} MergeCoins has no sources`);
      return;
    case 'TransferObjects':
      if (command.objects.length === 0) diagnostics.push(`command ${commandIndex} TransferObjects has no objects`);
      yield* rejectGasCoin(command.address, `command ${commandIndex} TransferObjects address`);
      return;
    case 'MoveCall':
      if (!command.module || !command.functionName) diagnostics.push(`command ${commandIndex} MoveCall is missing module/function`);
      return;
    case 'MakeMoveVec':
      if (command.elements.length === 0) diagnostics.push(`command ${commandIndex} MakeMoveVec has no elements`);
      return;
    case 'Publish':
      if (command.modules.length === 0) diagnostics.push(`command ${commandIndex} Publish has no modules`);
      return;
    case 'Upgrade':
      if (command.modules.length === 0) diagnostics.push(`command ${commandIndex} Upgrade has no modules`);
      yield* rejectGasCoin(command.ticket, `command ${commandIndex} Upgrade ticket`);
      return;
  }
});
