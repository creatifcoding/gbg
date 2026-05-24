/** Transaction build, gas, payment, and auth policy schemas. */

import * as Schema from 'effect-v4/Schema';

import { SuiObjectRef } from './objects';
import { SuiAddress } from './strings';

export const SuiBuildMode = Schema.Literals(['build-only', 'dry-run', 'execute'] as const);
export type SuiBuildMode = typeof SuiBuildMode.Type;

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

export class AutoPaymentPolicy extends Schema.TaggedClass<AutoPaymentPolicy>()('AutoPaymentPolicy', {
  addressBalance: Schema.Boolean,
}) {}

export class ExplicitPaymentPolicy extends Schema.TaggedClass<ExplicitPaymentPolicy>()(
  'ExplicitPaymentPolicy',
  {
    gasOwner: Schema.optional(SuiAddress),
    gasPayment: Schema.Array(SuiObjectRef),
  },
) {}

export class SponsoredPaymentPolicy extends Schema.TaggedClass<SponsoredPaymentPolicy>()(
  'SponsoredPaymentPolicy',
  {
    sponsor: SuiAddress,
    gasPayment: Schema.Array(SuiObjectRef),
  },
) {}

export const SuiPaymentPolicy = Schema.Union([
  AutoPaymentPolicy,
  ExplicitPaymentPolicy,
  SponsoredPaymentPolicy,
]);
export type SuiPaymentPolicy = typeof SuiPaymentPolicy.Type;

export class KeypairAuthPolicy extends Schema.TaggedClass<KeypairAuthPolicy>()('KeypairAuthPolicy', {
  signer: Schema.Unknown,
  sender: Schema.optional(SuiAddress),
}) {}

export class OfflineAuthPolicy extends Schema.TaggedClass<OfflineAuthPolicy>()('OfflineAuthPolicy', {
  sender: SuiAddress,
}) {}

export class SponsoredAuthPolicy extends Schema.TaggedClass<SponsoredAuthPolicy>()('SponsoredAuthPolicy', {
  sender: SuiAddress,
  sponsor: SuiAddress,
  signer: Schema.Unknown,
  sponsorSigner: Schema.optional(Schema.Unknown),
}) {}

export const SuiAuthPolicy = Schema.Union([
  KeypairAuthPolicy,
  OfflineAuthPolicy,
  SponsoredAuthPolicy,
]);
export type SuiAuthPolicy = typeof SuiAuthPolicy.Type;
