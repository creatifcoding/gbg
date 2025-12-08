/**
 * Overlay System — Schema Exports
 *
 * Central export point for all overlay schemas.
 * All types use TaggedStruct/TaggedClass for discriminated unions.
 */

// Re-export everything from core and events
// Schema constants and their .Type types share the same name
export * from "./core"
export * from "./events"
