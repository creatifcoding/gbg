import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HoundstoothGOL } from './components/houndstooth-gol';
import { Link } from '@tanstack/react-router';
import { VantaCard, VANTA_COLORS, VANTA_TYPOGRAPHY } from './components/portal';
import './App.css';

/**
 * Background - HoundstoothGOL with full viewport
 * Plain CSS z-index, no layer system needed
 */
function Background() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -10,
        pointerEvents: 'auto',
      }}
    >
      <HoundstoothGOL />
    </div>
  );
}

/**
 * Content - Portal UI
 * Plain CSS z-index, no layer system needed
 */
function Content({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden scrollbar-hide p-8"
      style={{ position: 'relative', zIndex: 10, pointerEvents: 'none' }}
    >
      <div style={{ pointerEvents: 'auto' }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card Data
// ─────────────────────────────────────────────────────────────────────────────

type IndicatorStatus = 'active' | 'idle' | 'pending' | 'error';
type GlowColor = 'cyan' | 'rose' | 'amber' | 'emerald';

interface CardDef {
  readonly title: string;
  readonly body: string;
  readonly route: string;
  readonly status?: IndicatorStatus;
  readonly label?: string;
  readonly glow?: GlowColor;
}

const CARDS: readonly CardDef[] = [
  // Feature
  {
    title: 'DATA MANAGER',
    body: 'Effect.Service pattern with kernel architecture. FlexSearch and Linear drivers for progressive streaming search.',
    route: '/testbed/data-manager',
    status: 'active',
    glow: 'rose',
  },
  {
    title: 'AG-GRID',
    body: 'First-class data grid as canvas object. Custom TMNL theme with parameterized tokens and cell renderers.',
    route: '/testbed/data-grid',
    status: 'active',
    glow: 'amber',
  },
  {
    title: 'GRID VARIANTS',
    body: 'Schema-backed grid abstraction layer. 4 density tiers, streaming data, variant-aware renderers.',
    route: '/testbed/data-grid-variants',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'CHARTING',
    body: 'Chart.make() factory with ECharts. Line, bar, scatter with real-time streaming via RingBuffer.',
    route: '/testbed/charting',
    status: 'active',
    label: 'v1',
    glow: 'cyan',
  },
  // Infrastructure
  {
    title: 'EFFECT-ATOM',
    body: 'Reactive state via Atom.runtime(). Service-scoped atoms replace useState for async flows.',
    route: '/testbed/effect-atom',
    status: 'active',
  },
  {
    title: 'FERMION',
    body: 'Schema-driven Atom.family library. Effect algebra, lifecycle control, CRUD operations with Result state machine.',
    route: '/testbed/fermion',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'AXIOM',
    body: 'Effect-native ontology framework. Schema.TaggedClass → ObjectType → Ontology service → OSDK/OaC compilation.',
    route: '/testbed/axiom',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'PIPELINE ADR',
    body: 'Sensor-to-React architecture review. 26 ADRs across 5 tiers: isolated stages, adjacent pairs, synergies, triplets.',
    route: '/testbed/pipeline-adr',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'WINDOWS',
    body: 'Emacs-style pane management. C-x 2/3 split, C-x o navigate, C-x 0/1 close. Multiple routes per viewport.',
    route: '/testbed/windows',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'ANIMATION',
    body: 'animatable() primitives with GSAP and anime.js drivers. Effect-TS integration for sequencing.',
    route: '/testbed/v2',
    status: 'active',
  },
  {
    title: 'OVERLAYS',
    body: 'Emacs minor-mode inspired capability modules. LIFO event dispatch, typed ports, container-scoped.',
    route: '/testbed/overlays',
    status: 'active',
  },
  {
    title: 'SCADA CANVAS',
    body: 'Unified multi-overlay P&ID demo. Process plant with TagBinding, Alarm, Faceplate, and Navigation in one container.',
    route: '/scada',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'SCADA/HMI',
    body: 'Industrial overlay patterns: TagBinding, Alarm, DataGrid, Chart, Navigation, Faceplate. Effect Schema types.',
    route: '/testbed/scada',
    status: 'idle',
  },
  {
    title: 'INDICES',
    body: 'Multi-source search composition inspired by Emacs Consult. Effect.Stream narrowing with key+space filtering.',
    route: '/testbed/indices',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'STREAMS',
    body: 'Stream-Atom primitives playground. Progressive subscriptions, EventLog observability, D3 visualizations.',
    route: '/playground/streams',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'AVA CLIENT',
    body: 'Asset View Agent testbed. HTTP + WebSocket clients with Effect Platform. TmnlDataGrid for view display.',
    route: '/testbed/ava',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'AVA V2',
    body: 'AVA v2 with effect-atom. NATS WebSocket streaming, view subscriptions, artifact/delta monitoring, FiberMap lifecycle.',
    route: '/testbed/ava-v2',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'KORI ECS',
    body: 'Entity-Component-System testbed. REPL, AG-Grid inspector, R3F 3D canvas, scenario runner for stress tests.',
    route: '/testbed/kori',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'KORI ATOMS',
    body: 'EntitySpec → EntityAtomFactory pipeline. Spawn entities from specs, reactive trait atoms, stats tracking.',
    route: '/testbed/kori-atoms',
    status: 'active',
    label: 'NEW',
    glow: 'rose',
  },
  {
    title: 'FLOATING PANELS',
    body: '@dnd-kit draggable panels with position persistence. Modal detach, z-index stacking, viewport bounds.',
    route: '/testbed/floating',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'SELECTION',
    body: 'Marquee drag selection with grouping. Shift+G to group, modifier keys for multi-select, TMNL ring affordance.',
    route: '/testbed/selection',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'DATAPLANE',
    body: 'd2ts differential dataflow linking. EmbeddedBlockWrapper ports, pipe/sync/aggregate relationships, React Flow viz.',
    route: '/testbed/dataplane',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'DRAWER SYSTEM',
    body: 'Stacking drawer UI with rolodex animation. Global + per-panel slots, TableService presets, parallax lift.',
    route: '/testbed/drawer',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'SCREENSAVER',
    body: 'ASCII art screensaver with idle detection. GLSL shaders, CRT effects, DebugScope instrumentation.',
    route: '/testbed/screensaver',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'TERMINAL',
    body: 'Ghostty-web terminal emulator. Full VT100/xterm compat, WASM-powered parser, agentic harness ready.',
    route: '/testbed/terminal',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'BLOCK TERMINAL',
    body: 'OpenWarp-style block terminal. AI streaming blocks, command history, MCP tool integration.',
    route: '/testbed/block-terminal',
    status: 'active',
    label: 'v2',
    glow: 'amber',
  },
  {
    title: 'BLOCK TERMINAL V3',
    body: 'Reference-based blocks. Content derived from ai-core, XState machine, STX bridge. NO dual-write.',
    route: '/testbed/block-terminal-v3',
    status: 'active',
    label: 'v3',
    glow: 'cyan',
  },
  {
    title: 'THEIA IDE',
    body: 'Eclipse Theia browser-only IDE. Monaco editor, file navigator, Vim mode, workspace-aware embedding.',
    route: '/testbed/theia',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'SEARCH LAB',
    body: 'Search driver experimentation. FlexSearch vs Linear comparison, indexing strategies, fuzzy matching.',
    route: '/testbed/search',
    status: 'active',
  },
  // Controls
  {
    title: 'SLIDER V2',
    body: 'CEW-grade slider with trait-based composition. 15% overshoot, 65ms tactical settle.',
    route: '/testbed/slider-v2',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'SLIDER V1',
    body: 'DAW-grade slider with Effect.Service behaviors. Runtime-swappable linear, log, decibel curves.',
    route: '/testbed/slider',
    status: 'idle',
  },
  {
    title: 'HOTKEYS',
    body: 'Keyboard shortcut system with configurable bindings. Scoped contexts and command palette integration.',
    route: '/testbed/hotkeys',
    status: 'active',
  },
  // Abstractions
  {
    title: 'TRAITS',
    body: 'Rust-inspired trait system for React. Slots-based injection with provider-scoped boundaries.',
    route: '/testbed/traits',
    status: 'active',
  },
  {
    title: 'BASE MODAL',
    body: 'Accessible modal primitives with focus trap, escape handling, and backdrop click support.',
    route: '/testbed/base-modal',
    status: 'active',
  },
  {
    title: 'KEYBINDINGS',
    body: 'User-configurable keyboard mappings. Chord support, conflict detection, import/export.',
    route: '/testbed/keybindings',
    status: 'active',
  },
  // Block Editor
  {
    title: 'BLOCK EDITOR',
    body: 'TMNL-native block editor with Effect.Service architecture. Schema-backed blocks, undo/redo, mode switching.',
    route: '/testbed/editor',
    status: 'active',
  },
  {
    title: 'EDITOR V3',
    body: 'Tiptap + Effect integration. EffectBridge syncs ProseMirror to atoms. editorOps for mutations.',
    route: '/testbed/editor-v3',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'COLLAB V2',
    body: 'Autonomous editor panels with y-sweet sync. Discord-style presence, container-native drawers, contextual toolbar.',
    route: '/testbed/collaboration-v2',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  // Documentation
  {
    title: 'TMNL OVERHAUL',
    body: 'TMNL-native architecture patterns inspired by AFFiNE research. Block editing, state, storage, UI.',
    route: '/docs/overhaul',
    status: 'active',
    label: 'DOCS',
    glow: 'emerald',
  },
  // Diagnostics
  {
    title: 'TAURI FILESYSTEM',
    body: 'Raw Tauri IPC diagnostic. Tests fs_list_directory invoke with Windows vs WSL paths.',
    route: '/testbed/tauri-fs',
    status: 'pending',
    label: 'DIAG',
    glow: 'amber',
  },
  {
    title: 'GEOINT',
    body: 'Geospatial intelligence layering system. deck.gl tracks + R3F overlay, threat volumes, classification colors.',
    route: '/testbed/geoint',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'ECS VERTICAL SLICE',
    body: 'Real infrastructure: FlightRepository → Postgres, IngestionOrchestrator, DurableStreams, ElectricSQL sync.',
    route: '/testbed/ecs-vertical-slice',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'SEARCH → KORI',
    body: 'SearchClient RPC → SearchResultItem → TraitBundle → Entity Atoms. Effect.Match + Atom.family patterns.',
    route: '/testbed/search-to-kori',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'TIMELINE + SEARCH',
    body: 'XState v5 machine → Atom filtering → Reactive results. Window-based temporal filtering with playback controls.',
    route: '/testbed/timeline-search',
    status: 'active',
    label: 'NEW',
    glow: 'rose',
  },
  {
    title: 'ATOMRPC PATTERN',
    body: 'AtomRpc.Tag caching + reactivity keys. Query atoms with TTL, mutation → cache invalidation flow.',
    route: '/testbed/atom-rpc',
    status: 'active',
    label: 'NEW',
    glow: 'amber',
  },
  {
    title: 'MATERIALIZER FLOW',
    body: 'Ingestion → Postgres → DurableStream → Materializer → Electric → React. Transactional Outbox Pattern.',
    route: '/testbed/materializer-flow',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
  {
    title: 'INGESTION ORCHESTRATOR',
    body: 'Effect.Service lifecycle management. Fiber-based ingesters, Layer composition, Ref + HashMap state tracking.',
    route: '/testbed/ingestion-orchestrator',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'ENTITY UI ATOMS',
    body: 'Atom.family for per-entity state. HashSet selection, Option hover, entityOps mutations, registry.get()/set().',
    route: '/testbed/entity-ui-atoms',
    status: 'active',
    label: 'NEW',
    glow: 'rose',
  },
  {
    title: 'INTEGRATED GEOINT',
    body: 'Complete vertical slice: AtomRpc search → Handlers → Atoms → UI | Electric Shape sync | Kori entity management | Timeline filtering.',
    route: '/testbed/integrated-geoint',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
  },
  {
    title: 'ELECTRIC SYNC',
    body: 'ElectricSQL shape subscriptions. useEntities(), trait hooks, useFlightEntitiesWithTraits() joins, JSONB parsing.',
    route: '/testbed/electric-sync',
    status: 'active',
    label: 'NEW',
    glow: 'emerald',
  },
];

/**
 * Render a card from definition
 */
function Card({ def, index }: { def: CardDef; index: number }) {
  const baseDelay = 0.2;
  const stagger = 0.05;
  const delay = baseDelay + index * stagger;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <VantaCard
        variant="compact"
        glow={def.glow ? true : undefined}
        glowColor={def.glow}
        style={{
          background: 'rgba(3, 3, 3, 0.8)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${VANTA_COLORS.surface.border}`,
        }}
      >
        <VantaCard.Header>
          <VantaCard.Title>{def.title}</VantaCard.Title>
          <VantaCard.Indicator
            status={def.status ?? 'active'}
            label={def.label}
          />
        </VantaCard.Header>

        <VantaCard.Body>{def.body}</VantaCard.Body>

        <VantaCard.Actions>
          <Link to={def.route} style={{ textDecoration: 'none' }}>
            <VantaCard.Action variant={def.glow ? 'primary' : undefined}>
              EXPLORE
            </VantaCard.Action>
          </Link>
        </VantaCard.Actions>
      </VantaCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal Content
// ─────────────────────────────────────────────────────────────────────────────

function PortalContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '720px',
        width: '100%',
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO CARD — TMNL Identity
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <VantaCard
          variant="elevated"
          corners
          glow
          glowColor="cyan"
          style={{
            background: 'rgba(3, 3, 3, 0.88)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <VantaCard.Header>
            <VantaCard.Title>TMNL</VantaCard.Title>
            <VantaCard.Indicator status="active" label="OPERATIONAL" />
          </VantaCard.Header>

          <VantaCard.Subtitle>
            Terminal & Multi-Modal Navigation Layer
          </VantaCard.Subtitle>

          <VantaCard.Body>
            A modular development environment for building graph-oriented
            information systems. Integrates AG-Grid as a first-class data
            surface across tldraw, ReactFlow, Effect-TS, and state machines.
          </VantaCard.Body>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            <VantaCard.LabelValue
              label="TESTBEDS"
              value={String(CARDS.length)}
              accent="cyan"
            />
            <VantaCard.LabelValue label="SERVICES" value="8" accent="emerald" />
            <VantaCard.LabelValue label="ATOMS" value="23" accent="amber" />
            <VantaCard.LabelValue label="DRIVERS" value="3" accent="neutral" />
          </div>

          <VantaCard.Actions>
            <Link to="/tmnl" style={{ textDecoration: 'none' }}>
              <VantaCard.Action variant="primary">
                ENTER CANVAS
              </VantaCard.Action>
            </Link>
            <Link to="/testbed/vanta" style={{ textDecoration: 'none' }}>
              <VantaCard.Action>DESIGN SYSTEM</VantaCard.Action>
            </Link>
          </VantaCard.Actions>
        </VantaCard>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TESTBED CARDS — Data-driven grid
          ═══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}
      >
        {CARDS.map((def, i) => (
          <Card key={def.route} def={def} index={i} />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
        }}
      >
        <div
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.muted,
          }}
        >
          Click background to reset simulation
        </div>
        <div
          style={{
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.tertiary,
          }}
        >
          TMNL v0.1.0 • Effect-TS • AG-Grid v34
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <>
      {/* Background - HoundstoothGOL simulation */}
      <Background />

      {/* Content - Portal overlay */}
      <Content>
        <PortalContent />
      </Content>
    </>
  );
}

export default App;
