import * as Schema from 'effect-v4/Schema';

export class AutoGasPolicy extends Schema.TaggedClass<AutoGasPolicy>()('AutoGasPolicy', {
  budget: Schema.optional(Schema.String),
  price: Schema.optional(Schema.String),
}) {}

export class ExplicitGasPolicy extends Schema.TaggedClass<ExplicitGasPolicy>()('ExplicitGasPolicy', {
  budget: Schema.String,
  price: Schema.optional(Schema.String),
}) {}

export const SuiGasPolicy = Schema.Union([AutoGasPolicy, ExplicitGasPolicy]);
export type SuiGasPolicy = typeof SuiGasPolicy.Type;
