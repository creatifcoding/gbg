/**
 * @module odk/templates
 *
 * Template definitions for overlay scaffolding.
 * Each template specifies which facets to populate and what
 * seed methods to stub.
 *
 * Templates are pure data — no file I/O, no side effects.
 */

import type { TemplateConfig, TemplateName } from "./types.js"

// ── Template Definitions ─────────────────────────────────────────

const minimal: TemplateConfig = {
  name: "minimal",
  description: "Bare bones — methods + guide only",
  facets: ["methods", "guide"],
  seedMethods: [
    { name: "hello", arity: 0, description: "Smoke test — returns greeting" },
  ],
  includeGuide: true,
  includeSteer: false,
  includeLifecycle: false,
  includeTests: true,
}

const governance: TemplateConfig = {
  name: "governance",
  description: "Inspect, audit, enforce structure on workspace artifacts",
  facets: ["methods", "guide", "steer", "procedures", "lifecycle"],
  seedMethods: [
    { name: "discover", arity: 0, description: "List all artifacts" },
    { name: "inspect", arity: 1, description: "Deep-check a single artifact" },
    { name: "audit", arity: 0, description: "Workspace-wide health sweep" },
    { name: "conformance", arity: 1, description: "Grade an artifact 0-3" },
  ],
  includeGuide: true,
  includeSteer: true,
  includeLifecycle: true,
  includeTests: true,
}

const workflow: TemplateConfig = {
  name: "workflow",
  description: "Multi-step pipelines with persistent state",
  facets: ["methods", "guide", "lifecycle", "context", "procedures"],
  seedMethods: [
    { name: "start", arity: 1, description: "Begin a new pipeline run" },
    { name: "status", arity: 0, description: "Current pipeline state" },
    { name: "step", arity: 1, description: "Execute next step" },
    { name: "rollback", arity: 0, description: "Undo last step" },
    { name: "complete", arity: 0, description: "Finalize pipeline" },
  ],
  includeGuide: true,
  includeSteer: false,
  includeLifecycle: true,
  includeTests: true,
}

const full: TemplateConfig = {
  name: "full",
  description: "Reference implementation — all 11 facets populated",
  facets: [
    "methods", "guide", "steer", "profiles", "procedures",
    "context", "rendering", "errors", "lifecycle", "dispose", "version",
  ],
  seedMethods: [
    { name: "discover", arity: 0, description: "List all domain objects" },
    { name: "inspect", arity: 1, description: "Deep-check a single object" },
    { name: "audit", arity: 0, description: "Full domain health sweep" },
    { name: "status", arity: 0, description: "Domain state summary" },
  ],
  includeGuide: true,
  includeSteer: true,
  includeLifecycle: true,
  includeTests: true,
}

// ── Exports ──────────────────────────────────────────────────────

export const TEMPLATES: Record<TemplateName, TemplateConfig> = {
  minimal,
  governance,
  workflow,
  full,
}

/**
 * List all available template configs.
 */
export function listTemplates(): ReadonlyArray<TemplateConfig> {
  return Object.values(TEMPLATES)
}

/**
 * Get a specific template by name.
 */
export function getTemplate(name: TemplateName): TemplateConfig {
  return TEMPLATES[name]
}
