import * as Schema from 'effect-v4/Schema';

import { SuiAddress } from './strings';

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

export const SuiAuthPolicy = Schema.Union([KeypairAuthPolicy, OfflineAuthPolicy, SponsoredAuthPolicy]);
export type SuiAuthPolicy = typeof SuiAuthPolicy.Type;
