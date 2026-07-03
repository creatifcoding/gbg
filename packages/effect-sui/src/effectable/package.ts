/** Sui package/module Effectable facades and typed factory surface. */

import * as Effect from 'effect/Effect';

import { SuiInvariantViolation, SuiPackageDescriptor } from '../schema';
import type { SuiObjectId } from '../schema';
import { SuiEffect } from './base';
import { SuiObject, type SuiObjectOptions } from './object';
import { SuiPTB, type SuiPTBOptions } from './ptb';
import { SuiTx, type SuiTxOptions } from './tx';

export interface SuiPackageOptions<E = never, R = never> {
  readonly packageId: SuiObjectId;
  readonly modules: ReadonlyArray<string>;
  readonly moduleDescriptors?: SuiPackageDescriptor['moduleDescriptors'];
  readonly label?: string;
  readonly load?: (self: SuiPackage<E, R>) => Effect.Effect<SuiPackageDescriptor, E, R>;
}

export class SuiPackage<E = never, R = never> extends SuiEffect<SuiPackageDescriptor, E, R> {
  readonly kind = 'SuiPackage' as const;
  readonly packageId: SuiObjectId;
  readonly modules: ReadonlyArray<string>;
  readonly moduleDescriptors?: SuiPackageDescriptor['moduleDescriptors'];
  readonly label: string;

  constructor(readonly options: SuiPackageOptions<E, R>) {
    super();
    this.packageId = options.packageId;
    this.modules = options.modules;
    this.moduleDescriptors = options.moduleDescriptors;
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
    return this.options.load?.(this) ?? Effect.succeed(new SuiPackageDescriptor({
      packageId: this.packageId,
      modules: this.modules,
      moduleDescriptors: this.moduleDescriptors,
    }));
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
