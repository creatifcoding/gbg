/** PTB root AST schema. */

import * as Schema from 'effect-v4/Schema';

import { SuiPtbCommandAst } from './commands';
import { SuiPtbInputAst } from './inputs';

export class SuiPtbAst extends Schema.Class<SuiPtbAst>('SuiPtbAst')({
  label: Schema.String,
  inputs: Schema.Array(SuiPtbInputAst),
  commands: Schema.Array(SuiPtbCommandAst),
}) {}
