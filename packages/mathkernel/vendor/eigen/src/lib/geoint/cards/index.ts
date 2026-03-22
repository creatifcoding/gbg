/**
 * GEOINT Entity Card System
 *
 * A DI-based card system for entity-centric views with:
 * - Trait-to-card binding via hybrid schema-driven + runtime registry
 * - Full behavior stack injection (renderers, actions, validation, persistence, lifecycle)
 * - Polymorphic rendering (popover/floating/panel)
 * - Fine-grained atom-per-value reactivity
 *
 * Architecture based on ECS patterns where SearchResult types ARE traits/components.
 *
 * @module geoint/cards
 */

export * from './registry'
export * from './traits'
export * from './renderers'
export * from './actions'
export * from './hooks'
