import { Effect } from 'effect'
import { TemplateBundle, type BreakdownRequest } from './schema.ts'
import {
  compactStateDiagramTemplate,
  expandedStateDiagramTemplate,
  interactionPrecedenceMatrixTemplate,
  perPhaseSmokeTestTemplate,
  petNameLexiconTemplate,
} from './templates.ts'

const normalizeContext = (request: BreakdownRequest) =>
  request.context?.trim() || 'No additional context provided.'

export interface SectionTiming {
  section: 'compactStateDiagram' | 'expandedStateDiagram' | 'petNameLexicon' | 'interactionPrecedenceMatrix' | 'perPhaseSmokeTests'
  durationMs: number
}

export interface TemplateGenerationDiagnostics {
  generatedAt: string
  totalDurationMs: number
  sections: ReadonlyArray<SectionTiming>
}

const measureSection = <A>(
  section: SectionTiming['section'],
  build: () => A,
): Effect.Effect<{ readonly value: A; readonly timing: SectionTiming }> =>
  Effect.sync(() => {
    const started = Date.now()
    const value = build()
    return {
      value,
      timing: {
        section,
        durationMs: Date.now() - started,
      },
    }
  }).pipe(Effect.withSpan(`component-breakdown.section.${section}`))

export const generateTemplateBundle = (request: BreakdownRequest) =>
  Effect.gen(function* () {
    const started = Date.now()

    const compact = yield* measureSection('compactStateDiagram', () => compactStateDiagramTemplate(request))
    const expanded = yield* measureSection('expandedStateDiagram', () => expandedStateDiagramTemplate(request))
    const lexicon = yield* measureSection('petNameLexicon', () => petNameLexiconTemplate(request))
    const precedence = yield* measureSection('interactionPrecedenceMatrix', () => interactionPrecedenceMatrixTemplate(request))
    const smoke = yield* measureSection('perPhaseSmokeTests', () => perPhaseSmokeTestTemplate(request))

    const generatedAt = new Date().toISOString()

    const bundle = new TemplateBundle({
      componentName: request.componentName,
      context: normalizeContext(request),
      compactStateDiagram: compact.value,
      expandedStateDiagram: expanded.value,
      petNameLexicon: lexicon.value,
      interactionPrecedenceMatrix: precedence.value,
      perPhaseSmokeTests: smoke.value,
      generatedAt,
    })

    const diagnostics: TemplateGenerationDiagnostics = {
      generatedAt,
      totalDurationMs: Date.now() - started,
      sections: [
        compact.timing,
        expanded.timing,
        lexicon.timing,
        precedence.timing,
        smoke.timing,
      ],
    }

    return { bundle, diagnostics }
  }).pipe(Effect.withSpan('component-breakdown.generate-template-bundle'))

export const renderBundleAsMarkdown = (bundle: TemplateBundle, mode: BreakdownRequest['diagramMode']) => {
  const diagrams = mode === 'compact'
    ? [bundle.compactStateDiagram]
    : mode === 'expanded'
      ? [bundle.expandedStateDiagram]
      : [bundle.compactStateDiagram, '', bundle.expandedStateDiagram]

  return [
    `# Component Breakdown Template Pack: ${bundle.componentName}`,
    '',
    `Context: ${bundle.context}`,
    `Generated: ${bundle.generatedAt}`,
    '',
    ...diagrams,
    '',
    bundle.petNameLexicon,
    '',
    bundle.interactionPrecedenceMatrix,
    '',
    bundle.perPhaseSmokeTests,
  ].join('\n')
}
