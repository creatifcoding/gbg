/** Ergonomic PTB AST constructors. */

import { SharedObjectRef, SuiObjectId, SuiObjectRef, SuiTypeTagString } from '../schema';
import {
  SuiPtbGasCoin,
  SuiPtbInputArgument,
  SuiPtbInputKind,
  SuiPtbNestedResultArgument,
  SuiPtbResultArgument,
} from './arguments';
import {
  SuiPtbObjectInput,
  SuiPtbObjectRefInput,
  SuiPtbPureInput,
  SuiPtbReceivingObjectInput,
  SuiPtbSharedObjectInput,
} from './inputs';

export const gas = (): SuiPtbGasCoin => new SuiPtbGasCoin({});
export const input = (index: number, inputKind?: SuiPtbInputKind): SuiPtbInputArgument =>
  new SuiPtbInputArgument({ index, inputKind });
export const result = (index: number): SuiPtbResultArgument => new SuiPtbResultArgument({ index });
export const nestedResult = (index: number, nestedIndex: number): SuiPtbNestedResultArgument =>
  new SuiPtbNestedResultArgument({ index, nestedIndex });

export const pure = (options: {
  readonly name?: string;
  readonly typeTag: SuiTypeTagString;
  readonly value: unknown;
  readonly bytes?: Uint8Array;
}): SuiPtbPureInput => new SuiPtbPureInput(options);

export const object = (objectId: SuiObjectId, name?: string): SuiPtbObjectInput =>
  new SuiPtbObjectInput({ objectId, name });
export const objectRef = (ref: SuiObjectRef, name?: string): SuiPtbObjectRefInput =>
  new SuiPtbObjectRefInput({ ref, name });
export const sharedObject = (ref: SharedObjectRef, name?: string): SuiPtbSharedObjectInput =>
  new SuiPtbSharedObjectInput({ ref, name });
export const receivingObject = (ref: SuiObjectRef, name?: string): SuiPtbReceivingObjectInput =>
  new SuiPtbReceivingObjectInput({ ref, name });
