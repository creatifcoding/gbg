/**
 * GEOINT Map Operations Test Suite
 *
 * Verifies panel-scoped map operations:
 * - zoomIn/zoomOut (clamped to MIN/MAX_ZOOM)
 * - resetView (returns to default viewport)
 * - Panel isolation (different panels have independent state)
 *
 * @module geoint/atoms/__tests__/mapOperations
 */

import { describe, it, expect } from 'vitest'
import { geointRegistry } from '../index'
import { asPanelId, getPanelAtoms } from '../families'
import { createMapOperations } from '../mapOperations'
import type { ViewportState } from '../families'

describe('GEOINT Map Operations', () => {
  // ===========================================================================
  // ZOOM OPERATIONS
  // ===========================================================================

  describe('zoomIn', () => {
    it('should increment zoom by 1', () => {
      const panelId = asPanelId('test-zoom-in')
      const atoms = getPanelAtoms(panelId)

      // Set initial zoom
      geointRegistry.set(atoms.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 10,
        pitch: 0,
        bearing: 0,
      })

      const ops = createMapOperations(panelId)
      ops.zoomIn()

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport.zoom).toBe(11)
    })

    it('should clamp zoom to MAX_ZOOM (22)', () => {
      const panelId = asPanelId('test-zoom-max')
      const atoms = getPanelAtoms(panelId)

      // Set zoom to max
      geointRegistry.set(atoms.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 22,
        pitch: 0,
        bearing: 0,
      })

      const ops = createMapOperations(panelId)
      ops.zoomIn()

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport.zoom).toBe(22) // Should not exceed MAX_ZOOM
    })

    it('should preserve other viewport properties', () => {
      const panelId = asPanelId('test-zoom-preserve')
      const atoms = getPanelAtoms(panelId)

      const initial: ViewportState = {
        longitude: -122.4,
        latitude: 37.8,
        zoom: 10,
        pitch: 45,
        bearing: 90,
      }

      geointRegistry.set(atoms.viewportAtom, initial)

      const ops = createMapOperations(panelId)
      ops.zoomIn()

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport.longitude).toBe(-122.4)
      expect(viewport.latitude).toBe(37.8)
      expect(viewport.pitch).toBe(45)
      expect(viewport.bearing).toBe(90)
      expect(viewport.zoom).toBe(11)
    })
  })

  describe('zoomOut', () => {
    it('should decrement zoom by 1', () => {
      const panelId = asPanelId('test-zoom-out')
      const atoms = getPanelAtoms(panelId)

      geointRegistry.set(atoms.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 10,
        pitch: 0,
        bearing: 0,
      })

      const ops = createMapOperations(panelId)
      ops.zoomOut()

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport.zoom).toBe(9)
    })

    it('should clamp zoom to MIN_ZOOM (0)', () => {
      const panelId = asPanelId('test-zoom-min')
      const atoms = getPanelAtoms(panelId)

      geointRegistry.set(atoms.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 0,
        pitch: 0,
        bearing: 0,
      })

      const ops = createMapOperations(panelId)
      ops.zoomOut()

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport.zoom).toBe(0) // Should not go below MIN_ZOOM
    })
  })

  // ===========================================================================
  // RESET VIEW
  // ===========================================================================

  describe('resetView', () => {
    it('should reset viewport to default (San Francisco, zoom 12)', () => {
      const panelId = asPanelId('test-reset')
      const atoms = getPanelAtoms(panelId)

      // Set custom viewport
      geointRegistry.set(atoms.viewportAtom, {
        longitude: 0,
        latitude: 51.5,
        zoom: 18,
        pitch: 60,
        bearing: 180,
      })

      const ops = createMapOperations(panelId)
      ops.resetView()

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport).toEqual({
        longitude: -122.42,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
      })
    })
  })

  // ===========================================================================
  // PANEL ISOLATION
  // ===========================================================================

  describe('Panel Isolation', () => {
    it('should maintain independent zoom state per panel', () => {
      const panel1 = asPanelId('iso-panel-1')
      const panel2 = asPanelId('iso-panel-2')

      const atoms1 = getPanelAtoms(panel1)
      const atoms2 = getPanelAtoms(panel2)

      // Set different initial zooms
      geointRegistry.set(atoms1.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 10,
        pitch: 0,
        bearing: 0,
      })

      geointRegistry.set(atoms2.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 15,
        pitch: 0,
        bearing: 0,
      })

      const ops1 = createMapOperations(panel1)

      // Zoom in on panel 1
      ops1.zoomIn()

      // Verify panel 1 changed
      expect(geointRegistry.get(atoms1.viewportAtom).zoom).toBe(11)

      // Verify panel 2 unchanged
      expect(geointRegistry.get(atoms2.viewportAtom).zoom).toBe(15)
    })

    it('should support 3+ panels with independent operations', () => {
      const panels = [
        asPanelId('multi-panel-1'),
        asPanelId('multi-panel-2'),
        asPanelId('multi-panel-3'),
      ]

      const allAtoms = panels.map(getPanelAtoms)
      const allOps = panels.map(createMapOperations)

      // Set initial zoom for all panels
      allAtoms.forEach((atoms, index) => {
        geointRegistry.set(atoms.viewportAtom, {
          longitude: 0,
          latitude: 0,
          zoom: 10 + index, // 10, 11, 12
          pitch: 0,
          bearing: 0,
        })
      })

      // Different operations on each panel
      allOps[0].zoomIn()  // 10 → 11
      allOps[1].zoomOut() // 11 → 10
      allOps[2].resetView() // 12 → default (12)

      // Verify independent state
      expect(geointRegistry.get(allAtoms[0].viewportAtom).zoom).toBe(11)
      expect(geointRegistry.get(allAtoms[1].viewportAtom).zoom).toBe(10)
      expect(geointRegistry.get(allAtoms[2].viewportAtom).zoom).toBe(12)
    })
  })

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  describe('Helper Methods', () => {
    it('setViewport should partially update viewport', () => {
      const panelId = asPanelId('test-set-viewport')
      const atoms = getPanelAtoms(panelId)

      geointRegistry.set(atoms.viewportAtom, {
        longitude: 0,
        latitude: 0,
        zoom: 10,
        pitch: 0,
        bearing: 0,
      })

      const ops = createMapOperations(panelId)
      ops.setViewport({ zoom: 15, longitude: -95.0 })

      const viewport = geointRegistry.get(atoms.viewportAtom)
      expect(viewport.zoom).toBe(15)
      expect(viewport.longitude).toBe(-95.0)
      expect(viewport.latitude).toBe(0) // Preserved
      expect(viewport.pitch).toBe(0) // Preserved
      expect(viewport.bearing).toBe(0) // Preserved
    })

    it('getViewport should return current viewport state', () => {
      const panelId = asPanelId('test-get-viewport')
      const atoms = getPanelAtoms(panelId)

      const expected: ViewportState = {
        longitude: -122.42,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
      }

      geointRegistry.set(atoms.viewportAtom, expected)

      const ops = createMapOperations(panelId)
      const actual = ops.getViewport()

      expect(actual).toEqual(expected)
    })
  })
})
