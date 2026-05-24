/** Payment planning services for SuiFlow. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';

import type { SuiTx } from '../effectable';
import {
  AutoPaymentPolicy,
  ExplicitPaymentPolicy,
  SponsoredPaymentPolicy,
  SuiInvariantViolation,
  type SuiObjectId,
  type SuiObjectRef,
  type SuiPaymentPolicy,
} from '../schema';
import { SuiPaymentService, type SuiPaymentPlan, type SuiPaymentServiceShape } from '../services';
import { invariant } from './errors';

export const makePaymentService = (): SuiPaymentServiceShape => ({
  plan: (tx, _gasPlan) => Effect.gen(function* () {
    const policy = tx.paymentPolicy ?? new AutoPaymentPolicy({ addressBalance: true });
    const objectInputIds = collectPtbObjectInputIds(tx);
    return yield* planPayment(policy, objectInputIds);
  }),
});

export const SuiPaymentServiceLive = Layer.succeed(SuiPaymentService)(makePaymentService());

function planPayment(
  policy: SuiPaymentPolicy,
  objectInputIds: ReadonlySet<SuiObjectId>,
): Effect.Effect<SuiPaymentPlan, SuiInvariantViolation> {
  return Effect.gen(function* () {
    if (policy instanceof ExplicitPaymentPolicy) {
      yield* rejectGasOverlap(policy.gasPayment, objectInputIds);
      return {
        gasOwner: policy.gasOwner,
        gasPayment: policy.gasPayment,
        sponsored: false,
        addressBalance: false,
      };
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

    return {
      gasPayment: [],
      sponsored: false,
      addressBalance: policy.addressBalance,
    };
  });
}

function rejectGasOverlap(
  gasPayment: ReadonlyArray<SuiObjectRef>,
  objectInputIds: ReadonlySet<SuiObjectId>,
): Effect.Effect<void, SuiInvariantViolation> {
  const overlap = gasPayment.find((ref) => objectInputIds.has(ref.objectId));
  return overlap
    ? Effect.fail(invariant('SuiPaymentService.gasOverlap', `Gas payment overlaps PTB object input ${overlap.objectId}`))
    : Effect.void;
}

function collectPtbObjectInputIds(tx: SuiTx<unknown, unknown, unknown>): ReadonlySet<SuiObjectId> {
  const ids = new Set<SuiObjectId>();
  for (const input of tx.ptb?.inputs ?? []) {
    const entry = input as {
      readonly _tag?: string;
      readonly objectId?: SuiObjectId;
      readonly ref?: { readonly objectId?: SuiObjectId };
    };
    if (entry._tag === 'ObjectInput' && entry.objectId) ids.add(entry.objectId);
    if (
      (entry._tag === 'ObjectRefInput' ||
        entry._tag === 'SharedObjectInput' ||
        entry._tag === 'ReceivingObjectInput') &&
      entry.ref?.objectId
    ) {
      ids.add(entry.ref.objectId);
    }
  }
  return ids;
}
