/** Base Effectable Sui execution algebra. */

import * as Effect from 'effect/Effect';
import * as Effectable from 'effect/Effectable';

export type SuiEffectKind =
  | 'SuiObject'
  | 'SuiPTB'
  | 'SuiTx'
  | 'SuiPackage'
  | 'SuiModule'
  | 'SuiQuery'
  | 'SuiFlow';

/**
 * `Effect.Yieldable`/`Effect.YieldableClass` were removed upstream
 * (effect-smol#2163 "remove Effect.Yieldable") — `Effectable.Class`'s
 * abstract member changed from a method (`abstract override asEffect():
 * Effect.Effect<A, E, R>`) to a property that the runtime's default
 * `evaluate` no longer reads, so subclassing it does nothing useful.
 *
 * `SuiEffect` is a plain class instead. It declares `abstract asEffect()`
 * (the contract every concrete Sui*  facade already implements via
 * `override asEffect()`), and the declaration-merged `interface SuiEffect`
 * below plus the `Effectable.Prototype` wiring at the bottom of this file
 * make every instance genuinely `Effect`-shaped at runtime — mirrors how
 * `Context.ServiceProto` was migrated in the same upstream commit.
 */
export abstract class SuiEffect<A, E = never, R = never> {
  abstract readonly kind: SuiEffectKind;
  abstract readonly label: string;
  abstract asEffect(): Effect.Effect<A, E, R>;
}

// Declaration merge: lets TypeScript see `SuiEffect` (and every subclass)
// as `Effect`-shaped (`[TypeId]`, `pipe`, `Symbol.iterator`) without
// redeclaring those members — the runtime implementation is wired in below.
export interface SuiEffect<A, E = never, R = never> extends Effect.Effect<A, E, R> {}

// Merge a fully-formed Effect prototype (TypeId + pipe + Symbol.iterator +
// evaluate) onto `SuiEffect.prototype`. Every concrete Sui* facade shares
// this via the prototype chain, so `Effect.runSync`/`yield*` work on all
// of them (SuiObject, SuiPTB, SuiTx, SuiPackage, SuiModule, ...) without
// each needing its own wiring. `evaluate` delegates to `asEffect()`,
// matching the beta.59 `Effectable.Class` default (`evaluate(_) { return
// this.asEffect() }`) that beta.93 dropped in favor of composition.
Object.assign(
  SuiEffect.prototype,
  Effectable.Prototype<SuiEffect<unknown, unknown, unknown>>({
    label: 'SuiEffect',
    evaluate(_fiber) {
      return this.asEffect();
    },
  }),
);

export abstract class SuiQuery<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiQuery' as const;
}

export abstract class SuiFlow<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiFlow' as const;
}
