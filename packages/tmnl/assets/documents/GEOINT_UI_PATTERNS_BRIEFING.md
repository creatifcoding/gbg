# GEOINT UI Patterns Briefing

**Document Type**: Architecture Research Briefing
**Status**: Draft for Review
**Bead**: tmnl-dipxx
**Date**: 2026-01-10

---

## Executive Summary

Research into specialized domains reveals UI patterns applicable to GEOINT:

| Domain | Key Pattern | GEOINT Application |
|--------|-------------|-------------------|
| **Air Traffic Control** | What-if/what-else probes | Conflict detection, trajectory planning |
| **Bloomberg Terminal** | Real-time multi-window | Unified data streams, keyboard-first |
| **Military C2 (JADC2)** | ISR integration | Multi-INT fusion, sketch interfaces |

---

## 1. Air Traffic Control (ATC) Patterns

### 1.1 Spatio-Temporal Visualization

**Pattern**: Time-altitude graphs with constraint zones

ATC systems use 2D projections where:
- X-axis: Time or distance
- Y-axis: Altitude
- Constraint zones: Restricted airspace as shaded regions
- Trajectories: Curves showing planned paths

**GEOINT Application**:
- Timeline panel could show altitude/depth dimension
- Weather/restricted zones as temporal overlays
- Trajectory prediction for tracked entities

### 1.2 What-If / What-Else Probes

**Pattern**: Interactive conflict resolution

Controllers can:
1. **What-if**: "If I give this instruction, what happens?"
2. **What-else**: "What other options exist?"

System shows:
- Predicted trajectories
- Conflict points
- Safety margins

**GEOINT Application**:
- Entity correlation: "What if these tracks are the same vessel?"
- Coverage analysis: "What else could observe this area?"
- Timeline scrubbing with predictive projections

### 1.3 Constraint-Based Reasoning

**Pattern**: Visual constraint satisfaction

- Hard constraints: Red zones (no-go)
- Soft constraints: Yellow zones (prefer avoid)
- Valid solution space: Green regions

**GEOINT Application**:
- Search constraints as visual boundaries
- Confidence intervals on entity positions
- Temporal validity windows

---

## 2. Bloomberg Terminal Patterns

### 2.1 Real-Time Multi-Window Architecture

**Pattern**: 35M+ instruments, sub-second updates

Key techniques:
- **Window orchestration**: Each panel is independent but coordinated
- **Unified command line**: Single input for all actions
- **Keyboard-first**: Every action has keyboard shortcut
- **Streaming deltas**: Only changed values update

**GEOINT Application**:
- Floating panels as independent data views
- Command palette as unified entry point
- Keyboard shortcuts for all operations
- WebSocket delta compression for entity updates

### 2.2 Launchpad Pattern

**Pattern**: Quick-access function grid

- 4x4 or 6x6 grid of most-used functions
- Customizable per user/workflow
- Single-key access (F1-F12 + modifiers)

**GEOINT Application**:
- RadialCommandDial could adopt grid mode
- User-configurable quick actions
- Context-sensitive function sets

### 2.3 Monitor Chains

**Pattern**: Linked data views

- Master list drives detail panels
- Selection propagates across monitors
- Synchronized scrolling/filtering

**GEOINT Application**:
- SearchPanel selection → EntityPanel → Map highlight
- Timeline selection → Multi-panel sync
- Already partially implemented, needs formalization

---

## 3. Military C2 (JADC2) Patterns

### 3.1 Multi-INT Fusion

**Pattern**: Integrated ISR (Intelligence, Surveillance, Reconnaissance)

Data fusion from:
- SIGINT (signals intelligence)
- IMINT (imagery intelligence)
- HUMINT (human intelligence)
- OSINT (open source)

Visualization:
- Confidence weighting per source
- Conflict highlighting when sources disagree
- Temporal decay of intelligence value

**GEOINT Application**:
- Source confidence in search results
- Conflict indicators when track data diverges
- Time-since-last-update visualization

### 3.2 Sketch-Based Multimodal Interfaces

**Pattern**: Drawing directly on map for queries

Users can:
- Draw areas of interest (AOI)
- Sketch routes/tracks
- Annotate with temporal markers
- Voice + sketch combined input

**GEOINT Application**:
- MapSelectionOverlay extends to freeform shapes
- Route planning with temporal constraints
- Quick markup for briefings

### 3.3 Common Operating Picture (COP)

**Pattern**: Shared situational awareness

- All users see same base layer
- Role-based overlays
- Edit conflict resolution
- Real-time synchronization

**GEOINT Application**:
- Collaboration mode with shared view state
- Layer visibility per user role
- Y-sweet/CRDT for concurrent editing

---

## 4. Gap Analysis vs. Current GEOINT

| Pattern | Current State | Gap |
|---------|---------------|-----|
| What-if probes | Not implemented | Need trajectory prediction service |
| Time-altitude graphs | Timeline is 1D | Need altitude/depth dimension |
| Keyboard-first | Partial | CommandPalette exists, need comprehensive bindings |
| Real-time deltas | Polling-based | Need streaming architecture |
| Multi-INT fusion | Source filters only | Need confidence scoring, conflict detection |
| Sketch interfaces | Rectangle selection | Need freeform drawing |
| COP sync | Single-user | Need collaboration layer |

---

## 5. Implementation Priorities

### High Impact, Lower Effort
1. **Keyboard shortcuts expansion** - Build on existing CommandPalette
2. **Monitor chains formalization** - Selection sync already partially works
3. **Source confidence display** - UI change only

### High Impact, Higher Effort
4. **Streaming delta architecture** - WebSocket + atom updates
5. **What-if probe system** - Requires prediction service
6. **Sketch-based queries** - MapGL drawing integration

### Future Consideration
7. **Multi-user COP** - Y-sweet integration
8. **Time-altitude visualization** - 3D timeline

---

## 6. Recommended Next Steps

1. **Formalize keyboard bindings** - Map all actions to shortcuts (builds on `/commands-hotkeys-system`)
2. **Implement streaming atoms** - Delta updates through Atom.family
3. **Add source confidence** - Visual indicator per search result
4. **Sketch-based selection** - Extend MapSelectionOverlay

---

## References

- Exa research: ATC spatio-temporal visualization patterns
- Exa research: Bloomberg Terminal architecture
- Exa research: JADC2 and ISR integration concepts
- `.edin/` architectural decision records
