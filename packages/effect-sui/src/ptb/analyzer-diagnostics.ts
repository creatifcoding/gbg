import * as Effect from 'effect/Effect';

import type { SuiPtbCommandAst } from './commands';
import { rejectGasCoin } from './analyzer-arguments';
import type { SuiPtbError } from './errors';

export const collectCommandDiagnostics = (
  command: SuiPtbCommandAst,
  commandIndex: number,
  diagnostics: string[],
): Effect.Effect<void, SuiPtbError> => Effect.gen(function* () {
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
