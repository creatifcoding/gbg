import type { SuiPtbCommandAst } from './commands';

export const knownCommandResultArity = (command: SuiPtbCommandAst | undefined): number | undefined => {
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
};
