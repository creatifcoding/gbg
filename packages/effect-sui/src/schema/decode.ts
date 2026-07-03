/** Canonical Sui schema decode/encode helpers. */

import * as Schema from 'effect/Schema';

import { SuiObjectRef } from './objects';
import {
  SuiAddress,
  SuiObjectDigest,
  SuiObjectId,
  SuiTransactionDigest,
} from './strings';
import { SuiTypeTagString } from './move';

export const decodeSuiAddress = Schema.decodeUnknownSync(SuiAddress);
export const decodeSuiObjectId = Schema.decodeUnknownSync(SuiObjectId);
export const decodeSuiObjectDigest = Schema.decodeUnknownSync(SuiObjectDigest);
export const decodeSuiTransactionDigest = Schema.decodeUnknownSync(SuiTransactionDigest);
export const decodeSuiObjectRef = Schema.decodeUnknownSync(SuiObjectRef);
export const decodeSuiTypeTagString = Schema.decodeUnknownSync(SuiTypeTagString);

export const encodeSuiObjectRef = Schema.encodeUnknownSync(SuiObjectRef);
