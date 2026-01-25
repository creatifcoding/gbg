/**
 * Documentation Atoms
 *
 * effect-atom state management for 3D docs viewer.
 *
 * PATTERN:
 * - Atom.make(value) creates writable atom
 * - Atom.make((get) => ...) creates derived (read-only) atom
 * - useAtomValue(atom) to read in React
 * - useAtomSet(atom) to get setter in React (returns function)
 *
 * @module docs-3d/atoms
 */

import { Atom } from "@effect-atom/atom"
import type { DocCard } from "../machines/docNavigationMachine"

// =============================================================================
// Core State Atoms (Writable)
// =============================================================================

/** All documentation cards */
export const cardsAtom = Atom.make<readonly DocCard[]>([])

/** Current search query */
export const searchQueryAtom = Atom.make("")

/** Selected category filter (null = all) */
export const categoryFilterAtom = Atom.make<string | null>(null)

/** Currently selected card (for detail view) */
export const selectedCardAtom = Atom.make<DocCard | null>(null)

// =============================================================================
// Derived Atoms (Read-only, auto-update when dependencies change)
// =============================================================================

/** Filtered cards based on search and category */
export const filteredCardsAtom = Atom.make((get) => {
  const cards = get(cardsAtom)
  const query = get(searchQueryAtom).toLowerCase()
  const category = get(categoryFilterAtom)

  return cards.filter((card) => {
    const matchesSearch =
      !query ||
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query)

    const matchesCategory = !category || card.category === category

    return matchesSearch && matchesCategory
  })
})

/** Unique categories from all cards */
export const categoriesAtom = Atom.make((get) => {
  const cards = get(cardsAtom)
  const categories = new Set<string>()
  for (const card of cards) {
    categories.add(card.category)
  }
  return Array.from(categories).sort()
})

/** Card count stats */
export const statsAtom = Atom.make((get) => {
  const total = get(cardsAtom).length
  const visible = get(filteredCardsAtom).length
  return { total, visible }
})
