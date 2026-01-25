/**
 * ADR Unit Extractor
 *
 * Converts parsed ADR sections into ReviewUnit instances.
 */
import type { ReviewUnit } from '../schemas/unit'
import type { ReviewStatus } from '../schemas/status'
import {
  parseADRMarkdown,
  getSection,
  getSubsection,
  parseTable,
  parseBulletList,
  parseLabeledBulletList,
  type ParsedADR,
  type ADRSection,
} from './markdown-parser'

// -----------------------------------------------------------------------------
// Default Status
// -----------------------------------------------------------------------------

const DEFAULT_STATUS: ReviewStatus = 'pending'

// -----------------------------------------------------------------------------
// Context Extractors
// -----------------------------------------------------------------------------

function extractContextUnits(adrId: string, parsed: ParsedADR): ReviewUnit[] {
  const units: ReviewUnit[] = []
  const context = getSection(parsed, 'context')
  if (!context) return units

  // Problem
  const problem = getSubsection(context, 'problem')
  if (problem) {
    units.push({
      _tag: 'ProblemUnit',
      adrId,
      path: 'context.problem',
      content: problem.content,
      status: DEFAULT_STATUS,
    })
  }

  // Constraints (bullet list)
  const constraints = getSubsection(context, 'constraints')
  if (constraints) {
    const items = parseLabeledBulletList(constraints.content)
    items.forEach((item, i) => {
      units.push({
        _tag: 'ConstraintUnit',
        adrId,
        path: `context.constraints[${i}]`,
        constraint: item.label ? `${item.label}: ${item.description}` : item.description,
        status: DEFAULT_STATUS,
      })
    })

    // Fallback to simple bullet list if no labeled items found
    if (items.length === 0) {
      const simpleItems = parseBulletList(constraints.content)
      simpleItems.forEach((item, i) => {
        units.push({
          _tag: 'ConstraintUnit',
          adrId,
          path: `context.constraints[${i}]`,
          constraint: item,
          status: DEFAULT_STATUS,
        })
      })
    }
  }

  // Assumptions (bullet list)
  const assumptions = getSubsection(context, 'assumptions')
  if (assumptions) {
    const items = parseBulletList(assumptions.content)
    items.forEach((item, i) => {
      units.push({
        _tag: 'AssumptionUnit',
        adrId,
        path: `context.assumptions[${i}]`,
        assumption: item,
        status: DEFAULT_STATUS,
      })
    })
  }

  return units
}

// -----------------------------------------------------------------------------
// Decision Extractors
// -----------------------------------------------------------------------------

function extractDecisionUnits(adrId: string, parsed: ParsedADR): ReviewUnit[] {
  const units: ReviewUnit[] = []
  const decision = getSection(parsed, 'decision')
  if (!decision) return units

  // Summary
  const summary = getSubsection(decision, 'summary')
  if (summary) {
    units.push({
      _tag: 'SummaryUnit',
      adrId,
      path: 'decision.summary',
      summary: summary.content,
      status: DEFAULT_STATUS,
    })
  }

  // Technologies (table)
  const technologies = getSubsection(decision, 'technologies')
  if (technologies) {
    const rows = parseTable(technologies.content)
    rows.forEach((row, i) => {
      units.push({
        _tag: 'TechnologyUnit',
        adrId,
        path: `decision.technologies[${i}]`,
        technology: row.technology || '',
        purpose: row.purpose || '',
        reference: row.reference,
        status: DEFAULT_STATUS,
      })
    })
  }

  // Patterns (subsections within patterns)
  const patterns = getSubsection(decision, 'patterns')
  if (patterns) {
    // Extract pattern titles (#### headers)
    const patternRegex = /^####\s+(?:\d+\.\s+)?(.+)$/gm
    let match: RegExpExecArray | null
    let patternIndex = 0
    let lastIndex = 0
    const patternHeaders: { name: string; index: number }[] = []

    while ((match = patternRegex.exec(patterns.content)) !== null) {
      patternHeaders.push({ name: match[1], index: match.index })
    }

    for (let i = 0; i < patternHeaders.length; i++) {
      const start = patternHeaders[i].index
      const end = i + 1 < patternHeaders.length ? patternHeaders[i + 1].index : patterns.content.length
      const content = patterns.content.slice(start, end)

      // Extract code example if present
      const codeMatch = content.match(/```[\s\S]*?```/)
      const characteristics = content.match(/\*\*Characteristics\*\*:\s*(.+)/)?.[1]

      units.push({
        _tag: 'PatternUnit',
        adrId,
        path: `decision.patterns[${i}]`,
        name: patternHeaders[i].name,
        algorithm: codeMatch ? codeMatch[0] : undefined,
        codeExample: codeMatch ? codeMatch[0] : undefined,
        characteristics,
        status: DEFAULT_STATUS,
      })
    }
  }

  // Interfaces (table)
  const interfaces = getSubsection(decision, 'interfaces')
  if (interfaces) {
    const rows = parseTable(interfaces.content)
    rows.forEach((row, i) => {
      units.push({
        _tag: 'InterfaceUnit',
        adrId,
        path: `decision.interfaces[${i}]`,
        interfaceName: row.interface || '',
        from: row.from || '',
        to: row.to || '',
        protocol: row.protocol || '',
        schema: row.schema,
        status: DEFAULT_STATUS,
      })
    })
  }

  return units
}

// -----------------------------------------------------------------------------
// Rationale Extractors
// -----------------------------------------------------------------------------

