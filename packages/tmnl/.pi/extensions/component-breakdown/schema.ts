import { Schema } from 'effect'

export const DiagramMode = Schema.Literal('compact', 'expanded', 'both')
export type DiagramMode = typeof DiagramMode.Type

export class BreakdownRequest extends Schema.Class<BreakdownRequest>('BreakdownRequest')({
  componentName: Schema.NonEmptyString,
  context: Schema.optional(Schema.String),
  diagramMode: Schema.optionalWith(DiagramMode, { default: () => 'both' as const }),
  phaseLabels: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => ['Experiment', 'Design', 'Implement', 'Negotiate'],
  }),
  interactionModes: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => ['keyboard', 'pointer', 'touch', 'programmatic'],
  }),
}) {}

export class TemplateBundle extends Schema.Class<TemplateBundle>('TemplateBundle')({
  componentName: Schema.String,
  context: Schema.String,
  compactStateDiagram: Schema.String,
  expandedStateDiagram: Schema.String,
  petNameLexicon: Schema.String,
  interactionPrecedenceMatrix: Schema.String,
  perPhaseSmokeTests: Schema.String,
  generatedAt: Schema.String,
}) {}

export const BreakdownRunState = Schema.Struct({
  status: Schema.Literal('idle', 'running', 'done', 'error'),
  runs: Schema.Number,
  lastError: Schema.optional(Schema.String),
  lastRequest: Schema.optional(BreakdownRequest),
  lastBundle: Schema.optional(TemplateBundle),
  updatedAt: Schema.String,
})
export type BreakdownRunState = typeof BreakdownRunState.Type
