# GEOINT Layering System - Project Overview

## Vision

Build a comprehensive GEOINT (Geospatial Intelligence) layering system on top of the existing BaseMap/MapBlockView architecture, enabling real-time geospatial intelligence visualization with multi-layer track and feature management.

## Goals

1. **Real-time Track Visualization** - Display moving objects (aircraft, vehicles, vessels) with animated trails and confidence-based styling
2. **Multi-layer Feature Management** - Support vector features, satellite imagery, and heatmaps with toggle controls
3. **3D Visualization** - React-Three-Fiber overlay for 3D track markers and threat volumes
4. **Offline-First Operation** - Persist track history via durable streams with replay capability
5. **AVA Integration** - Extend existing NATS-based transport with AtomRpc.Tag patterns

## Problem Statement

The current BaseMap and MapBlockView provide solid foundations but lack:
- Track animation and temporal visualization
- Multi-source layer management
- 3D overlay capabilities
- Structured RPC patterns with reactivity
- Offline persistence for geospatial data

## Success Metrics

- [ ] Tracks animate smoothly with TripsLayer at 60fps
- [ ] Layer toggles respond within 16ms
- [ ] 3D markers render correctly over deck.gl canvas
- [ ] Track replay works offline from durable streams
- [ ] AtomRpc patterns reduce boilerplate by 50%

## Scope

### In Scope
- GEOINT schema definitions with Effect Schema
- AtomRpc.Tag clients for geospatial operations
- GeointService with atom properties
- Deck.gl layer factories (tracks, features, tiles, heatmap)
- React-Three-Fiber 3D overlay
- Durable streams persistence
- Testbed at /testbed/geoint

### Out of Scope (Deferred)
- ElectricSQL/PGlite sync (Phase 2)
- Full offline map tiles
- Multi-user collaboration
- Historical track replay UI
