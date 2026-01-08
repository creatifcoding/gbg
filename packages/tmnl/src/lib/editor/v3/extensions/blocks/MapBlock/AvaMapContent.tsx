/**
 * AvaMapContent - AVA v2 Channel-bound Map Content
 *
 * Inner component for MapBlock when AVA channel binding is configured.
 * Separated to respect React's Rules of Hooks - this component is
 * conditionally RENDERED (not conditionally calling hooks).
 *
 * @see useViewSubscription, useChannelData from lib/ava/hooks/v2
 * @module editor/v3/extensions/blocks/MapBlock/AvaMapContent
 */

import { useEffect } from 'react'
import { useAtom } from '@effect-atom/atom-react'
import { Schema } from 'effect'

import { useViewSubscription, useChannelData } from '@/lib/ava/hooks/v2'
import { ViewId } from '@/lib/ava/schemas/v2'
import type { MapBlockAtoms, MarkerData } from './atoms'

// =============================================================================
// Types
// =============================================================================

/** GeoJSON Feature for type safety */
interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties?: Record<string, unknown>
}

/** GeoJSON FeatureCollection */
interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

export interface AvaMapContentProps {
  /** Decoded AVA View ID (branded type) */
  viewId: typeof ViewId.Type
  /** Channel ID within the view */
  channelId: string
  /** Block atoms instance */
  atoms: MapBlockAtoms
  /** Render function for the map UI */
  children: (props: {
    isConnected: boolean
    isLoading: boolean
    error: string | null
    subscribe: () => void
    unsubscribe: () => void
    invalidate: (reason?: string) => void
  }) => React.ReactNode
}

// =============================================================================
// GeoJSON → Markers Transform
// =============================================================================

/**
 * Transform GeoJSON FeatureCollection to MarkerData[].
 * Extracts Point features and maps them to markers.
 */
function geoJSONToMarkers(data: GeoJSONFeatureCollection): MarkerData[] {
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    return []
  }

  return data.features
    .filter((f): f is GeoJSONFeature => {
      return (
        f.type === 'Feature' &&
        f.geometry?.type === 'Point' &&
        Array.isArray(f.geometry.coordinates) &&
        f.geometry.coordinates.length >= 2
      )
    })
    .map((feature, index) => {
      const coords = feature.geometry.coordinates as [number, number]
      const props = feature.properties ?? {}

      // Parse color from properties
      let color: [number, number, number] = [34, 211, 238] // Default cyan
      const propsColor = props['color']
      if (propsColor) {
        if (Array.isArray(propsColor) && propsColor.length >= 3) {
          color = [propsColor[0], propsColor[1], propsColor[2]] as [number, number, number]
        } else if (typeof propsColor === 'string' && propsColor.startsWith('#')) {
          const hex = propsColor.slice(1)
          if (hex.length === 6) {
            color = [
              parseInt(hex.slice(0, 2), 16),
              parseInt(hex.slice(2, 4), 16),
              parseInt(hex.slice(4, 6), 16),
            ]
          }
        }
      }

      return {
        id: String(props['id'] ?? `feature-${index}`),
        position: [coords[0], coords[1]] as [number, number],
        color,
      }
    })
}

// =============================================================================
// Component
// =============================================================================

/**
 * AVA-bound map content component.
 *
 * This component is ONLY rendered when AVA channel binding is configured.
 * All hooks are called unconditionally at the top level, respecting
 * React's Rules of Hooks.
 *
 * @example
 * ```tsx
 * // In MapBlockView - conditional RENDERING, not conditional hooks
 * if (avaViewId) {
 *   return (
 *     <AvaMapContent viewId={decodedViewId} channelId="geojson" atoms={atoms}>
 *       {({ isConnected, isLoading }) => (
 *         <MapContent ... />
 *       )}
 *     </AvaMapContent>
 *   )
 * }
 * ```
 */
export function AvaMapContent({
  viewId,
  channelId,
  atoms,
  children,
}: AvaMapContentProps) {
  // Atom setters
  const [, setMarkers] = useAtom(atoms.markersAtom)
  const [, setIsLoading] = useAtom(atoms.isLoadingAtom)
  const [, setError] = useAtom(atoms.errorAtom)

  // AVA v2 hooks - called unconditionally (this component only mounts when AVA is configured)
  const { isSubscribed, subscribe, unsubscribe, invalidate } = useViewSubscription(viewId, true)
  const channel = useChannelData<GeoJSONFeatureCollection>(viewId, channelId)

  // Process channel data updates
  useEffect(() => {
    if (channel.isHydrated && channel.data) {
      const markers = geoJSONToMarkers(channel.data)
      setMarkers(markers)
      setIsLoading(false)
      setError(null)
    }
  }, [channel.isHydrated, channel.data, setMarkers, setIsLoading, setError])

  // Handle loading state
  useEffect(() => {
    if (channel.isLoading) {
      setIsLoading(true)
    }
  }, [channel.isLoading, setIsLoading])

  // Handle errors
  useEffect(() => {
    if (channel.isError && channel.error) {
      setError(channel.error)
      setIsLoading(false)
    }
  }, [channel.isError, channel.error, setError, setIsLoading])

  // Render children with AVA state
  return (
    <>
      {children({
        isConnected: isSubscribed,
        isLoading: channel.isLoading,
        error: channel.error,
        subscribe,
        unsubscribe,
        invalidate,
      })}
    </>
  )
}

// =============================================================================
// Helper: Try to decode ViewId
// =============================================================================

const decodeViewId = Schema.decodeOption(ViewId)

/**
 * Attempt to decode a string to ViewId branded type.
 * Returns null if invalid.
 */
export function tryDecodeViewId(viewId: string | null | undefined): typeof ViewId.Type | null {
  if (!viewId) return null
  const result = decodeViewId(viewId)
  return result._tag === 'Some' ? result.value : null
}
