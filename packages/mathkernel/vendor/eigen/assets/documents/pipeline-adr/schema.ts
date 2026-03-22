/**
 * Pipeline ADR Schema
 *
 * Uniform document structure for JSON digest compatibility.
 * Commit Hash: 6656064
 * Date: 2026-01-02
 */

// ─────────────────────────────────────────────────────────────────────────────
// Status Types
// ─────────────────────────────────────────────────────────────────────────────

export type ADRStatus = 'draft' | 'review' | 'accepted' | 'superseded'

export type ADRTier = 'isolated' | 'pair-adjacent' | 'pair-synergy' | 'triplet-sequential' | 'triplet-crosscut'

// ─────────────────────────────────────────────────────────────────────────────
// Technology & Pattern Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Technology {
  name: string
  version?: string
  purpose: string
  file?: string  // Reference to codebase file
}

export interface Pattern {
  name: string
  description: string
  example?: string  // Code snippet or reference
}

export interface Interface {
  name: string
  from: string  // Stage ID
  to: string    // Stage ID
  protocol: string
  schema?: string  // TypeScript type or Schema reference
}

// ─────────────────────────────────────────────────────────────────────────────
// Rationale Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Alternative {
  name: string
  description: string
  rejectionReason: string
}

export interface Tradeoff {
  gain: string
  cost: string
}

export interface Risk {
  description: string
  likelihood: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigation: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FileSpec {
  path: string
  action: 'create' | 'modify' | 'delete'
  description: string
}

export interface Migration {
  version: string
  description: string
  sql?: string
  rollback?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  path: string  // JSON path to section being commented on
  author: string
  content: string
  timestamp: string  // ISO 8601
  resolved: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ADRContext {
  stages: string[]           // Stage IDs covered (e.g., ["S1"] or ["S1", "S2"])
  problem: string            // What problem does this solve?
  constraints: string[]      // Hard requirements
  assumptions: string[]      // Soft assumptions
}

export interface ADRDecision {
  summary: string            // 1-2 sentence decision
  technologies: Technology[] // Specific tech choices
  patterns: Pattern[]        // Design patterns applied
  interfaces: Interface[]    // API contracts between stages
}

export interface ADRRationale {
  alternatives: Alternative[] // What else was considered?
  tradeoffs: Tradeoff[]       // What are we giving up?
  risks: Risk[]               // What could go wrong?
}

export interface ADRImplementation {
  files: FileSpec[]           // Files to create/modify
  dependencies: string[]      // Package dependencies
  migrations: Migration[]     // Data migrations if any
  testStrategy: string        // How to verify
}

export interface ADRMetadata {
  tier: ADRTier
  reviewers: string[]
  comments: Comment[]         // For annotation
  supersedes?: string         // Previous ADR ID
  supersededBy?: string       // Replacement ADR ID
  relatedADRs: string[]       // Cross-references
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ADR Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineADR {
  // Header
  id: string                  // e.g., "S3" or "S2-S3" or "S7-S8-S9"
  title: string
  commitHash: string          // "6656064"
  status: ADRStatus
  date: string                // ISO 8601

  // Sections
  context: ADRContext
  decision: ADRDecision
  rationale: ADRRationale
  implementation: ADRImplementation
  metadata: ADRMetadata
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage Reference
// ─────────────────────────────────────────────────────────────────────────────

export const PIPELINE_STAGES = {
  S1: { name: 'Physical', description: 'Sensor, ADC, firmware, encoding', tech: 'ESP32, SenML' },
  S2: { name: 'Edge', description: 'Gateway, aggregation, buffering', tech: 'Rust adapter' },
  S3: { name: 'Transport', description: 'Broker, pub/sub, QoS', tech: 'NATS JetStream' },
  S4: { name: 'Ingestion', description: 'Validation, transformation, routing', tech: 'Effect.Service' },
  S5: { name: 'Storage', description: 'KV store, TSDB, event log', tech: 'NATS KV, SQLite' },
  S6: { name: 'Client Transport', description: 'WebSocket, SSE, reconnection', tech: 'nats.ws, SSEAdapter' },
  S7: { name: 'Filtering', description: 'Dead-band, decimation, backpressure', tech: 'OPC UA pattern' },
  S8: { name: 'State', description: 'Atoms, derived state, Result', tech: 'effect-atom, Registry' },
  S9: { name: 'React', description: 'Subscription, render, DOM', tech: 'useAtomValue, memo' },
} as const

export type StageId = keyof typeof PIPELINE_STAGES

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function createEmptyADR(id: string, title: string, tier: ADRTier, stages: string[]): PipelineADR {
  return {
    id,
    title,
    commitHash: '6656064',
    status: 'draft',
    date: new Date().toISOString().split('T')[0],
    context: {
      stages,
      problem: '',
      constraints: [],
      assumptions: [],
    },
    decision: {
      summary: '',
      technologies: [],
      patterns: [],
      interfaces: [],
    },
    rationale: {
      alternatives: [],
      tradeoffs: [],
      risks: [],
    },
    implementation: {
      files: [],
      dependencies: [],
      migrations: [],
      testStrategy: '',
    },
    metadata: {
      tier,
      reviewers: [],
      comments: [],
      relatedADRs: [],
    },
  }
}
