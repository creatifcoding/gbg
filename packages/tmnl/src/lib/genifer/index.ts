/**
 * @fileoverview Genifer - Effect-native JSON-driven UI rendering
 *
 * Main entry point for the genifer library.
 * Re-exports core and react modules.
 */

// =============================================================================
// Core (Effect primitives, schemas, streaming)
// =============================================================================

export * from "./core"

// =============================================================================
// React (Components, hooks, providers)
// =============================================================================

export * as react from "./react"

// =============================================================================
// Server (Server-side registry, prompts, dynamic catalogs)
// =============================================================================

export * as server from "./server"

// =============================================================================
// Streaming (d2ts incremental JSON parser, service, hook, renderer)
// =============================================================================

export * as streaming from "./streaming"
