/**
 * Tauri Multi-Window Schemas
 *
 * Effect Schema definitions for window management types.
 * Mirrors the Rust types in src-tauri/src/window_manager.rs
 *
 * @module lib/tauri-windows/manager/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Window Info
// =============================================================================

/**
 * Information about an open window
 *
 * Note: We use NullOr instead of Option for Tauri IPC compatibility.
 * Rust returns `Option<T>` as `null | T` in JSON.
 */
export const WindowInfo = Schema.Struct({
  /** Unique window label (e.g., "testbed-fermion") */
  label: Schema.String,
  /** Testbed ID if this is a testbed window */
  testbed_id: Schema.NullOr(Schema.String),
  /** Window title */
  title: Schema.String,
  /** Whether this is the main window */
  is_main: Schema.Boolean,
  /** Whether this window is currently focused */
  is_focused: Schema.Boolean,
})

export type WindowInfo = Schema.Schema.Type<typeof WindowInfo>

// =============================================================================
// Window Configuration
// =============================================================================

/**
 * Configuration for creating a testbed window
 */
export const TestbedWindowConfig = Schema.Struct({
  /** Minimum width in pixels */
  min_width: Schema.optional(Schema.Number),
  /** Minimum height in pixels */
  min_height: Schema.optional(Schema.Number),
  /** Initial width in pixels */
  width: Schema.optional(Schema.Number),
  /** Initial height in pixels */
  height: Schema.optional(Schema.Number),
  /** Window title (defaults to testbed name) */
  title: Schema.optional(Schema.String),
})

export type TestbedWindowConfig = Schema.Schema.Type<typeof TestbedWindowConfig>

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error response from window operations
 */
export const WindowErrorResponse = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
})

export type WindowErrorResponse = Schema.Schema.Type<typeof WindowErrorResponse>

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate the window label for a testbed
 */
export function getWindowLabel(testbedId: string): string {
  return `testbed-${testbedId}`
}

/**
 * Extract testbed ID from a window label
 */
export function getTestbedIdFromLabel(label: string): string | undefined {
  if (label.startsWith('testbed-')) {
    return label.slice('testbed-'.length)
  }
  return undefined
}
