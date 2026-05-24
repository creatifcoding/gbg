/** Sui programmable transaction block Effectable facade. */

import * as Effect from 'effect-v4/Effect';

import { SuiEffect } from './base';

export interface SuiPtbInput {
  readonly _tag: string;
  readonly name?: string;
}

export interface SuiPtbCommand {
  readonly _tag: string;
  readonly name?: string;
}

export interface SuiPtbBuildRequirements {
  readonly requiresProvider?: boolean;
  readonly requiresPayment?: boolean;
  readonly requiresAuth?: boolean;
}

export interface SuiPtbBuildArtifact<TransactionLike = unknown> {
  readonly transaction?: TransactionLike;
  readonly inputs: ReadonlyArray<SuiPtbInput>;
  readonly commands: ReadonlyArray<SuiPtbCommand>;
  readonly requirements: SuiPtbBuildRequirements;
}

export interface SuiPTBOptions<TransactionLike = unknown, E = never, R = never> {
  readonly label: string;
  readonly inputs?: ReadonlyArray<SuiPtbInput>;
  readonly commands?: ReadonlyArray<SuiPtbCommand>;
  readonly requirements?: SuiPtbBuildRequirements;
  readonly build: (
    self: SuiPTB<TransactionLike, E, R>,
  ) => Effect.Effect<SuiPtbBuildArtifact<TransactionLike>, E, R>;
}

export class SuiPTB<TransactionLike = unknown, E = never, R = never> extends SuiEffect<
  SuiPtbBuildArtifact<TransactionLike>,
  E,
  R
> {
  readonly kind = 'SuiPTB' as const;
  readonly label: string;
  readonly inputs: ReadonlyArray<SuiPtbInput>;
  readonly commands: ReadonlyArray<SuiPtbCommand>;
  readonly requirements: SuiPtbBuildRequirements;

  constructor(readonly options: SuiPTBOptions<TransactionLike, E, R>) {
    super();
    this.label = options.label;
    this.inputs = options.inputs ?? [];
    this.commands = options.commands ?? [];
    this.requirements = options.requirements ?? {};
  }

  build(): Effect.Effect<SuiPtbBuildArtifact<TransactionLike>, E, R> {
    return this.options.build(this);
  }

  override asEffect(): Effect.Effect<SuiPtbBuildArtifact<TransactionLike>, E, R> {
    return this.build();
  }
}
