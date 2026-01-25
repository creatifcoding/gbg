/**
 * Spike Configuration & Pattern Schemas
 *
 * Effect Schema definitions for spike configs, hypothesis templates,
 * and the autopoietic pattern store.
 *
 * @skill spikectl/core
 */

import { Schema } from "effect"

// =============================================================================
// Hypothesis Configuration
// =============================================================================

export const HypothesisConfig = Schema.Struct({
  id: Schema.String.pipe(
    Schema.annotations({ description: "Hypothesis ID (e.g., H1, H2)" })
  ),
  description: Schema.String.pipe(
    Schema.annotations({ description: "Short description of the hypothesis" })
  ),
  claim: Schema.String.pipe(
    Schema.annotations({ description: "Falsifiable claim to test" })
  ),
  acceptanceCriteria: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: "Criteria for pass/fail" })
    )
  ),
})

export type HypothesisConfig = typeof HypothesisConfig.Type

// =============================================================================
// Spike Metadata
// =============================================================================

export const SpikeMetadata = Schema.Struct({
  name: Schema.String.pipe(
    Schema.annotations({ description: "Spike name (used for function names)" })
  ),
  topic: Schema.String.pipe(
    Schema.annotations({ description: "Topic description" })
  ),
  author: Schema.optional(Schema.String),
  date: Schema.optional(Schema.String),
  issueRef: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: "Related issue ID (e.g., beads-123)" })
    )
  ),
  relatedFiles: Schema.optional(Schema.Array(Schema.String)),
  expectedOutcome: Schema.optional(Schema.String),
})

export type SpikeMetadata = typeof SpikeMetadata.Type

// =============================================================================
// Spike Paths
// =============================================================================

export const SpikePaths = Schema.Struct({
  outputDir: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: "Output directory (default: scripts/)" })
    )
  ),
  outputFilename: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: "Output filename (default: spike-<name>.ts)" })
    )
  ),
})

export type SpikePaths = typeof SpikePaths.Type

// =============================================================================
// Spike Setup (Scaffolding)
// =============================================================================

export const SpikeFileTemplate = Schema.Struct({
  path: Schema.String.pipe(
    Schema.annotations({ description: "Relative file path to create" })
  ),
  content: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: "File content (inline)" })
    )
  ),
  template: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: "Template name (e.g., 'effect-service', 'react-component')",
      })
    )
  ),
  vars: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})

export type SpikeFileTemplate = typeof SpikeFileTemplate.Type

export const SpikeSetup = Schema.Struct({
  directories: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: "Directories to create (relative paths)" })
    )
  ),
  files: Schema.optional(
    Schema.Array(SpikeFileTemplate).pipe(
      Schema.annotations({ description: "Files to generate as part of spike setup" })
    )
  ),
  fixtures: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: "Test fixture data (JSON)" })
    )
  ),
})

export type SpikeSetup = typeof SpikeSetup.Type

// =============================================================================
// Spike Configuration (Main Config File)
// =============================================================================

export const SpikeConfig = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  metadata: SpikeMetadata,
  paths: Schema.optional(SpikePaths),
  setup: Schema.optional(SpikeSetup),
  hypotheses: Schema.Array(HypothesisConfig).pipe(
    Schema.annotations({ description: "Hypotheses to test (H1-H4+)" })
  ),
})

export type SpikeConfig = typeof SpikeConfig.Type

// =============================================================================
// Pattern Storage (Autopoietic System)
// =============================================================================

export const SpikeFix = Schema.Struct({
  rootCause: Schema.String.pipe(
    Schema.annotations({ description: "What was the root cause" })
  ),
  fix: Schema.String.pipe(
    Schema.annotations({ description: "How it was fixed" })
  ),
  appliedAt: Schema.String.pipe(
    Schema.annotations({ description: "ISO date when fix was applied" })
  ),
})

export type SpikeFix = typeof SpikeFix.Type

export const SpikePattern = Schema.Struct({
  id: Schema.String.pipe(
    Schema.annotations({ description: "Unique pattern identifier" })
  ),
  errorSignature: Schema.String.pipe(
    Schema.annotations({ description: "Regex pattern that triggers this" })
  ),
  domain: Schema.String.pipe(
    Schema.annotations({ description: "Domain category (e.g., encoding, datetime)" })
  ),
  hypothesisTemplate: Schema.Array(HypothesisConfig).pipe(
    Schema.annotations({ description: "H1-H4 templates" })
  ),
  successCount: Schema.Number.pipe(
    Schema.annotations({ description: "Times this pattern led to a fix" })
  ),
  failureCount: Schema.Number.pipe(
    Schema.annotations({ description: "Times this pattern didn't help" })
  ),
  lastUsed: Schema.NullOr(Schema.String).pipe(
    Schema.annotations({ description: "ISO date of last use" })
  ),
  fixes: Schema.Array(SpikeFix).pipe(
    Schema.annotations({ description: "Recorded fixes from this pattern" })
  ),
  tags: Schema.Array(Schema.String).pipe(
    Schema.annotations({ description: "Searchable tags" })
  ),
})

export type SpikePattern = typeof SpikePattern.Type

export const SpikePatternStore = Schema.Struct({
  version: Schema.Literal("1.0"),
  patterns: Schema.Array(SpikePattern),
  lastEvolved: Schema.NullOr(Schema.String).pipe(
    Schema.annotations({ description: "ISO date of last evolution" })
  ),
})

export type SpikePatternStore = typeof SpikePatternStore.Type

// =============================================================================
// Agent Steering
// =============================================================================

export const SpikeSteeringAction = Schema.Literal(
  "CREATE_SPIKE",
  "IMPLEMENT_SPIKE",
  "RUN_SPIKE",
  "LEARN_SPIKE"
)

export type SpikeSteeringAction = typeof SpikeSteeringAction.Type

export const SpikeSteeringMessage = Schema.Struct({
  action: SpikeSteeringAction,
  file: Schema.optional(Schema.String),
  suggestedName: Schema.optional(Schema.String),
  patternMatch: Schema.optional(Schema.NullOr(Schema.String)),
  hypotheses: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        claim: Schema.String,
      })
    )
  ),
  nextCommand: Schema.String,
  skills: Schema.Array(Schema.String),
})

export type SpikeSteeringMessage = typeof SpikeSteeringMessage.Type
