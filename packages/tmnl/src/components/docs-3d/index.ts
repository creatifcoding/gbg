/**
 * 3D Documentation Components
 *
 * R3F + UIKit based documentation viewer with bento grid layout.
 * Uses effect-atom for reactive state management.
 *
 * @module docs-3d
 */

export { DocsLanding, default } from "./DocsLanding"
export {
  docNavigationMachine,
  selectFilteredCards,
  selectCategories,
  type DocCard,
  type DocNavContext,
  type DocNavEvents,
  type CameraTarget,
} from "./machines/docNavigationMachine"

// 3D Components
export { Docs3DScene, BentoCard3D } from "./components"
export type { Docs3DSceneProps, BentoCard3DProps } from "./components"

// Atoms (effect-atom state management)
export {
  cardsAtom,
  searchQueryAtom,
  categoryFilterAtom,
  selectedCardAtom,
  filteredCardsAtom,
  categoriesAtom,
  statsAtom,
} from "./atoms"
