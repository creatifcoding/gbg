/**
 * BFTA Tests — Bottom-Up Finite Tree Automaton
 *
 * Tests grammar construction (Effect Graph), emptiness check,
 * DAG validation, and incremental runtime validation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { HashSet, Option, Graph } from 'effect'
import {
  buildGrammar,
  isLanguageEmpty,
  isConstraintDAG,
  grammarToMermaid,
  createBFTAValidator,
  type ComponentRegistration,
  type Grammar,
  type ValidationResult,
} from '../../streaming/bfta.js'

// =============================================================================
// Fixtures
// =============================================================================

const LAYOUT_REGISTRATIONS: ComponentRegistration[] = [
  { type: 'Grid', hasChildren: true, allowedChildren: ['GridItem'] },
  { type: 'GridItem', hasChildren: true },
  { type: 'Flex', hasChildren: true },
  { type: 'Stack', hasChildren: true },
  { type: 'Text', hasChildren: false },
  { type: 'Image', hasChildren: false },
  { type: 'Card', hasChildren: true },
]

// =============================================================================
// Grammar Construction
// =============================================================================

describe('Grammar Construction', () => {
  let grammar: Grammar

  beforeEach(() => {
    grammar = buildGrammar(LAYOUT_REGISTRATIONS)
  })

  it('builds alphabet from all registered types', () => {
    expect(HashSet.size(grammar.alphabet)).toBe(7)
    expect(HashSet.has(grammar.alphabet, 'Grid')).toBe(true)
    expect(HashSet.has(grammar.alphabet, 'Text')).toBe(true)
    expect(HashSet.has(grammar.alphabet, 'Image')).toBe(true)
  })

  it('identifies leaf types', () => {
    expect(HashSet.has(grammar.leaves, 'Text')).toBe(true)
    expect(HashSet.has(grammar.leaves, 'Image')).toBe(true)
    expect(HashSet.has(grammar.leaves, 'Grid')).toBe(false)
  })

  it('identifies wildcard parents (no explicit allowedChildren)', () => {
    // Flex, Stack, GridItem, Card accept any child
    expect(HashSet.has(grammar.wildcardParents, 'Flex')).toBe(true)
    expect(HashSet.has(grammar.wildcardParents, 'Stack')).toBe(true)
    expect(HashSet.has(grammar.wildcardParents, 'Card')).toBe(true)
    // Grid has explicit allowedChildren
    expect(HashSet.has(grammar.wildcardParents, 'Grid')).toBe(false)
  })

  it('creates constraint edges for explicit parent→child rules', () => {
    // Grid → GridItem edge should exist
    expect(Graph.edgeCount(grammar.graph)).toBeGreaterThan(0)
  })

  it('creates correct number of nodes', () => {
    expect(Graph.nodeCount(grammar.graph)).toBe(7)
  })
})

// =============================================================================
// Grammar Properties
// =============================================================================

describe('Grammar Properties', () => {
  it('constraint graph is acyclic for normal registrations', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    expect(isConstraintDAG(grammar)).toBe(true)
  })

  it('language is NOT empty for valid registrations', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    expect(isLanguageEmpty(grammar)).toBe(false)
  })

  it('language IS empty when no types registered', () => {
    const grammar = buildGrammar([])
    expect(isLanguageEmpty(grammar)).toBe(true)
  })

  it('language is NOT empty with only leaves', () => {
    const grammar = buildGrammar([
      { type: 'Text', hasChildren: false },
    ])
    expect(isLanguageEmpty(grammar)).toBe(false)
  })

  it('generates Mermaid diagram', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const mermaid = grammarToMermaid(grammar)
    expect(mermaid).toContain('flowchart')
  })
})

// =============================================================================
// BFTA Validator — Leaf validation
// =============================================================================

describe('BFTA Validator — Leaves', () => {
  it('accepts a leaf node with no children', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    validator.pushNode('Text', 'text-1', 1)
    const state = validator.popNode(1)

    expect(state.accepted).toBe(true)
    expect(results).toHaveLength(1)
    expect(results[0].componentType).toBe('Text')
    expect(results[0].accepted).toBe(true)
  })

  it('rejects a leaf node with children', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    // Simulate: Text { Image }
    validator.pushNode('Text', 'text-1', 1)
    validator.pushNode('Image', 'img-1', 2)
    validator.popNode(2) // Image closes → child of Text
    const state = validator.popNode(1) // Text closes with child

    expect(state.accepted).toBe(false)
    expect(state.reason).toContain('leaf')
  })
})

// =============================================================================
// BFTA Validator — Parent-child constraints
// =============================================================================

describe('BFTA Validator — Constraints', () => {
  it('accepts Grid with GridItem children', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    // Grid { GridItem, GridItem }
    validator.pushNode('Grid', 'grid-1', 1)
    validator.pushNode('GridItem', 'gi-1', 2)
    validator.popNode(2)
    validator.pushNode('GridItem', 'gi-2', 2)
    validator.popNode(2)
    const state = validator.popNode(1)

    expect(state.accepted).toBe(true)
  })

  it('rejects Grid with non-GridItem children', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    // Grid { Text } — Text is not an allowed child of Grid
    validator.pushNode('Grid', 'grid-1', 1)
    validator.pushNode('Text', 'text-1', 2)
    validator.popNode(2)
    const state = validator.popNode(1)

    expect(state.accepted).toBe(false)
    expect(state.reason).toContain('does not accept Text')
    expect(state.reason).toContain('GridItem')
  })

  it('accepts wildcard parents with any children', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    // Flex { Text, Image, Card }
    validator.pushNode('Flex', 'flex-1', 1)
    validator.pushNode('Text', 't-1', 2)
    validator.popNode(2)
    validator.pushNode('Image', 'i-1', 2)
    validator.popNode(2)
    validator.pushNode('Card', 'c-1', 2)
    validator.popNode(2)
    const state = validator.popNode(1)

    expect(state.accepted).toBe(true)
  })
})

// =============================================================================
// BFTA Validator — Unknown types
// =============================================================================

describe('BFTA Validator — Unknown types', () => {
  it('fires onUnknownType callback for unregistered components', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const unknowns: string[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: () => {},
      onUnknownType: (type) => unknowns.push(type),
    })

    validator.pushNode('FancyWidget', 'fw-1', 1)
    validator.popNode(1)

    expect(unknowns).toEqual(['FancyWidget'])
  })

  it('gracefully accepts unknown types (no crash)', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const validator = createBFTAValidator(grammar, {
      onValidated: () => {},
    })

    validator.pushNode('Unknown', 'u-1', 1)
    const state = validator.popNode(1)

    expect(state.accepted).toBe(true) // graceful
    expect(state.reason).toContain('Unknown type')
  })
})

// =============================================================================
// BFTA Validator — Nested validation
// =============================================================================

describe('BFTA Validator — Nested trees', () => {
  it('validates a full nested tree: Grid > GridItem > Card > Text', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    validator.pushNode('Grid', 'grid', 0)
    validator.pushNode('GridItem', 'gi', 1)
    validator.pushNode('Card', 'card', 2)
    validator.pushNode('Text', 'text', 3)
    validator.popNode(3)  // Text ✓
    validator.popNode(2)  // Card(Text) ✓
    validator.popNode(1)  // GridItem(Card) ✓
    const root = validator.popNode(0)  // Grid(GridItem) ✓

    expect(results).toHaveLength(4)
    expect(results.every((r) => r.accepted)).toBe(true)
    expect(root.accepted).toBe(true)
  })

  it('rejects deep in tree: Grid > Text (not GridItem)', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const results: ValidationResult[] = []
    const validator = createBFTAValidator(grammar, {
      onValidated: (r) => results.push(r),
    })

    validator.pushNode('Grid', 'grid', 0)
    validator.pushNode('Text', 'text', 1)
    validator.popNode(1)  // Text ✓ (leaf valid on its own)
    const root = validator.popNode(0)  // Grid(Text) ✗

    expect(results[0].accepted).toBe(true)   // Text itself is valid
    expect(results[1].accepted).toBe(false)  // Grid rejects Text child
    expect(root.accepted).toBe(false)
  })

  it('reset clears validator state', () => {
    const grammar = buildGrammar(LAYOUT_REGISTRATIONS)
    const validator = createBFTAValidator(grammar, {
      onValidated: () => {},
    })

    validator.pushNode('Grid', 'g', 0)
    expect(validator.hasOpenNodes).toBe(true)

    validator.reset()
    expect(validator.hasOpenNodes).toBe(false)
  })
})

// =============================================================================
// requiresChildren constraint
// =============================================================================

describe('BFTA Validator — requiresChildren', () => {
  it('rejects container that requires children but has none', () => {
    const grammar = buildGrammar([
      { type: 'TabGroup', hasChildren: true, requiresChildren: true },
      { type: 'Tab', hasChildren: true },
    ])
    const validator = createBFTAValidator(grammar, {
      onValidated: () => {},
    })

    validator.pushNode('TabGroup', 'tg', 0)
    const state = validator.popNode(0)

    expect(state.accepted).toBe(false)
    expect(state.reason).toContain('requires at least one child')
  })
})
