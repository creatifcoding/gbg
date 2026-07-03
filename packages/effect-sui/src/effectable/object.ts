/** Sui object Effectable facade. */

import * as Effect from 'effect/Effect';

import type { SuiObjectId, SuiObjectRef, SuiTypeTagString } from '../schema';
import { SuiEffect } from './base';
import type { SuiTx } from './tx';

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
