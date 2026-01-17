/**
 * CTL TUI Module
 *
 * OpenTUI-based component library for terminal user interfaces.
 *
 * Usage:
 * ```tsx
 * // In any component file, add the pragma at the top:
 * // @jsxImportSource @opentui/react
 *
 * import { Box, Text, Input, Select } from "./tui/primitives"
 * import { createRoot } from "@opentui/react"
 * import { createCliRenderer } from "@opentui/core"
 *
 * const renderer = await createCliRenderer()
 * createRoot(renderer).render(<MyApp />)
 * ```
 */

// Primitives
export * from "./primitives"

// Compound Components
export * from "./components"

// Hooks
export * from "./hooks"

// Re-export root creation utilities
export { createRoot } from "@opentui/react"
export { createCliRenderer } from "@opentui/core"
