/** PTB command AST schema nouns. */

import * as Schema from 'effect-v4/Schema';

import { SuiObjectId, SuiTypeTagString } from '../schema';
import { SuiPtbArgument } from './arguments';

export class SuiPtbSplitCoins extends Schema.TaggedClass<SuiPtbSplitCoins>()('SplitCoins', {
  name: Schema.optional(Schema.String),
  coin: SuiPtbArgument,
  amounts: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbMergeCoins extends Schema.TaggedClass<SuiPtbMergeCoins>()('MergeCoins', {
  name: Schema.optional(Schema.String),
  destination: SuiPtbArgument,
  sources: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbTransferObjects extends Schema.TaggedClass<SuiPtbTransferObjects>()(
  'TransferObjects',
  {
    name: Schema.optional(Schema.String),
    objects: Schema.Array(SuiPtbArgument),
    address: SuiPtbArgument,
  },
) {}

export class SuiPtbMoveCall extends Schema.TaggedClass<SuiPtbMoveCall>()('MoveCall', {
  name: Schema.optional(Schema.String),
  packageId: SuiObjectId,
  module: Schema.String,
  functionName: Schema.String,
  typeArguments: Schema.optional(Schema.Array(SuiTypeTagString)),
  arguments: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbMakeMoveVec extends Schema.TaggedClass<SuiPtbMakeMoveVec>()('MakeMoveVec', {
  name: Schema.optional(Schema.String),
  type: Schema.optional(SuiTypeTagString),
  elements: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbPublish extends Schema.TaggedClass<SuiPtbPublish>()('Publish', {
  name: Schema.optional(Schema.String),
  modules: Schema.Array(Schema.Uint8Array),
  dependencies: Schema.Array(SuiObjectId),
}) {}

export class SuiPtbUpgrade extends Schema.TaggedClass<SuiPtbUpgrade>()('Upgrade', {
  name: Schema.optional(Schema.String),
  modules: Schema.Array(Schema.Uint8Array),
  dependencies: Schema.Array(SuiObjectId),
  packageId: SuiObjectId,
  ticket: SuiPtbArgument,
}) {}

export const SuiPtbCommandAst = Schema.Union([
  SuiPtbSplitCoins,
  SuiPtbMergeCoins,
  SuiPtbTransferObjects,
  SuiPtbMoveCall,
  SuiPtbMakeMoveVec,
  SuiPtbPublish,
  SuiPtbUpgrade,
]);
export type SuiPtbCommandAst = typeof SuiPtbCommandAst.Type;
