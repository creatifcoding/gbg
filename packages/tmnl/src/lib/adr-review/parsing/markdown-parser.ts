/**
 * ADR Markdown Parser
 *
 * Parses ADR markdown files into structured data.
 * No external dependencies - uses regex for frontmatter and section extraction.
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ADRFrontmatter {
  id: string
  title: string
  commitHash: string
  status: string
  date: string
  tier: string
  stages: string[]
}

export interface ADRSection {
  name: string
  content: string
  subsections: ADRSubsection[]
}

export interface ADRSubsection {
  name: string
  content: string
}

export interface ParsedADR {
  frontmatter: ADRFrontmatter
  sections: ADRSection[]
  rawMarkdown: string
}

// -----------------------------------------------------------------------------
// Frontmatter Parser
// -----------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from markdown.
 */
export function parseFrontmatter(markdown: string): ADRFrontmatter | null {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return null

  const yamlContent = frontmatterMatch[1]
  const frontmatter: Partial<ADRFrontmatter> = {}

  // Parse each line
  for (const line of yamlContent.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      // Handle arrays (stages)
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1)
        frontmatter[key as keyof ADRFrontmatter] = arrayContent
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, '')) as any
      } else {
        // Strip quotes
        frontmatter[key as keyof ADRFrontmatter] = value.replace(/^["']|["']$/g, '') as any
      }
    }
  }

  return {
    id: frontmatter.id || '',
    title: frontmatter.title || '',
    commitHash: frontmatter.commitHash || '',
    status: frontmatter.status || 'draft',
    date: frontmatter.date || '',
    tier: frontmatter.tier || 'isolated',
    stages: frontmatter.stages || [],
  }
}

// -----------------------------------------------------------------------------
// Section Parser
// -----------------------------------------------------------------------------

/**
 * Parse markdown into sections.
 */
export function parseSections(markdown: string): ADRSection[] {
  // Remove frontmatter
  const content = markdown.replace(/^---\n[\s\S]*?\n---\n*/, '')

  // Split by ## headers (main sections)
  const sectionRegex = /^## (.+)$/gm
  const sections: ADRSection[] = []
  let lastIndex = 0
  let lastSectionName = ''
  let match: RegExpExecArray | null

  // Find all section headers
  const headers: { name: string; index: number }[] = []
  while ((match = sectionRegex.exec(content)) !== null) {
    headers.push({ name: match[1], index: match.index })
  }

  // Extract content between headers
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index
    const end = i + 1 < headers.length ? headers[i + 1].index : content.length
    const sectionContent = content.slice(start, end)

    // Parse subsections
    const subsections = parseSubsections(sectionContent)

    sections.push({
      name: headers[i].name.toLowerCase(),
      content: sectionContent.replace(/^## .+\n*/, '').trim(),
      subsections,
    })
  }

  return sections
}

/**
 * Parse subsections within a section.
 * Handles numbered prefixes like "### 1. Title" by stripping the number.
 */
function parseSubsections(sectionContent: string): ADRSubsection[] {
  const subsectionRegex = /^### (.+)$/gm
  const subsections: ADRSubsection[] = []
  const headers: { name: string; index: number }[] = []
  let match: RegExpExecArray | null

  while ((match = subsectionRegex.exec(sectionContent)) !== null) {
    // Strip numbered prefix like "1. " or "2. " from name
    const name = match[1].replace(/^\d+\.\s*/, '')
    headers.push({ name, index: match.index })
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index
    const end = i + 1 < headers.length ? headers[i + 1].index : sectionContent.length
    const content = sectionContent.slice(start, end).replace(/^### .+\n*/, '').trim()

    subsections.push({
      name: headers[i].name.toLowerCase(),
      content,
    })
  }

  return subsections
}

// -----------------------------------------------------------------------------
// Table Parser
// -----------------------------------------------------------------------------

export interface TableRow {
  [key: string]: string
}

/**
 * Parse markdown table into rows.
 */
export function parseTable(content: string): TableRow[] {
  const lines = content.split('\n').filter((line) => line.includes('|'))
  if (lines.length < 2) return []

  // Extract headers from first row
  const headerLine = lines[0]
  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.toLowerCase().replace(/\*\*/g, '').replace(/\s+/g, '_'))

  // Skip separator line (index 1), parse data rows
  const rows: TableRow[] = []
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1) // Skip empty first/last

    if (cells.length === headers.length) {
      const row: TableRow = {}
      headers.forEach((header, idx) => {
        row[header] = cells[idx].replace(/\*\*/g, '')
      })
      rows.push(row)
    }
  }

  return rows
}

