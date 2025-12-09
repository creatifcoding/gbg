import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { HoundstoothGOL } from './components/houndstooth-gol';
import { withLayering } from './lib/layers';
import { Link } from '@tanstack/react-router';
import {
  VantaCard,
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
} from './components/portal';
import './App.css';

/**
 * Background Layer - HoundstoothGOL with full viewport
 */
const BackgroundLayer = withLayering(() => <HoundstoothGOL />, {
  name: 'houndstooth-background',
  zIndex: -10,
  positionMode: 'fixed',
  pointerEvents: 'auto',
});

/**
 * Content Layer - Portal UI
 */
const ContentLayer = withLayering(
  ({ children }: { children: ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center overflow-hidden scrollbar-hide p-8">
      {children}
    </div>
  ),
  {
    name: 'main-content',
    zIndex: 10,
    positionMode: 'relative',
    pointerEvents: 'pass-through',
    captureClicks: true,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Card Data
// ─────────────────────────────────────────────────────────────────────────────

type IndicatorStatus = 'active' | 'idle' | 'warning' | 'error';
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
    title: 'LAYERS V2',
    body: 'Atom-as-State layer management. Hook-based style injection with View Transitions for version switching.',
    route: '/testbed/layers',
    status: 'active',
    label: 'NEW',
    glow: 'cyan',
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
          <VantaCard.Indicator status={def.status ?? 'active'} label={def.label} />
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
            information systems. Integrates AG-Grid as a first-class data surface
            across tldraw, ReactFlow, Effect-TS, and state machines.
          </VantaCard.Body>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '16px' }}>
            <VantaCard.LabelValue label="TESTBEDS" value={String(CARDS.length)} accent="cyan" />
            <VantaCard.LabelValue label="SERVICES" value="8" accent="emerald" />
            <VantaCard.LabelValue label="ATOMS" value="23" accent="amber" />
            <VantaCard.LabelValue label="DRIVERS" value="3" accent="neutral" />
          </div>

          <VantaCard.Actions>
            <Link to="/tmnl" style={{ textDecoration: 'none' }}>
              <VantaCard.Action variant="primary">ENTER CANVAS</VantaCard.Action>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
      <BackgroundLayer />

      {/* Content - Portal overlay */}
      <ContentLayer>
        <PortalContent />
      </ContentLayer>
    </>
  );
}

export default App;
