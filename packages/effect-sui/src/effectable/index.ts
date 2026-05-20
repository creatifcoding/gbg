/**
 * Effectable Sui ontology and supporting execution algebras.
 *
 * Public lattice:
 * - SuiObject: state + object capability
 * - SuiPTB: full programmable transaction block build program
 * - SuiTx: payable/authenticated transaction lifecycle
 * - SuiPackage / SuiModule: immutable code/type factory surface
 *
 * Supporting algebras:
 * - SuiQuery: transport-safe read/decode program
 * - SuiFlow: orchestration lifecycle
 */

import * as Effect from 'effect-v4/Effect';
import * as Effectable from 'effect-v4/Effectable';

import { SuiInvariantViolation } from '../schema';
import type {
  SuiAddress,
  SuiAuthPolicy,
  SuiBuildMode,
  SuiGasPolicy,
  SuiObjectId,
  SuiObjectRef,
  SuiPaymentPolicy,
  SuiTypeTagString,
} from '../schema';

export type SuiEffectKind =
  | 'SuiObject'
  | 'SuiPTB'
  | 'SuiTx'
  | 'SuiPackage'
  | 'SuiModule'
  | 'SuiQuery'
  | 'SuiFlow';

export abstract class SuiEffect<A, E = never, R = never> extends Effectable.Class<A, E, R> {
  abstract readonly kind: SuiEffectKind;
  abstract readonly label: string;
}

export interface SuiObjectSnapshot<A> {
  readonly id: SuiObjectId;
  readonly ref?: SuiObjectRef;
  readonly type?: SuiTypeTagString;
  readonly content: A;
}

export interface SuiObjectOptions<A, E = never, R = never> {
  readonly id: SuiObjectId;
  readonly ref?: SuiObjectRef;
  readonly type?: SuiTypeTagString;
  readonly label?: string;
  readonly refresh: (self: SuiObject<A, E, R>) => Effect.Effect<SuiObjectSnapshot<A>, E, R>;
}

export class SuiObject<A = unknown, E = never, R = never> extends SuiEffect<
  SuiObjectSnapshot<A>,
  E,
  R
> {
  readonly kind = 'SuiObject' as const;
  readonly id: SuiObjectId;
  readonly ref?: SuiObjectRef;
  readonly type?: SuiTypeTagString;
  readonly label: string;

  constructor(readonly options: SuiObjectOptions<A, E, R>) {
    super();
    this.id = options.id;
    this.ref = options.ref;
    this.type = options.type;
    this.label = options.label ?? `SuiObject(${options.id})`;
  }

  refresh(): Effect.Effect<SuiObjectSnapshot<A>, E, R> {
    return this.options.refresh(this);
  }

  mutate<B, E2 = never, R2 = never>(build: (self: this) => SuiTx<B, E2, R2>): SuiTx<B, E2, R2> {
    return build(this);
  }

  override asEffect(): Effect.Effect<SuiObjectSnapshot<A>, E, R> {
    return this.refresh();
  }
}

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

export interface SuiPackageDescriptor {
  readonly packageId: SuiObjectId;
  readonly modules: ReadonlyArray<string>;
}

export interface SuiPackageOptions<E = never, R = never> extends SuiPackageDescriptor {
  readonly label?: string;
  readonly load?: (self: SuiPackage<E, R>) => Effect.Effect<SuiPackageDescriptor, E, R>;
}

export class SuiPackage<E = never, R = never> extends SuiEffect<SuiPackageDescriptor, E, R> {
  readonly kind = 'SuiPackage' as const;
  readonly packageId: SuiObjectId;
  readonly modules: ReadonlyArray<string>;
  readonly label: string;

  constructor(readonly options: SuiPackageOptions<E, R>) {
    super();
    this.packageId = options.packageId;
    this.modules = options.modules;
    this.label = options.label ?? `SuiPackage(${options.packageId})`;
  }

  module(name: string): Effect.Effect<SuiModule<E, R>, SuiInvariantViolation> {
    return this.modules.includes(name)
      ? Effect.succeed(new SuiModule({ package: this, name }))
      : Effect.fail(new SuiInvariantViolation({
          invariant: 'SuiPackage.module',
          message: `Module ${name} is not declared on ${this.label}`,
        }));
  }

  override asEffect(): Effect.Effect<SuiPackageDescriptor, E, R> {
    return this.options.load?.(this) ?? Effect.succeed({
      packageId: this.packageId,
      modules: this.modules,
    });
  }
}

export interface SuiModuleOptions<E = never, R = never> {
  readonly package: SuiPackage<E, R>;
  readonly name: string;
  readonly label?: string;
}

export class SuiModule<E = never, R = never> extends SuiEffect<SuiPackageDescriptor, E, R> {
  readonly kind = 'SuiModule' as const;
  readonly label: string;
  readonly packageId: SuiObjectId;

  constructor(readonly options: SuiModuleOptions<E, R>) {
    super();
    this.packageId = options.package.packageId;
    this.label = options.label ?? `${options.package.label}::${options.name}`;
  }

  object<A, E2 = never, R2 = never>(options: Omit<SuiObjectOptions<A, E2, R2>, 'label'> & {
    readonly label?: string;
  }): SuiObject<A, E2, R2> {
    return new SuiObject({
      ...options,
      label: options.label ?? `${this.label}::object(${options.id})`,
    });
  }

  ptb<TransactionLike = unknown, E2 = never, R2 = never>(
    options: Omit<SuiPTBOptions<TransactionLike, E2, R2>, 'label'> & { readonly label: string },
  ): SuiPTB<TransactionLike, E2, R2> {
    return new SuiPTB({
      ...options,
      label: `${this.label}::${options.label}`,
    });
  }

  tx<A, E2 = never, R2 = never>(options: SuiTxOptions<A, E2, R2>): SuiTx<A, E2, R2> {
    return new SuiTx({
      ...options,
      label: `${this.label}::${options.label}`,
    });
  }

  override asEffect(): Effect.Effect<SuiPackageDescriptor, E, R> {
    return this.options.package;
  }
}

export abstract class SuiQuery<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiQuery' as const;
}

export abstract class SuiFlow<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiFlow' as const;
}
