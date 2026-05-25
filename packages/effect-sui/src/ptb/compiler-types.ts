import { Transaction } from '@mysten/sui/transactions';

export type MystenTransaction = Transaction;

export interface SuiPtbCompileOptions {
  readonly transaction?: Transaction;
}

export type MystenArgument =
  | { readonly $kind: 'GasCoin'; readonly GasCoin: true }
  | { readonly $kind: 'Input'; readonly Input: number; readonly type?: 'pure' | 'object' | 'withdrawal' }
  | { readonly $kind: 'Result'; readonly Result: number }
  | { readonly $kind: 'NestedResult'; readonly NestedResult: [number, number] };
