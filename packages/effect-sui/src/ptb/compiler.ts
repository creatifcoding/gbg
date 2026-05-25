/** PTB compiler service from Schema AST to Mysten Transaction. */

import { Transaction } from '@mysten/sui/transactions';
import * as Layer from 'effect-v4/Layer';
import { SuiPtbCompiler, type SuiPtbCompilerShape } from '../services';
import { compilePtb } from './compiler-core';
import type { SuiPtbCompileOptions } from './compiler-types';

export type { MystenArgument, MystenTransaction, SuiPtbCompileOptions } from './compiler-types';
export { compilePtb } from './compiler-core';

export const makeCompiler = (options: SuiPtbCompileOptions = {}): SuiPtbCompilerShape => ({
  compile: ({ ptb, analysis }) => compilePtb({
    transaction: options.transaction ?? new Transaction(),
    label: ptb.label,
    inputs: analysis?.inputs ?? ptb.inputs,
    commands: analysis?.commands ?? ptb.commands,
    requirements: ptb.requirements,
  }),
});

export const SuiPtbCompilerLive = Layer.succeed(SuiPtbCompiler)(makeCompiler());
