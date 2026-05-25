/** PTB static analyzer service. */

import * as Layer from 'effect-v4/Layer';
import { SuiPtbAnalyzer, type SuiPtbAnalyzerShape } from '../services';
import { analyzePtb } from './analyzer-core';

export { analyzePtb } from './analyzer-core';

export const makeAnalyzer = (): SuiPtbAnalyzerShape => ({
  analyze: (ptb) => analyzePtb(ptb.label, ptb.inputs, ptb.commands),
});

export const SuiPtbAnalyzerLive = Layer.succeed(SuiPtbAnalyzer)(makeAnalyzer());
