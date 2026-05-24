/** Sui transaction lifecycle Effectable facade. */

import * as Effect from 'effect-v4/Effect';

import type { SuiAddress, SuiAuthPolicy, SuiBuildMode, SuiGasPolicy, SuiPaymentPolicy } from '../schema';
import { SuiEffect } from './base';
import type { SuiPTB } from './ptb';

export interface SuiTxOptions<A, E = never, R = never> {
  readonly label: string;
  readonly ptb?: SuiPTB<unknown, unknown, unknown>;
  readonly sender?: SuiAddress;
  readonly buildMode?: SuiBuildMode;
  readonly gasPolicy?: SuiGasPolicy;
  readonly paymentPolicy?: SuiPaymentPolicy;
  readonly authPolicy?: SuiAuthPolicy;
  readonly execute: (self: SuiTx<A, E, R>) => Effect.Effect<A, E, R>;
}

export class SuiTx<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiTx' as const;
  readonly label: string;
  readonly ptb?: SuiPTB<unknown, unknown, unknown>;
  readonly sender?: SuiAddress;
  readonly buildMode?: SuiBuildMode;
  readonly gasPolicy?: SuiGasPolicy;
  readonly paymentPolicy?: SuiPaymentPolicy;
  readonly authPolicy?: SuiAuthPolicy;

  constructor(readonly options: SuiTxOptions<A, E, R>) {
    super();
    this.label = options.label;
    this.ptb = options.ptb;
    this.sender = options.sender;
    this.buildMode = options.buildMode;
    this.gasPolicy = options.gasPolicy;
    this.paymentPolicy = options.paymentPolicy;
    this.authPolicy = options.authPolicy;
  }

  execute(): Effect.Effect<A, E, R> {
    return this.options.execute(this);
  }

  override asEffect(): Effect.Effect<A, E, R> {
    return this.execute();
  }
}
