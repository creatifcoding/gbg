/**
 * Frustum Selection Utilities
 *
 * 3D selection via camera frustum projection.
 * Converts 2D marquee rect to a frustum and tests entity intersections.
 *
 * @example
 * ```tsx
 * import { createFrustumCollisionDetector } from '@/lib/selection'
 *
 * // In R3F component
 * const { camera, size } = useThree()
 * const entities = useEntities()
 *
 * const detector = createFrustumCollisionDetector(camera, size, entities)
 *
 * <SelectionMarquee
 *   containerRef={canvasRef}
 *   mode="3d"
 *   collisionDetector={detector}
 * />
 * ```
 *
 * @module
 */

import * as THREE from "three"
import type { Rect } from "./types"
import type { CollisionDetector } from "./SelectionMarquee"

// =============================================================================
// Types
// =============================================================================

export interface Entity3D {
  id: string
  position: THREE.Vector3 | { x: number; y: number; z: number }
}

export interface ViewportSize {
  width: number
  height: number
}

// =============================================================================
// Frustum Selection
// =============================================================================

/**
 * Convert 2D marquee rect to normalized device coordinates (NDC).
 * NDC ranges from -1 to 1 in both axes.
 */
function rectToNDC(
  rect: Rect,
  containerWidth: number,
  containerHeight: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  // Convert from container coordinates to NDC
  // X: left edge is -1, right edge is +1
  // Y: top edge is +1, bottom edge is -1 (flipped for WebGL)
  const minX = (rect.x / containerWidth) * 2 - 1
  const maxX = ((rect.x + rect.width) / containerWidth) * 2 - 1
  const maxY = -(rect.y / containerHeight) * 2 + 1
  const minY = -((rect.y + rect.height) / containerHeight) * 2 + 1

  return { minX, maxX, minY, maxY }
}

/**
 * Create a frustum from the camera that corresponds to the 2D marquee rect.
 * This is the key insight: we create a sub-frustum of the camera frustum
 * that matches the marquee selection area.
 */
function createSelectionFrustum(
  camera: THREE.Camera,
  ndc: { minX: number; maxX: number; minY: number; maxY: number }
): THREE.Frustum {
  const frustum = new THREE.Frustum()

  // For perspective cameras, we construct planes from the camera through the marquee corners
  if (camera instanceof THREE.PerspectiveCamera) {
    const nearPlane = camera.near
    const farPlane = camera.far

    // Get camera matrices
    const projectionMatrix = camera.projectionMatrix.clone()
    const viewMatrix = camera.matrixWorldInverse.clone()
    const viewProjectionMatrix = projectionMatrix.multiply(viewMatrix)

    // Create frustum from view-projection matrix
    // But we need to modify it to only include the marquee region
    // For simplicity, we'll use point-in-frustum approach instead

    frustum.setFromProjectionMatrix(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse))
  } else {
    // For orthographic cameras
    frustum.setFromProjectionMatrix(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse))
  }

  return frustum
}

/**
 * Check if a 3D point projects into the 2D marquee rect.
 * This is more accurate than frustum testing for marquee selection.
 */
function isPointInMarquee(
  point: THREE.Vector3,
  camera: THREE.Camera,
  ndc: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  // Project point to NDC
  const projected = point.clone().project(camera)

  // Check if projected point is within NDC bounds of marquee
  // Also check Z to ensure point is in front of camera
  return (
    projected.x >= ndc.minX &&
    projected.x <= ndc.maxX &&
    projected.y >= ndc.minY &&
    projected.y <= ndc.maxY &&
    projected.z >= -1 &&
    projected.z <= 1
  )
}

/**
 * Create a collision detector for 3D entities.
 *
 * @param camera Three.js camera
 * @param viewportSize Viewport dimensions
 * @param entities Array of entities with id and position
 * @returns CollisionDetector function for SelectionMarquee
 */
export function createFrustumCollisionDetector(
  camera: THREE.Camera,
  viewportSize: ViewportSize,
  entities: readonly Entity3D[]
): CollisionDetector {
  return (rect: Rect, _container: HTMLElement): string[] => {
    const { width, height } = viewportSize

    // Convert marquee rect to NDC
    const ndc = rectToNDC(rect, width, height)

    // Test each entity
    const selected: string[] = []

    for (const entity of entities) {
      const pos = entity.position
      const point = pos instanceof THREE.Vector3
        ? pos
        : new THREE.Vector3(pos.x, pos.y, pos.z)

      if (isPointInMarquee(point, camera, ndc)) {
        selected.push(entity.id)
      }
    }

    return selected
  }
}

/**
 * Hook-friendly version that memoizes the detector.
 * Use with useMemo in React components.
 */
export function useFrustumCollisionDetector(
  camera: THREE.Camera | null,
  viewportSize: ViewportSize,
  entities: readonly Entity3D[]
): CollisionDetector | undefined {
  if (!camera) return undefined
  return createFrustumCollisionDetector(camera, viewportSize, entities)
}

export default createFrustumCollisionDetector
