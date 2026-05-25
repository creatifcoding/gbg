import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import { SuiInvariantViolation } from '../schema';
import { type SuiPtbCommandAst } from './commands';
import { normalizePtbError } from './errors';
import { compileArg } from './compiler-args';
import type { MystenArgument } from './compiler-types';

export const compileCommand = (
  tx: Transaction,
  command: SuiPtbCommandAst,
  commandIndex: number,
  inputs: ReadonlyArray<MystenArgument>,
): Effect.Effect<void, SuiInvariantViolation> => Effect.gen(function* () {
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
      yield* applyCommand(commandIndex, () => tx.moveCall({
        target: `${command.packageId}::${command.module}::${command.functionName}`,
        typeArguments: command.typeArguments ? [...command.typeArguments] : undefined,
        arguments: args,
      }));
      return;
    }
    case 'MakeMoveVec': {
      const elements = yield* Effect.all(command.elements.map((element) => compileArg(element, inputs)));
      yield* applyCommand(commandIndex, () => tx.makeMoveVec({ type: command.type, elements }));
      return;
    }
    case 'Publish':
      yield* applyCommand(commandIndex, () => tx.publish({ modules: command.modules.map((moduleBytes) => [...moduleBytes]), dependencies: [...command.dependencies] }));
      return;
    case 'Upgrade': {
      const ticket = yield* compileArg(command.ticket, inputs);
      yield* applyCommand(commandIndex, () => tx.upgrade({
        modules: command.modules.map((moduleBytes) => [...moduleBytes]),
        dependencies: [...command.dependencies],
        package: command.packageId,
        ticket,
      }));
      return;
    }
  }
});

const applyCommand = (
  commandIndex: number,
  apply: () => unknown,
): Effect.Effect<void, SuiInvariantViolation> => Effect.try({
  try: () => { apply(); },
  catch: (cause) => normalizePtbError(`compile.command.${commandIndex}`, cause),
});
