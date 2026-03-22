/**
 * HALFLIFE - Hypothesis Analysis Log For Lifecycle Investigation & Finding Evidence
 *
 * Type definitions for the findings tracking system.
 */

export type Severity = 'info' | 'warning' | 'critical'
export type Status = 'active' | 'mitigated' | 'fixed' | 'documented'
export type HypothesisId = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8' | 'H9' | 'H10' | 'OTHER'
export type EntryType = 'finding' | 'damage'

/**
 * Human-readable summary for the findings card
 */
export interface HumanContext {
  /** What happened in plain English */
  whatHappened: string
  /** Why this matters for the experiment */
  whyItMatters: string
  /** Optional: what we learned */
  lesson?: string
}

/**
 * Machine-readable context for AI assistance (collapsible in UI)
 */
export interface MachineContext {
  /** Source file path */
  file: string
  /** Line number where issue was found/fixed */
  line: number
  /** The problematic code pattern */
  pattern: string
  /** The fix applied */
  fix: string
  /** Git commit hash if available */
  commit: string | null
  /** Related code snippets */
  snippets?: {
    label: string
    code: string
    language: 'typescript' | 'tsx' | 'json'
  }[]
}

/**
 * Damage-specific context (implementation errors, refactor misses)
 */
export interface DamageContext {
  /** Parent finding ID this damage relates to */
  parentFinding: string | null
  /** Root cause of the damage */
  rootCause: string
  /** What was missed (grep output, audit gap) */
  whatWasMissed: string
  /** Prevention lesson */
  prevention: string
}

/**
 * A single entry in the HALFLIFE system (finding or damage)
 */
export interface Finding {
  /** Unique identifier (e.g., "H3.4" for finding, "H3.5.dmg1" for damage) */
  id: string
  /** Entry type: 'finding' = discovery, 'damage' = implementation error */
  type: EntryType
  /** Parent hypothesis this entry relates to */
  hypothesis: HypothesisId
  /** ISO 8601 timestamp when discovered */
  timestamp: string
  /** Short title */
  title: string
  /** One-line summary */
  summary: string
  /** Severity level */
  severity: Severity
  /** Current status */
  status: Status
  /** Human-readable context */
  human: HumanContext
  /** Machine-readable context (for AI/tooling) */
  machine: MachineContext
  /** Damage-specific context (only for type='damage') */
  damage?: DamageContext
  /** Tags for filtering */
  tags?: string[]
  /** Related entry IDs */
  related?: string[]
}

/**
 * Root structure of halflife.json
 */
export interface HalflifeData {
  /** Schema version for future migrations */
  version: '1.0' | '1.1'
  /** Last updated timestamp */
  lastUpdated: string
  /** All entries (findings + damage) */
  findings: Finding[]
}

/**
 * Grouping of findings by hypothesis for Kanban view
 */
export type FindingsByHypothesis = Record<HypothesisId, Finding[]>
