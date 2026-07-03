import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect/Effect';
import type { SuiPtbBuildArtifact } from '../effectable';
import { decodeCommand, decodeInput } from './decode';
import { compileCommand } from './compiler-command';
import { compileInput } from './compiler-input';
import type { SuiPtbError } from './errors';

export const compilePtb = (options: {
  readonly transaction?: Transaction;
  readonly label: string;
  readonly inputs: ReadonlyArray<unknown>;
  readonly commands: ReadonlyArray<unknown>;
  readonly requirements?: SuiPtbBuildArtifact<Transaction>['requirements'];
}): Effect.Effect<SuiPtbBuildArtifact<Transaction>, SuiPtbError> => Effect.gen(function* () {
  const tx = options.transaction ?? new Transaction();
  const parsedInputs = yield* Effect.all(options.inputs.map((entry, index) => decodeInput(entry, index)));
  const parsedCommands = yield* Effect.all(options.commands.map((entry, index) => decodeCommand(entry, index)));
  const inputArgs = yield* Effect.all(parsedInputs.map((entry) => compileInput(tx, entry)));

  for (const [commandIndex, command] of parsedCommands.entries()) {
    yield* compileCommand(tx, command, commandIndex, inputArgs);
  }

  return {
    transaction: tx,
    inputs: parsedInputs,
    commands: parsedCommands,
    requirements: options.requirements ?? { requiresProvider: true, requiresPayment: true, requiresAuth: true },
  };
});
