/**
 * @fileoverview Genifer Prompt Compiler — barrel exports
 *
 * Two-stage LLM pipeline:
 * 1. Compiler (fast model + tools) → refined structural prompt
 * 2. Generator (strong model) → streaming genifer JSON → UI tree
 *
 * Plus Raindrop eval harness for A/B testing across models.
 *
 * @module genifer/compiler
 */

// Tools
export {
  CatalogQueryTool,
  SchemaCheckTool,
  NormalizePreviewTool,
  ExampleLookupTool,
  CompilerToolkit,
  CompilerToolkitLive,
} from "./tools"

// Service
export { PromptCompiler, PromptCompilerLive } from "./PromptCompiler"
export type {
  PromptCompilerShape,
  OperatingContext,
  CompiledPrompt,
} from "./PromptCompiler"

// Eval
export { createEvalHarness } from "./eval"
export type { EvalConfig, EvalResult } from "./eval"
