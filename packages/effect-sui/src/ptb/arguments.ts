/** PTB argument schema nouns. */

import * as Schema from 'effect/Schema';

export const SuiPtbInputKind = Schema.Literals(['pure', 'object', 'withdrawal'] as const);
export type SuiPtbInputKind = typeof SuiPtbInputKind.Type;

const nonNegativeInt = Schema.makeFilter<number>((value) => value >= 0, {
  expected: 'a non-negative integer',
});

export class SuiPtbGasCoin extends Schema.TaggedClass<SuiPtbGasCoin>()('GasCoin', {}) {}

export class SuiPtbInputArgument extends Schema.TaggedClass<SuiPtbInputArgument>()('Input', {
  index: Schema.Int.check(nonNegativeInt),
  inputKind: Schema.optional(SuiPtbInputKind),
}) {}

export class SuiPtbResultArgument extends Schema.TaggedClass<SuiPtbResultArgument>()('Result', {
  index: Schema.Int.check(nonNegativeInt),
}) {}

export class SuiPtbNestedResultArgument extends Schema.TaggedClass<SuiPtbNestedResultArgument>()(
  'NestedResult',
  {
    index: Schema.Int.check(nonNegativeInt),
    nestedIndex: Schema.Int.check(nonNegativeInt),
  },
) {}

export const SuiPtbArgument = Schema.Union([
  SuiPtbGasCoin,
  SuiPtbInputArgument,
  SuiPtbResultArgument,
  SuiPtbNestedResultArgument,
]);
export type SuiPtbArgument = typeof SuiPtbArgument.Type;
