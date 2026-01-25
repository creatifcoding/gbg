/**
 * DocsLanding - 3D Rolodex Documentation Page
 *
 * Full-screen 3D rolodex viewer. Cards in cylindrical formation,
 * scroll to rotate, search to filter.
 *
 * @module docs-3d
 */

import { useEffect } from "react"
import { useAtomSet } from "@effect-atom/atom-react"
import type { DocCard } from "./machines/docNavigationMachine"
import { DIAGRAM_REGISTRY, type DiagramEntry } from "../docs/diagrams/registry"
import { Docs3DScene } from "./components"
import { cardsAtom } from "./atoms"

// =============================================================================
// Card Data from Diagram Registry
// =============================================================================

function diagramToCard(diagram: DiagramEntry): DocCard {
  return {
    id: diagram.id,
    title: diagram.title,
    description: diagram.description,
    category: diagram.category,
    span: diagram.category === "sequence" ? "triple" : "double",
    route: `/docs/diagrams#${diagram.id}`,
  }
}

// Additional documentation cards
const ADDITIONAL_CARDS: DocCard[] = [
  {
    id: "architecture-overview",
    title: "Architecture Overview",
    description: "High-level system architecture, module structure, and design principles.",
    category: "architecture",
    span: "double",
    route: "/docs",
  },
  {
    id: "effect-patterns",
    title: "Effect-TS Patterns",
    description: "Schema, Services, Layers, Atoms — the Effect patterns used throughout TMNL.",
    category: "guide",
    span: "double",
    route: "/docs",
  },
  {
    id: "animation-system",
    title: "Animation System",
    description: "GSAP/anime.js drivers, animatable atoms, and timing tokens.",
    category: "guide",
    span: "single",
    route: "/testbed",
  },
  {
    id: "slider-system",
    title: "DAW-Grade Sliders",
    description: "Behavior services, precision modifiers, and debug overlays.",
    category: "guide",
    span: "single",
    route: "/testbed/slider-v2",
  },
  {
    id: "data-manager",
    title: "Data Manager",
    description: "Service-scoped data orchestration with hybrid dispatch.",
    category: "architecture",
    span: "double",
    route: "/testbed/data-manager",
  },
]

// =============================================================================
// Main Component
// =============================================================================

export function DocsLanding() {
  const setCards = useAtomSet(cardsAtom)

  // Initialize cards on mount
  useEffect(() => {
    const diagramCards = DIAGRAM_REGISTRY.map(diagramToCard)
    const allCards = [...ADDITIONAL_CARDS, ...diagramCards]
    setCards(allCards)
  }, [setCards])

  return (
    <div className="h-screen w-screen bg-neutral-950">
      <Docs3DScene />
    </div>
  )
}

export default DocsLanding
