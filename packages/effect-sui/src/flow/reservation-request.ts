/** Reservation request construction for SuiFlow lifecycle runs. */

import type { SuiPtbBuildArtifact, SuiTx } from '../effectable';
import type { SuiObjectId, SuiObjectRef } from '../schema';
import type { SuiPaymentPlan, SuiReservationRequest } from '../services';

export function makeLifecycleReservationRequest(
  tx: SuiTx<unknown, unknown, unknown>,
  artifact: SuiPtbBuildArtifact<unknown>,
  payment: SuiPaymentPlan,
): SuiReservationRequest {
  return {
    objectRefs: collectArtifactObjectRefs(artifact),
    objectIds: collectArtifactObjectIds(artifact),
    gasRefs: payment.gasPayment,
    sender: tx.sender,
    sponsor: payment.sponsored ? payment.gasOwner : undefined,
    intent: tx.label,
  };
}

function collectArtifactObjectRefs(artifact: SuiPtbBuildArtifact<unknown>): ReadonlyArray<SuiObjectRef> {
  const refs: Array<SuiObjectRef> = [];
  for (const input of artifact.inputs) {
    const entry = input as {
      readonly _tag?: string;
      readonly ref?: SuiObjectRef;
    };
    if ((entry._tag === 'ObjectRefInput' || entry._tag === 'ReceivingObjectInput') && entry.ref) {
      refs.push(entry.ref);
    }
  }
  return refs;
}

function collectArtifactObjectIds(artifact: SuiPtbBuildArtifact<unknown>): ReadonlyArray<SuiObjectId> {
  const ids: Array<SuiObjectId> = [];
  for (const input of artifact.inputs) {
    const entry = input as {
      readonly _tag?: string;
      readonly objectId?: SuiObjectId;
    };
    if (entry._tag === 'ObjectInput' && entry.objectId) ids.push(entry.objectId);
  }
  return ids;
}
