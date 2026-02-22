import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { BreakdownRequest } from '../schema.ts'
import { generateTemplateBundle, renderBundleAsMarkdown } from '../engine.ts'

describe('engine', () => {
  it('generates a complete template bundle', async () => {
    const request = new BreakdownRequest({ componentName: 'DataGridPanel', diagramMode: 'both' })
    const generated = await Effect.runPromise(generateTemplateBundle(request))
    const { bundle, diagnostics } = generated

    expect(bundle.componentName).toBe('DataGridPanel')
    expect(bundle.compactStateDiagram).toContain('COMPACT ASCII STATE DIAGRAM')
    expect(bundle.expandedStateDiagram).toContain('EXPANDED ASCII STATE DIAGRAM')
    expect(bundle.petNameLexicon).toContain('INDEXED PET-NAME LEXICON')
    expect(bundle.interactionPrecedenceMatrix).toContain('INTERACTION PRECEDENCE MATRIX')
    expect(bundle.perPhaseSmokeTests).toContain('PER-PHASE SMOKE-TEST')

    expect(diagnostics.totalDurationMs).toBeGreaterThanOrEqual(0)
    expect(diagnostics.sections).toHaveLength(5)

    const markdown = renderBundleAsMarkdown(bundle, 'both')
    expect(markdown).toContain('# Component Breakdown Template Pack: DataGridPanel')
  })

  it('honors compact rendering mode', async () => {
    const request = new BreakdownRequest({ componentName: 'CompactOnly', diagramMode: 'compact' })
    const generated = await Effect.runPromise(generateTemplateBundle(request))
    const markdown = renderBundleAsMarkdown(generated.bundle, 'compact')

    expect(markdown).toContain('COMPACT ASCII STATE DIAGRAM')
    expect(markdown).not.toContain('# (1) EXPANDED ASCII STATE DIAGRAM TEMPLATE')
  })
})
