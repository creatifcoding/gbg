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

export class WalletCallbackAuthPolicy extends Schema.TaggedClass<WalletCallbackAuthPolicy>()('WalletCallbackAuthPolicy', {
  sender: SuiAddress,
  chain: Schema.String,
  account: Schema.Unknown,
  signTransaction: Schema.Unknown,
  supportedIntents: Schema.optional(Schema.Array(Schema.String)),
  context: Schema.optional(Schema.Unknown),
}) {}

export interface SuiWalletSignRequest {
  readonly sender: typeof SuiAddress.Type;
  readonly chain: string;
  readonly account: unknown;
  readonly transaction: { readonly toJSON: () => Promise<string> };
  readonly transactionBytes: Uint8Array;
  readonly signal: AbortSignal;
  readonly context?: unknown;
}

export interface SuiWalletSignResult {
  readonly signature: string;
  readonly bytes?: string | Uint8Array;
  readonly walletPayload?: unknown;
}

export type SuiWalletSignTransaction = (request: SuiWalletSignRequest) => Promise<SuiWalletSignResult>;

export const SuiAuthPolicy = Schema.Union([KeypairAuthPolicy, OfflineAuthPolicy, SponsoredAuthPolicy, WalletCallbackAuthPolicy]);
export type SuiAuthPolicy = typeof SuiAuthPolicy.Type;