function extractRationaleUnits(adrId: string, parsed: ParsedADR): ReviewUnit[] {
  const units: ReviewUnit[] = []
  const rationale = getSection(parsed, 'rationale')

  // Alternatives Considered - check both as subsection AND as standalone section
  let alternatives = rationale ? getSubsection(rationale, 'alternatives considered') : undefined

  // Fallback: check for section-level "Alternatives Considered" (some ADRs use this structure)
  if (!alternatives) {
    const alternativesSection = getSection(parsed, 'alternatives considered')
    if (alternativesSection) {
      // Create a synthetic subsection from the section content
      alternatives = { name: 'alternatives considered', content: alternativesSection.content }
    }
  }

  if (alternatives) {
    const rows = parseTable(alternatives.content)
    rows.forEach((row, i) => {
      units.push({
        _tag: 'AlternativeUnit',
        adrId,
        path: `rationale.alternatives[${i}]`,
        alternative: row.alternative || '',
        rejectionReason: row.rejection_reason || '',
        status: DEFAULT_STATUS,
      })
    })
  }

  // If no rationale section, still return the alternatives we found
  if (!rationale) return units

  // Tradeoffs (table)
  const tradeoffs = getSubsection(rationale, 'tradeoffs')
  if (tradeoffs) {
    const rows = parseTable(tradeoffs.content)
    rows.forEach((row, i) => {
      units.push({
        _tag: 'TradeoffUnit',
        adrId,
        path: `rationale.tradeoffs[${i}]`,
        gain: row.gain || '',
        cost: row.cost || '',
        status: DEFAULT_STATUS,
      })
    })
  }

  // Risks (table)
  const risks = getSubsection(rationale, 'risks')
  if (risks) {
    const rows = parseTable(risks.content)
    rows.forEach((row, i) => {
      units.push({
        _tag: 'RiskUnit',
        adrId,
        path: `rationale.risks[${i}]`,
        risk: row.risk || '',
        likelihood: row.likelihood || '',
        impact: row.impact || '',
        mitigation: row.mitigation || '',
        status: DEFAULT_STATUS,
      })
    })
  }

  return units
}

// -----------------------------------------------------------------------------
// Implementation Extractors
// -----------------------------------------------------------------------------

function extractImplementationUnits(adrId: string, parsed: ParsedADR): ReviewUnit[] {
  const units: ReviewUnit[] = []
  const implementation = getSection(parsed, 'implementation')
  if (!implementation) return units

  // Files (table)
  const files = getSubsection(implementation, 'files')
  if (files) {
    const rows = parseTable(files.content)
    rows.forEach((row, i) => {
      const action = (row.action || 'create').toLowerCase() as 'create' | 'modify' | 'delete'
      units.push({
        _tag: 'FileUnit',
        adrId,
        path: `implementation.files[${i}]`,
        filePath: row.path || '',
        action: ['create', 'modify', 'delete'].includes(action) ? action : 'create',
        description: row.description || '',
        status: DEFAULT_STATUS,
      })
    })
  }

  // Dependencies (may be bullet list or "None")
  const dependencies = getSubsection(implementation, 'dependencies')
  if (dependencies && !dependencies.content.toLowerCase().includes('none')) {
    const items = parseBulletList(dependencies.content)
    items.forEach((item, i) => {
      units.push({
        _tag: 'DependencyUnit',
        adrId,
        path: `implementation.dependencies[${i}]`,
        dependency: item,
        status: DEFAULT_STATUS,
      })
    })
  }

  // Test Strategy
  const testStrategy = getSubsection(implementation, 'test strategy')
  if (testStrategy) {
    units.push({
      _tag: 'TestStrategyUnit',
      adrId,
      path: 'implementation.testStrategy',
      strategy: testStrategy.content,
      status: DEFAULT_STATUS,
    })
  }

  return units
}

// -----------------------------------------------------------------------------
// Main Extractor
// -----------------------------------------------------------------------------

/**
 * Extract all ReviewUnits from an ADR markdown file.
 */
export function extractUnitsFromMarkdown(markdown: string): ReviewUnit[] {
  const parsed = parseADRMarkdown(markdown)
  if (!parsed) return []

  const adrId = parsed.frontmatter.id

  return [
    ...extractContextUnits(adrId, parsed),
    ...extractDecisionUnits(adrId, parsed),
    ...extractRationaleUnits(adrId, parsed),
    ...extractImplementationUnits(adrId, parsed),
  ]
}

/**
 * Extract units with parsed ADR data.
 */
export function extractUnits(parsed: ParsedADR): ReviewUnit[] {
  const adrId = parsed.frontmatter.id

  return [
    ...extractContextUnits(adrId, parsed),
    ...extractDecisionUnits(adrId, parsed),
    ...extractRationaleUnits(adrId, parsed),
    ...extractImplementationUnits(adrId, parsed),
  ]
}

/**
 * Get ADR metadata from parsed markdown.
 */
export interface ADRMetadata {
  id: string
  title: string
  commitHash: string
  status: string
  date: string
  tier: string
  stages: string[]
}

export function getADRMetadata(markdown: string): ADRMetadata | null {
  const parsed = parseADRMarkdown(markdown)
  if (!parsed) return null

  return {
    id: parsed.frontmatter.id,
    title: parsed.frontmatter.title,
    commitHash: parsed.frontmatter.commitHash,
    status: parsed.frontmatter.status,
    date: parsed.frontmatter.date,
    tier: parsed.frontmatter.tier,
    stages: parsed.frontmatter.stages,
  }
}
