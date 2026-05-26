import * as Schema from 'effect-v4/Schema';

import { SuiObjectRef } from './objects';
import { SuiAddress } from './strings';

export class AutoPaymentPolicy extends Schema.TaggedClass<AutoPaymentPolicy>()('AutoPaymentPolicy', {
  addressBalance: Schema.Boolean,
}) {}

export class ExplicitPaymentPolicy extends Schema.TaggedClass<ExplicitPaymentPolicy>()('ExplicitPaymentPolicy', {
  gasOwner: Schema.optional(SuiAddress),
  gasPayment: Schema.Array(SuiObjectRef),
}) {}

export class SponsoredPaymentPolicy extends Schema.TaggedClass<SponsoredPaymentPolicy>()('SponsoredPaymentPolicy', {
  sponsor: SuiAddress,
  gasPayment: Schema.Array(SuiObjectRef),
}) {}

export const SuiPaymentPolicy = Schema.Union([AutoPaymentPolicy, ExplicitPaymentPolicy, SponsoredPaymentPolicy]);
export type SuiPaymentPolicy = typeof SuiPaymentPolicy.Type;
