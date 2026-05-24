/** Reservation resource-key derivation. */

import type { SuiAddress, SuiObjectId } from '../schema';
import type { SuiReservationRequest } from '../services';
import type { SuiReservationResource } from './types';

export const resourceKeysFor = (request: SuiReservationRequest): ReadonlyArray<SuiReservationResource> => {
  const resources: Array<SuiReservationResource> = [];

  for (const ref of request.objectRefs) {
    resources.push({ key: objectKey(ref.objectId), kind: 'object' });
  }
  for (const objectId of request.objectIds ?? []) {
    resources.push({ key: objectKey(objectId), kind: 'object' });
  }
  for (const ref of request.gasRefs) {
    resources.push({ key: gasKey(ref.objectId), kind: 'gas' });
  }
  if (request.sender) resources.push({ key: senderKey(request.sender), kind: 'sender' });
  if (request.sponsor) resources.push({ key: sponsorKey(request.sponsor), kind: 'sponsor' });

  return resources;
};

export const objectKey = (objectId: SuiObjectId): string => `owned:${objectId}`;
export const gasKey = (objectId: SuiObjectId): string => `owned:${objectId}`;
export const senderKey = (sender: SuiAddress): string => `sender:${sender}`;
export const sponsorKey = (sponsor: SuiAddress): string => `sponsor:${sponsor}`;
