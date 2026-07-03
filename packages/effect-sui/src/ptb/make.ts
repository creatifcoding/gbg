/** Effectable SuiPTB facade constructor. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect/Effect';

import { SuiPTB, type SuiPtbBuildArtifact } from '../effectable';
import { SuiPtbAnalyzer, SuiPtbCompiler } from '../services';
import { SuiPtbAst } from './ast';

export const make = (ast: SuiPtbAst): SuiPTB<Transaction, unknown, SuiPtbAnalyzer | SuiPtbCompiler> =>
  new SuiPTB<Transaction, unknown, SuiPtbAnalyzer | SuiPtbCompiler>({
    label: ast.label,
    inputs: ast.inputs,
    commands: ast.commands,
    requirements: { requiresProvider: true, requiresPayment: true, requiresAuth: true },
    build: (self) =>
      SuiPtbAnalyzer.use((analyzer) =>
        Effect.flatMap(analyzer.analyze(self), (analysis) =>
          SuiPtbCompiler.use((compiler) =>
            Effect.map(
              compiler.compile({ ptb: self, analysis }),
              (artifact) => artifact as SuiPtbBuildArtifact<Transaction>,
            ),
          ),
        ),
      ),
  });
