import * as Effect from 'effect-v4/Effect';

import type { SuiTx } from '../effectable';
import {
  ExplicitPaymentPolicy,
  SponsoredPaymentPolicy,
  SuiGasCoinConflictError,
  type SuiObjectId,
  type SuiObjectRef,
  type SuiPaymentPolicy,
} from '../schema';
import type { SuiPaymentPlan } from '../services';
import { gasCoinConflict } from './errors';

export const planPayment = (
  policy: SuiPaymentPolicy,
  objectInputIds: ReadonlySet<SuiObjectId>,
): Effect.Effect<SuiPaymentPlan, SuiGasCoinConflictError> => Effect.gen(function* () {
  if (policy instanceof ExplicitPaymentPolicy) {
    yield* rejectGasOverlap(policy.gasPayment, objectInputIds);
    return { gasOwner: policy.gasOwner, gasPayment: policy.gasPayment, sponsored: false, addressBalance: false };
  }
  if (policy instanceof SponsoredPaymentPolicy) {
    yield* rejectGasOverlap(policy.gasPayment, objectInputIds);
    return {
      gasOwner: policy.sponsor,
      gasPayment: policy.gasPayment,
      sponsored: true,
      addressBalance: policy.gasPayment.length === 0,
    };
  }
  return { gasPayment: [], sponsored: false, addressBalance: policy.addressBalance };
});

const rejectGasOverlap = (
  gasPayment: ReadonlyArray<SuiObjectRef>,
  objectInputIds: ReadonlySet<SuiObjectId>,
): Effect.Effect<void, SuiGasCoinConflictError> => {
  const overlap = gasPayment.find((ref) => objectInputIds.has(ref.objectId));
  return overlap
    ? Effect.fail(gasCoinConflict(`Gas payment overlaps PTB object input ${overlap.objectId}`, overlap.objectId, `owned:${overlap.objectId}`))
    : Effect.void;
};

export function collectPtbObjectInputIds(tx: SuiTx<unknown, unknown, unknown>): ReadonlySet<SuiObjectId> {
  const ids = new Set<SuiObjectId>();
  for (const input of tx.ptb?.inputs ?? []) {
    const entry = input as { readonly _tag?: string; readonly objectId?: SuiObjectId; readonly ref?: { readonly objectId?: SuiObjectId } };
    if (entry._tag === 'ObjectInput' && entry.objectId) ids.add(entry.objectId);
    if ((entry._tag === 'ObjectRefInput' || entry._tag === 'SharedObjectInput' || entry._tag === 'ReceivingObjectInput') && entry.ref?.objectId) {
      ids.add(entry.ref.objectId);
    }
  }
  return ids;
}
