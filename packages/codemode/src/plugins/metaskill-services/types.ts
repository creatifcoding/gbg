/**
 * @module plugins/metaskill-services/types
 *
 * Shared domain types for the metaskill plugin.
 * Extracted from the monolithic api.ts for reuse across services.
 */

// ── Skill Classification ─────────────────────────────────────────

export type SkillType = "leaf" | "reference" | "operational"

// ── Discovery Types ──────────────────────────────────────────────

export interface SkillInfo {
  name: string
  path: string
  type: SkillType
  governed: boolean
  fileCount: number
  files: string[]
  hasChangelog: boolean
  hasGraph: boolean
  hasUtils: boolean
  hasRefs: boolean
  hasTemplate: boolean
}

// ── Inspection Types ─────────────────────────────────────────────

export interface HealthCheck {
  name: string
  pass: boolean
  detail?: string
}

export interface HealthReport {
  skill: string
  path: string
  checks: HealthCheck[]
  passed: number
  total: number
  clean: boolean
  summary: string
}

export interface WorkspaceRow {
  name: string
  governed: boolean
  fileCount: number
  hasChangelog: boolean
  fmMissing: number
}

// ── Conformance Types ────────────────────────────────────────────

export interface ConformanceResult {
  name: string
  level: number
  label: string
  type: SkillType
  detail: string[]
}

// ── Util Types ───────────────────────────────────────────────────

export interface UtilInfo {
  name: string
  file: string
  description: string
}

export interface UtilResult {
  util: string
  skill: string
  output: string
  exitCode: number
}

// ── Freshness Types ──────────────────────────────────────────────

export type UpdateStatus = "current" | "stale" | "pending"

export interface UpdatePolicy {
  file: string
  skill: string
  status: UpdateStatus
  lastUpdated?: string
}

export interface FreshnessReport {
  skill: string
  total: number
  current: number
  stale: number
  pending: number
  policies: UpdatePolicy[]
}

// ── Profile Types ────────────────────────────────────────────────

export interface ProfileResult {
  name: string
  health: string
  level: number
  label: string
  type: SkillType
  policies: number
  stale: number
  clean: boolean
}
