/** Base Effectable Sui execution algebra. */

import * as Effectable from 'effect-v4/Effectable';

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

export abstract class SuiQuery<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiQuery' as const;
}

export abstract class SuiFlow<A = unknown, E = never, R = never> extends SuiEffect<A, E, R> {
  readonly kind = 'SuiFlow' as const;
}
