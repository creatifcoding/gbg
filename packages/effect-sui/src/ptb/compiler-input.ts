import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import { SuiInvariantViolation } from '../schema';
import { normalizePtbError } from './errors';
import { type SuiPtbInputAst } from './inputs';
import type { MystenArgument } from './compiler-types';

export const compileInput = (
  tx: Transaction,
  entry: SuiPtbInputAst,
): Effect.Effect<MystenArgument, SuiInvariantViolation> => Effect.try({
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
