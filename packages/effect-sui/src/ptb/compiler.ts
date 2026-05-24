/** PTB compiler from Schema AST to Mysten Transaction. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type { SuiPtbBuildArtifact } from '../effectable';
import { SuiInvariantViolation } from '../schema';
import { SuiPtbCompiler, type SuiPtbCompilerShape } from '../services';
import { type SuiPtbArgument } from './arguments';
import { type SuiPtbCommandAst } from './commands';
import { decodeCommand, decodeInput } from './decode';
import { normalizePtbError, ptbInvariant } from './errors';
import { type SuiPtbInputAst } from './inputs';

export type MystenTransaction = Transaction;

export interface SuiPtbCompileOptions {
  readonly transaction?: Transaction;
}

export const makeCompiler = (options: SuiPtbCompileOptions = {}): SuiPtbCompilerShape => ({
  compile: ({ ptb, analysis }) => compilePtb({
    transaction: options.transaction ?? new Transaction(),
    label: ptb.label,
    inputs: analysis?.inputs ?? ptb.inputs,
    commands: analysis?.commands ?? ptb.commands,
    requirements: ptb.requirements,
  }),
});

export const SuiPtbCompilerLive = Layer.succeed(SuiPtbCompiler)(makeCompiler());

export function compilePtb(options: {
  readonly transaction?: Transaction;
  readonly label: string;
  readonly inputs: ReadonlyArray<unknown>;
  readonly commands: ReadonlyArray<unknown>;
  readonly requirements?: SuiPtbBuildArtifact<Transaction>['requirements'];
}): Effect.Effect<SuiPtbBuildArtifact<Transaction>, SuiInvariantViolation> {
  return Effect.gen(function* () {
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
}

type MystenArgument =
  | { readonly $kind: 'GasCoin'; readonly GasCoin: true }
  | { readonly $kind: 'Input'; readonly Input: number; readonly type?: 'pure' | 'object' | 'withdrawal' }
  | { readonly $kind: 'Result'; readonly Result: number }
  | { readonly $kind: 'NestedResult'; readonly NestedResult: [number, number] };

function compileInput(tx: Transaction, entry: SuiPtbInputAst): Effect.Effect<MystenArgument, SuiInvariantViolation> {
  return Effect.try({
    try: () => {
      switch (entry._tag) {
        case 'PureInput':
          return entry.bytes ? tx.pure(entry.bytes) : tx.pure(entry.typeTag as never, entry.value as never);
        case 'ObjectInput':
          return tx.object(entry.objectId) as MystenArgument;
        case 'ObjectRefInput':
          return tx.objectRef(entry.ref.toMysten()) as MystenArgument;
        case 'SharedObjectInput':
          return tx.sharedObjectRef(entry.ref.toMysten()) as MystenArgument;
        case 'ReceivingObjectInput':
          return tx.receivingRef(entry.ref.toMysten()) as MystenArgument;
      }
    },
    catch: (cause) => normalizePtbError(`compile.input.${entry._tag}`, cause),
  });
}

function compileCommand(
  tx: Transaction,
  command: SuiPtbCommandAst,
  commandIndex: number,
  inputs: ReadonlyArray<MystenArgument>,
): Effect.Effect<void, SuiInvariantViolation> {
  return Effect.gen(function* () {
    switch (command._tag) {
      case 'SplitCoins': {
        const coin = yield* compileArg(command.coin, inputs);
        const amounts = yield* Effect.all(command.amounts.map((amount) => compileArg(amount, inputs)));
        yield* applyCommand(commandIndex, () => tx.splitCoins(coin, amounts));
        return;
      }
      case 'MergeCoins': {
        const destination = yield* compileArg(command.destination, inputs);
        const sources = yield* Effect.all(command.sources.map((source) => compileArg(source, inputs)));
        yield* applyCommand(commandIndex, () => tx.mergeCoins(destination, sources));
        return;
      }
      case 'TransferObjects': {
        const objects = yield* Effect.all(command.objects.map((objectArg) => compileArg(objectArg, inputs)));
        const address = yield* compileArg(command.address, inputs);
        yield* applyCommand(commandIndex, () => tx.transferObjects(objects, address));
        return;
      }
      case 'MoveCall': {
        const args = yield* Effect.all(command.arguments.map((arg) => compileArg(arg, inputs)));
        yield* applyCommand(commandIndex, () =>
          tx.moveCall({
            target: `${command.packageId}::${command.module}::${command.functionName}`,
            typeArguments: command.typeArguments ? [...command.typeArguments] : undefined,
            arguments: args,
          }),
        );
        return;
      }
      case 'MakeMoveVec': {
        const elements = yield* Effect.all(command.elements.map((element) => compileArg(element, inputs)));
        yield* applyCommand(commandIndex, () => tx.makeMoveVec({ type: command.type, elements }));
        return;
      }
      case 'Publish':
        yield* applyCommand(commandIndex, () =>
          tx.publish({
            modules: command.modules.map((moduleBytes) => [...moduleBytes]),
            dependencies: [...command.dependencies],
          }),
        );
        return;
      case 'Upgrade': {
        const ticket = yield* compileArg(command.ticket, inputs);
        yield* applyCommand(commandIndex, () =>
          tx.upgrade({
            modules: command.modules.map((moduleBytes) => [...moduleBytes]),
            dependencies: [...command.dependencies],
            package: command.packageId,
            ticket,
          }),
        );
        return;
      }
    }
  });
}

function applyCommand(
  commandIndex: number,
  apply: () => unknown,
): Effect.Effect<void, SuiInvariantViolation> {
  return Effect.try({
    try: () => {
      apply();
    },
    catch: (cause) => normalizePtbError(`compile.command.${commandIndex}`, cause),
  });
}

function compileArg(arg: SuiPtbArgument, inputs: ReadonlyArray<MystenArgument>): Effect.Effect<MystenArgument, SuiInvariantViolation> {
  switch (arg._tag) {
    case 'GasCoin':
      return Effect.succeed({ $kind: 'GasCoin', GasCoin: true });
    case 'Input': {
      const resolved = inputs[arg.index];
      return resolved
        ? Effect.succeed(resolved)
        : Effect.fail(ptbInvariant('compile', `Missing input ${arg.index}`));
    }
    case 'Result':
      return Effect.succeed({ $kind: 'Result', Result: arg.index });
    case 'NestedResult':
      return Effect.succeed({ $kind: 'NestedResult', NestedResult: [arg.index, arg.nestedIndex] });
  }
}
