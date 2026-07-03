/** PTB input AST schema nouns. */

import * as Schema from 'effect/Schema';

import { SharedObjectRef, SuiObjectId, SuiObjectRef, SuiTypeTagString } from '../schema';

export class SuiPtbPureInput extends Schema.TaggedClass<SuiPtbPureInput>()('PureInput', {
  name: Schema.optional(Schema.String),
  typeTag: SuiTypeTagString,
  value: Schema.Unknown,
  bytes: Schema.optional(Schema.Uint8Array),
}) {}

export class SuiPtbObjectInput extends Schema.TaggedClass<SuiPtbObjectInput>()('ObjectInput', {
  name: Schema.optional(Schema.String),
  objectId: SuiObjectId,
}) {}

export class SuiPtbObjectRefInput extends Schema.TaggedClass<SuiPtbObjectRefInput>()(
  'ObjectRefInput',
  {
    name: Schema.optional(Schema.String),
    ref: SuiObjectRef,
  },
) {}

export class SuiPtbSharedObjectInput extends Schema.TaggedClass<SuiPtbSharedObjectInput>()(
  'SharedObjectInput',
  {
    name: Schema.optional(Schema.String),
    ref: SharedObjectRef,
  },
) {}

export class SuiPtbReceivingObjectInput extends Schema.TaggedClass<SuiPtbReceivingObjectInput>()(
  'ReceivingObjectInput',
  {
    name: Schema.optional(Schema.String),
    ref: SuiObjectRef,
  },
) {}

export const SuiPtbInputAst = Schema.Union([
  SuiPtbPureInput,
  SuiPtbObjectInput,
  SuiPtbObjectRefInput,
  SuiPtbSharedObjectInput,
  SuiPtbReceivingObjectInput,
]);
export type SuiPtbInputAst = typeof SuiPtbInputAst.Type;
