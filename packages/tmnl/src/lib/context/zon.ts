/**
 * ZON (Zero Overhead Notation) Parser
 * Spec: https://zonformat.org/docs/specification
 *
 * Token-efficient, LLM-optimized data format:
 * - 35-50% reduction vs JSON
 * - Line-oriented, human-readable
 * - Designed for machine-to-machine communication
 */

export interface ZonTable {
  name: string
  columns: string[]
  rows: string[][]
}

export interface ZonBlock {
  properties: Record<string, string | boolean>
  tables: ZonTable[]
  /** Optional annotation from #+BEGIN_ZON @annotation */
  annotation?: string
}

/**
 * Parse a ZON block (content between #+BEGIN_ZON and #+END_ZON)
 *
 * Supports:
 * - Key:value pairs (name:Alice)
 * - Booleans (active:T, disabled:F)
 * - Tables (users:@(N):col1,col2 followed by N data rows)
 * - Nested objects (config{database{host:localhost}}) - parsed as flat key
 */
export function parseZonBlock(content: string): ZonBlock {
  const lines = content.trim().split('\n')
  const properties: Record<string, string | boolean> = {}
  const tables: ZonTable[] = []

  let currentTable: ZonTable | null = null
  let expectedRows = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Table header: name:@(N):col1,col2,col3
    const tableMatch = trimmed.match(/^(\w+):@\((\d+)\):(.+)$/)
    if (tableMatch) {
      currentTable = {
        name: tableMatch[1],
        columns: tableMatch[3].split(',').map((c) => c.trim()),
        rows: [],
      }
      expectedRows = parseInt(tableMatch[2], 10)
      tables.push(currentTable)
      continue
    }

    // Table row (comma-separated values)
    if (currentTable && currentTable.rows.length < expectedRows) {
      currentTable.rows.push(trimmed.split(',').map((v) => v.trim()))
      continue
    }

    // Reset table context if we've collected all rows
    if (currentTable && currentTable.rows.length >= expectedRows) {
      currentTable = null
      expectedRows = 0
    }

    // Key:value pair
    const kvMatch = trimmed.match(/^([^:]+):(.*)$/)
    if (kvMatch) {
      const key = kvMatch[1].trim()
      const value = kvMatch[2].trim()

      // Boolean conversion
      if (value === 'T') properties[key] = true
      else if (value === 'F') properties[key] = false
      else properties[key] = value
    }
  }

  return { properties, tables }
}

/**
 * Extract all ZON blocks from org-mode content
 *
 * Matches:
 * - #+BEGIN_ZON ... #+END_ZON
 * - #+BEGIN_ZON @annotation ... #+END_ZON
 */
export function extractZonBlocks(orgContent: string): ZonBlock[] {
  const blocks: ZonBlock[] = []
  const regex = /#\+BEGIN_ZON(?:\s+@(\w+))?\n([\s\S]*?)#\+END_ZON/g

  let match
  while ((match = regex.exec(orgContent)) !== null) {
    const block = parseZonBlock(match[2])
    if (match[1]) {
      block.annotation = match[1]
    }
    blocks.push(block)
  }

  return blocks
}

/**
 * Context entry parsed from ZON table
 */
export interface ContextEntry {
  id: string
  path: string
  scope: 'session' | 'task' | 'ephemeral'
  priority: number
}

/**
 * Extract context entries from ZON blocks
 *
 * Looks for tables named "contexts" with columns:
 * id, path, scope, priority
 */
export function extractContextEntries(blocks: ZonBlock[]): ContextEntry[] {
  const entries: ContextEntry[] = []

  for (const block of blocks) {
    const contextTable = block.tables.find((t) => t.name === 'contexts')
    if (contextTable) {
      for (const row of contextTable.rows) {
        entries.push({
          id: row[0] || '',
          path: row[1] || '',
          scope: (row[2] as ContextEntry['scope']) || 'task',
          priority: parseInt(row[3], 10) || 5,
        })
      }
    }
  }

  // Sort by priority (higher first)
  return entries.sort((a, b) => b.priority - a.priority)
}

/**
 * Serialize a context entry back to ZON format
 */
export function serializeContextEntry(entry: ContextEntry): string {
  return `${entry.id},${entry.path},${entry.scope},${entry.priority}`
}

/**
 * Serialize multiple entries as a ZON table
 */
export function serializeContextTable(entries: ContextEntry[]): string {
  const header = `contexts:@(${entries.length}):id,path,scope,priority`
  const rows = entries.map(serializeContextEntry)
  return [header, ...rows].join('\n')
}