// -----------------------------------------------------------------------------
// Bullet List Parser
// -----------------------------------------------------------------------------

/**
 * Parse bullet list items from content.
 */
export function parseBulletList(content: string): string[] {
  const items: string[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+)$/)
    if (match) {
      items.push(match[1].replace(/\*\*([^*]+)\*\*:?\s*/, '').trim())
    }
  }

  return items
}

/**
 * Parse bullet list with bold labels (e.g., "**Label**: Description").
 */
export function parseLabeledBulletList(content: string): { label: string; description: string }[] {
  const items: { label: string; description: string }[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/^[-*]\s+\*\*([^*]+)\*\*:?\s*(.*)$/)
    if (match) {
      items.push({
        label: match[1].trim(),
        description: match[2].trim(),
      })
    }
  }

  return items
}

// -----------------------------------------------------------------------------
// Main Parser
// -----------------------------------------------------------------------------

/**
 * Parse complete ADR markdown file.
 */
export function parseADRMarkdown(markdown: string): ParsedADR | null {
  const frontmatter = parseFrontmatter(markdown)
  if (!frontmatter) return null

  const sections = parseSections(markdown)

  return {
    frontmatter,
    sections,
    rawMarkdown: markdown,
  }
}

/**
 * Section name aliases for handling different ADR formats.
 * Maps canonical name → array of possible aliases.
 */
const SECTION_ALIASES: Record<string, string[]> = {
  rationale: ['consequences', 'rationale'],
  implementation: ['implementation', 'implementation notes'],
}

/**
 * Get section by name.
 * Supports fuzzy matching and aliases (e.g., "consequences" = "rationale").
 */
export function getSection(parsed: ParsedADR, name: string): ADRSection | undefined {
  const lowerName = name.toLowerCase()

  // First try exact match
  const exact = parsed.sections.find((s) => s.name.toLowerCase() === lowerName)
  if (exact) return exact

  // Try aliases
  const aliases = SECTION_ALIASES[lowerName]
  if (aliases) {
    for (const alias of aliases) {
      const aliasMatch = parsed.sections.find((s) => s.name.toLowerCase() === alias)
      if (aliasMatch) return aliasMatch
    }
  }

  // Then try contains match
  return parsed.sections.find((s) => s.name.toLowerCase().includes(lowerName))
}

/**
 * Subsection name aliases for handling different ADR formats.
 * Maps canonical name → array of possible aliases.
 */
const SUBSECTION_ALIASES: Record<string, string[]> = {
  tradeoffs: ['positive', 'negative', 'tradeoffs'], // "Positive/Negative" in Consequences ≈ "Tradeoffs"
}

/**
 * Get subsection by name within a section.
 * Supports fuzzy matching and aliases.
 * This handles varied naming like "Problem Space" matching "problem".
 */
export function getSubsection(section: ADRSection, name: string): ADRSubsection | undefined {
  const lowerName = name.toLowerCase()

  // First try exact match
  const exact = section.subsections.find((s) => s.name.toLowerCase() === lowerName)
  if (exact) return exact

  // Try aliases
  const aliases = SUBSECTION_ALIASES[lowerName]
  if (aliases) {
    for (const alias of aliases) {
      const aliasMatch = section.subsections.find((s) => s.name.toLowerCase() === alias)
      if (aliasMatch) return aliasMatch
    }
  }

  // Then try contains match (e.g., "problem space" contains "problem")
  const contains = section.subsections.find((s) => s.name.toLowerCase().includes(lowerName))
  if (contains) return contains

  // Try reverse contains (e.g., looking for "constraints" in "architectural constraints")
  return section.subsections.find((s) => lowerName.includes(s.name.toLowerCase()))
}
