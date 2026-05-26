import type { SuiObjectId } from '../schema';
import type { SuiPtbInputAst } from './inputs';

export interface PtbInputAnalysis {
  readonly objectIds: ReadonlyArray<SuiObjectId>;
  readonly diagnostics: ReadonlyArray<string>;
}

export const analyzeInputs = (inputs: ReadonlyArray<SuiPtbInputAst>): PtbInputAnalysis => {
  const diagnostics: string[] = [];
  const objectIds = new Set<SuiObjectId>();
  const seenNames = new Set<string>();

  for (const entry of inputs) {
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

  return { objectIds: [...objectIds], diagnostics };
};
