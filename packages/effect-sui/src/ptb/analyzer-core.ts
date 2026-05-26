import * as Effect from 'effect-v4/Effect';

import { SuiInvariantViolation } from '../schema';
import type { SuiPtbAnalysis } from '../services';
import { commandArguments, validateArgument } from './analyzer-arguments';
import { collectCommandDiagnostics } from './analyzer-diagnostics';
import { analyzeInputs } from './analyzer-inputs';
import { decodeCommand, decodeInput } from './decode';

export const analyzePtb = (
  label: string,
  inputs: ReadonlyArray<unknown>,
  commands: ReadonlyArray<unknown>,
): Effect.Effect<SuiPtbAnalysis, SuiInvariantViolation> => Effect.gen(function* () {
  const parsedInputs = yield* Effect.all(inputs.map((entry, index) => decodeInput(entry, index)));
  const parsedCommands = yield* Effect.all(commands.map((entry, index) => decodeCommand(entry, index)));
  const inputAnalysis = analyzeInputs(parsedInputs);
  const diagnostics = [...inputAnalysis.diagnostics];

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
    objectIds: inputAnalysis.objectIds,
    diagnostics: diagnostics.map((message) => `${label}: ${message}`),
  };
});
