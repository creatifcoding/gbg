/**
 * TMNL Testbed Registry
 *
 * Centralized registry of all testbeds with version tracking.
 * Powers the CommandBar search and card grid views.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TestbedStatus = 'active' | 'experimental' | 'deprecated' | 'stable';
export type TestbedCategory =
  | 'data' // DataManager, Search, AG-Grid
  | 'animation' // Animation library, GSAP, anime.js
  | 'ui' // Slider, Modal, Drawer
  | 'state' // Effect-Atom, Layers, Traits
  | 'input' // Hotkeys, Keybindings, Commands
  | 'charting' // ECharts, visualizations
  | 'canvas' // tldraw, ReactFlow
  | 'infra'; // Infrastructure, pipelines, sync

export interface TestbedVersion {
  readonly version: string; // "v1", "v2", etc.
  readonly route: string; // "/testbed/slider-v2"
  readonly status: TestbedStatus;
  readonly label?: string; // "NEW", "LEGACY", etc.
}

/**
 * Window configuration for testbeds that support multi-window
 */
export interface TestbedWindowConfig {
  readonly minWidth?: number; // Minimum width in pixels
  readonly minHeight?: number; // Minimum height in pixels
  readonly width?: number; // Initial width
  readonly height?: number; // Initial height
}

export interface TestbedEntry {
  readonly id: string; // "slider", "data-manager"
  readonly name: string; // "Slider", "DataManager"
  readonly description: string;
  readonly category: TestbedCategory;
  readonly keywords: readonly string[]; // For fuzzy search
  readonly versions: readonly TestbedVersion[];
  readonly accent?: string; // Glow color: "cyan", "rose", "amber"
  readonly windowCapable?: boolean; // Can be opened in separate window (default: true)
  readonly windowConfig?: TestbedWindowConfig; // Window size/constraints
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TESTBED_REGISTRY: readonly TestbedEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'data-manager',
    name: 'DataManager',
    description:
      'Effect.Service pattern with kernel architecture. FlexSearch and Linear drivers.',
    category: 'data',
    keywords: [
      'search',
      'flexsearch',
      'linear',
      'kernel',
      'effect',
      'stream',
      'hybrid',
    ],
    accent: 'rose',
    versions: [
      {
        version: 'v1',
        route: '/testbed/data-manager/v1',
        status: 'stable',
        label: 'SINGULAR',
      },
      {
        version: 'v2',
        route: '/testbed/data-manager/v2',
        status: 'experimental',
        label: 'DAQ',
      },
      {
        version: 'legacy',
        route: '/testbed/data-manager',
        status: 'deprecated',
      },
    ],
  },
  {
    id: 'search',
    name: 'Search Lab',
    description:
      'Search experimentation with different drivers and indexing strategies.',
    category: 'data',
    keywords: ['search', 'flexsearch', 'linear', 'fuzzy', 'index'],
    accent: 'rose',
    versions: [{ version: 'v1', route: '/testbed/search', status: 'stable' }],
  },
  {
    id: 'data-grid',
    name: 'AG-Grid Surface',
    description:
      'AG-Grid v34 with custom TMNL theme. Cell renderers and canvas integration.',
    category: 'data',
    keywords: ['ag-grid', 'grid', 'table', 'cell', 'renderer', 'theme'],
    accent: 'amber',
    versions: [
      { version: 'v1', route: '/testbed/data-grid', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'animation',
    name: 'Animation',
    description: 'animatable() primitives with GSAP and anime.js drivers.',
    category: 'animation',
    keywords: ['animation', 'gsap', 'animejs', 'motion', 'tween', 'timeline'],
    accent: 'cyan',
    versions: [
      { version: 'v1', route: '/testbed', status: 'stable' },
      {
        version: 'v2',
        route: '/testbed/v2',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'slider',
    name: 'Slider',
    description:
      'DAW-grade slider with runtime-swappable behaviors and precision control.',
    category: 'ui',
    keywords: [
      'slider',
      'daw',
      'range',
      'behavior',
      'linear',
      'logarithmic',
      'decibel',
    ],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/slider',
        status: 'stable',
        label: 'DAW',
      },
      {
        version: 'v2',
        route: '/testbed/slider-v2',
        status: 'experimental',
        label: 'CEW',
      },
    ],
  },
  {
    id: 'base-modal',
    name: 'Base Modal',
    description:
      'Accessible modal primitives with focus trap and backdrop support.',
    category: 'ui',
    keywords: ['modal', 'dialog', 'focus', 'trap', 'accessible', 'a11y'],
    versions: [
      { version: 'v1', route: '/testbed/base-modal', status: 'stable' },
    ],
  },
  {
    id: 'vanta',
    name: 'Vanta Design System',
    description: 'VantaCard components with glow effects and corner accents.',
    category: 'ui',
    keywords: ['vanta', 'card', 'design', 'system', 'glow', 'theme'],
    accent: 'emerald',
    versions: [{ version: 'v1', route: '/testbed/vanta', status: 'stable' }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'effect-atom',
    name: 'Effect-Atom',
    description:
      'Reactive state via Atom.runtime(). Service-scoped atoms for async flows.',
    category: 'state',
    keywords: ['effect', 'atom', 'state', 'reactive', 'runtime', 'service'],
    versions: [
      { version: 'v1', route: '/testbed/effect-atom', status: 'stable' },
    ],
  },
  {
    id: 'traits',
    name: 'Traits',
    description: 'Rust-inspired trait system for React. Slots-based injection.',
    category: 'state',
    keywords: [
      'trait',
      'rust',
      'slots',
      'injection',
      'provider',
      'composition',
    ],
    versions: [{ version: 'v1', route: '/testbed/traits', status: 'stable' }],
  },
  {
    id: 'capabilities',
    name: 'Capabilities',
    description: 'Layer system capabilities and z-index management.',
    category: 'state',
    keywords: ['layer', 'capability', 'zindex', 'adobe', 'photoshop'],
    versions: [
      { version: 'v1', route: '/testbed/capabilities', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hotkeys',
    name: 'Hotkeys',
    description:
      'Keyboard shortcut system with scoped contexts and command palette.',
    category: 'input',
    keywords: ['hotkey', 'keyboard', 'shortcut', 'command', 'palette'],
    versions: [{ version: 'v1', route: '/testbed/hotkeys', status: 'stable' }],
  },
  {
    id: 'keybindings',
    name: 'Keybindings',
    description: 'User-configurable keyboard mappings with conflict detection.',
    category: 'input',
    keywords: ['keybinding', 'keyboard', 'mapping', 'conflict', 'customize'],
    versions: [
      { version: 'v1', route: '/testbed/keybindings', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARTING CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'charting',
    name: 'Charting',
    description:
      'Chart.make() factory with ECharts. Real-time streaming via RingBuffer.',
    category: 'charting',
    keywords: [
      'chart',
      'echarts',
      'line',
      'bar',
      'scatter',
      'stream',
      'ring',
      'buffer',
    ],
    accent: 'cyan',
    versions: [{ version: 'v1', route: '/testbed/charting', status: 'stable' }],
  },
  {
    id: 'indices',
    name: 'Indices Builder',
    description:
      'Multi-source search composition inspired by Emacs Consult. Effect.Stream narrowing.',
    category: 'data',
    keywords: [
      'indices',
      'search',
      'consult',
      'narrow',
      'source',
      'stream',
      'composition',
    ],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/indices',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },
  {
    id: 'ava',
    name: 'AVA Client',
    description:
      'Asset View Agent HTTP + WebSocket client testbed. Effect Platform integration with TmnlDataGrid.',
    category: 'data',
    keywords: [
      'ava',
      'asset',
      'view',
      'agent',
      'websocket',
      'http',
      'client',
      'effect',
      'stream',
    ],
    accent: 'emerald',
    versions: [
      {
        version: 'v1',
        route: '/testbed/ava',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },
  {
    id: 'morph-card',
    name: 'MorphCard',
    description:
      'Dynamic Island aesthetics with MorphCard and DynamicIslandCard. Server integration, durable streams.',
    category: 'ui',
    keywords: [
      'morph',
      'card',
      'dynamic',
      'island',
      'server',
      'streaming',
      'patches',
      'tabs',
    ],
    accent: 'emerald',
    versions: [
      {
        version: 'v1',
        route: '/testbed/morph-card',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },
  {
    id: 'egui-morph',
    name: 'egui MorphCard',
    description:
      'egui wasm canvas embedded inside DynamicIslandCard. React owns layout; egui owns pixels.',
    category: 'canvas',
    keywords: [
      'egui',
      'wasm',
      'canvas',
      'dynamic',
      'island',
      'morph-card',
      'eframe',
    ],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/egui-morph',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVANCED / INFRASTRUCTURE CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'fermion',
    name: 'Fermion',
    description:
      'Schema-driven Atom.family patterns. Registry, algebra interpreters, React integration.',
    category: 'state',
    keywords: ['fermion', 'atom', 'family', 'schema', 'registry', 'effect'],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/fermion',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description:
      'Embedded terminal with PTY integration. Block-based command output.',
    category: 'ui',
    keywords: ['terminal', 'pty', 'xterm', 'shell', 'command', 'block'],
    accent: 'amber',
    versions: [{ version: 'v1', route: '/testbed/terminal', status: 'stable' }],
  },
  {
    id: 'geoint',
    name: 'GEOINT Dashboard',
    description:
      'Geospatial intelligence dashboard with command center. Map integration and entity management.',
    category: 'data',
    keywords: [
      'geoint',
      'geospatial',
      'map',
      'entity',
      'dashboard',
      'intelligence',
    ],
    accent: 'emerald',
    versions: [
      {
        version: 'v1',
        route: '/testbed/geoint',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },
  {
    id: 'collaboration',
    name: 'Collaboration',
    description:
      'Real-time collaboration with y-sweet sync. Autonomous editor panels.',
    category: 'data',
    keywords: ['collaboration', 'yjs', 'crdt', 'sync', 'realtime', 'editor'],
    accent: 'rose',
    versions: [
      {
        version: 'v1',
        route: '/testbed/collaboration',
        status: 'experimental',
      },
      {
        version: 'v2',
        route: '/testbed/collaboration-v2',
        status: 'experimental',
        label: 'PANELS',
      },
    ],
  },
  {
    id: 'json-render',
    name: 'JSON Render',
    description:
      'Generative UI rendering from JSON schemas. Streaming component generation.',
    category: 'ui',
    keywords: [
      'json',
      'render',
      'generative',
      'ui',
      'schema',
      'streaming',
      'catalog',
    ],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/json-render',
        status: 'experimental',
        label: 'NEW',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE / INTEGRATION CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'axiom',
    name: 'Axiom',
    description: 'Effect.Service axiom patterns and runtime testing.',
    category: 'state',
    keywords: ['axiom', 'effect', 'service', 'runtime', 'test'],
    versions: [
      { version: 'v1', route: '/testbed/axiom', status: 'experimental' },
    ],
  },
  {
    id: 'block-terminal',
    name: 'Block Terminal',
    description: 'OpenWarp-style block-based terminal with command blocks.',
    category: 'ui',
    keywords: ['terminal', 'block', 'openwarp', 'command', 'shell'],
    accent: 'amber',
    versions: [
      {
        version: 'v1',
        route: '/testbed/block-terminal',
        status: 'experimental',
      },
      {
        version: 'v3',
        route: '/testbed/block-terminal-v3',
        status: 'experimental',
        label: 'REF',
      },
    ],
  },
  {
    id: 'data-grid-variants',
    name: 'AG-Grid Variants',
    description: 'AG-Grid variant testing with different configurations.',
    category: 'data',
    keywords: ['ag-grid', 'variants', 'grid', 'table', 'config'],
    accent: 'amber',
    versions: [
      {
        version: 'v1',
        route: '/testbed/data-grid-variants',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'dataplane',
    name: 'Dataplane',
    description: 'Dataplane registry and data flow management.',
    category: 'infra',
    keywords: ['dataplane', 'registry', 'flow', 'data', 'pipeline'],
    versions: [
      { version: 'v1', route: '/testbed/dataplane', status: 'experimental' },
    ],
  },
  {
    id: 'drawer',
    name: 'Drawer',
    description: 'Drawer component with stack management and animations.',
    category: 'ui',
    keywords: ['drawer', 'panel', 'slide', 'stack', 'overlay'],
    versions: [{ version: 'v1', route: '/testbed/drawer', status: 'stable' }],
  },
  {
    id: 'durable-streams',
    name: 'Durable Streams',
    description: 'Native durable stream client for event streaming.',
    category: 'infra',
    keywords: ['durable', 'streams', 'event', 'native', 'client'],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/durable-streams',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'holonet-durable-streams',
    name: 'Holonet Durable Streams',
    description: 'HTTP API client for Holonet durable streams.',
    category: 'infra',
    keywords: ['holonet', 'durable', 'streams', 'http', 'api'],
    accent: 'cyan',
    versions: [
      {
        version: 'v1',
        route: '/testbed/holonet-durable-streams',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'ecs-vertical-slice',
    name: 'ECS Vertical Slice',
    description:
      'Full ECS vertical slice with DB, ingestion, and Electric sync.',
    category: 'infra',
    keywords: ['ecs', 'vertical', 'slice', 'electric', 'ingestion', 'db'],
    accent: 'emerald',
    versions: [
      {
        version: 'v1',
        route: '/testbed/ecs-vertical-slice',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'electric-sync',
    name: 'Electric Sync',
    description: 'ElectricSQL shape sync patterns and testing.',
    category: 'infra',
    keywords: ['electric', 'sql', 'sync', 'shape', 'realtime'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/electric-sync',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'entity-ui-atoms',
    name: 'Entity UI Atoms',
    description: 'Atom.family + HashSet selection patterns for entity UI.',
    category: 'state',
    keywords: ['entity', 'ui', 'atoms', 'family', 'hashset', 'selection'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/entity-ui-atoms',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'floating',
    name: 'Floating Panels',
    description: 'Floating panel system with drag, resize, and layering.',
    category: 'ui',
    keywords: ['floating', 'panel', 'drag', 'resize', 'layer', 'window'],
    versions: [{ version: 'v1', route: '/testbed/floating', status: 'stable' }],
  },
  {
    id: 'ingestion',
    name: 'Ingestion',
    description: 'AtomRpc + Cluster RPC vertical slice for data ingestion.',
    category: 'infra',
    keywords: ['ingestion', 'atomrpc', 'cluster', 'rpc', 'data'],
    versions: [
      { version: 'v1', route: '/testbed/ingestion', status: 'experimental' },
    ],
  },
  {
    id: 'ingestion-orchestrator',
    name: 'Ingestion Orchestrator',
    description: 'Effect.Service lifecycle management for ingestion pipelines.',
    category: 'infra',
    keywords: ['ingestion', 'orchestrator', 'lifecycle', 'pipeline', 'effect'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/ingestion-orchestrator',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'integrated-geoint',
    name: 'Integrated GEOINT',
    description: 'Full GEOINT vertical slice: AtomRpc + Electric + Kori.',
    category: 'data',
    keywords: ['geoint', 'integrated', 'atomrpc', 'electric', 'kori'],
    accent: 'emerald',
    versions: [
      {
        version: 'v1',
        route: '/testbed/integrated-geoint',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'kori',
    name: 'KORI ECS',
    description: 'Entity Component System with KORI patterns.',
    category: 'state',
    keywords: ['kori', 'ecs', 'entity', 'component', 'system'],
    versions: [
      { version: 'v1', route: '/testbed/kori', status: 'experimental' },
    ],
  },
  {
    id: 'kori-atoms',
    name: 'KORI Atoms',
    description: 'Spec→factory→atoms pipeline for KORI entities.',
    category: 'state',
    keywords: ['kori', 'atoms', 'factory', 'spec', 'entity'],
    versions: [
      { version: 'v1', route: '/testbed/kori-atoms', status: 'experimental' },
    ],
  },
  {
    id: 'materializer-flow',
    name: 'Materializer Flow',
    description: 'Ingestion → Stream → Materializer → Electric pipeline.',
    category: 'infra',
    keywords: ['materializer', 'flow', 'ingestion', 'stream', 'electric'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/materializer-flow',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'overlays',
    name: 'Overlays',
    description: 'Overlay system with registry and portal management.',
    category: 'ui',
    keywords: ['overlay', 'portal', 'registry', 'modal', 'popup'],
    versions: [{ version: 'v1', route: '/testbed/overlays', status: 'stable' }],
  },
  {
    id: 'pipeline-adr',
    name: 'Pipeline ADR',
    description: 'Architecture Decision Record pipeline visualization.',
    category: 'infra',
    keywords: ['pipeline', 'adr', 'architecture', 'decision', 'record'],
    versions: [
      { version: 'v1', route: '/testbed/pipeline-adr', status: 'experimental' },
    ],
  },
  {
    id: 'schema-transform',
    name: 'Schema Transform',
    description: 'Wire → Domain schema transformation patterns.',
    category: 'infra',
    keywords: ['schema', 'transform', 'wire', 'domain', 'mapping'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/schema-transform',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'screensaver',
    name: 'Screensaver',
    description: 'Lock screen and screensaver animations.',
    category: 'ui',
    keywords: ['screensaver', 'lock', 'screen', 'animation', 'idle'],
    versions: [
      { version: 'v1', route: '/testbed/screensaver', status: 'experimental' },
    ],
  },
  {
    id: 'search-service',
    name: 'Search Service',
    description: 'Effect.Service + Atom + Schema patterns for search.',
    category: 'data',
    keywords: ['search', 'service', 'effect', 'atom', 'schema'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/search-service',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'search-to-kori',
    name: 'Search to KORI',
    description: 'SearchResult → TraitBundle → Entity Atoms pipeline.',
    category: 'data',
    keywords: ['search', 'kori', 'trait', 'bundle', 'entity'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/search-to-kori',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'selection',
    name: 'Selection',
    description: 'Selection patterns and multi-select management.',
    category: 'ui',
    keywords: ['selection', 'multi', 'select', 'range', 'list'],
    versions: [
      { version: 'v1', route: '/testbed/selection', status: 'stable' },
    ],
  },
  {
    id: 'streaming-search',
    name: 'Streaming Search',
    description: 'Event flow + Match.type error handling for search.',
    category: 'data',
    keywords: ['streaming', 'search', 'event', 'flow', 'match'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/streaming-search',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'tauri-fs',
    name: 'Tauri Filesystem',
    description: 'Tauri filesystem diagnostic and testing.',
    category: 'infra',
    keywords: ['tauri', 'filesystem', 'fs', 'diagnostic', 'file'],
    versions: [
      { version: 'v1', route: '/testbed/tauri-fs', status: 'experimental' },
    ],
  },
  {
    id: 'theia',
    name: 'Theia IDE',
    description: 'Theia IDE integration testbed.',
    category: 'infra',
    keywords: ['theia', 'ide', 'editor', 'integration'],
    versions: [
      { version: 'v1', route: '/testbed/theia', status: 'experimental' },
    ],
  },
  {
    id: 'timeline-search',
    name: 'Timeline Search',
    description: 'XState machine → Atom filtering → Reactive results.',
    category: 'data',
    keywords: ['timeline', 'search', 'xstate', 'atom', 'filtering'],
    versions: [
      {
        version: 'v1',
        route: '/testbed/timeline-search',
        status: 'experimental',
      },
    ],
  },
  {
    id: 'variables',
    name: 'Variables',
    description: 'Variable system with scoped contexts and bindings.',
    category: 'state',
    keywords: ['variables', 'scope', 'binding', 'context', 'state'],
    versions: [
      { version: 'v1', route: '/testbed/variables', status: 'stable' },
    ],
  },
  {
    id: 'windows',
    name: 'Windows',
    description: 'Multi-window management and Tauri window APIs.',
    category: 'infra',
    keywords: ['windows', 'tauri', 'multi', 'window', 'manager'],
    versions: [
      { version: 'v1', route: '/testbed/windows', status: 'experimental' },
    ],
  },
  {
    id: 'allint-cop',
    name: 'ALLINT COP',
    description: 'All-source intelligence common operating picture.',
    category: 'data',
    keywords: ['allint', 'cop', 'intelligence', 'common', 'operating'],
    accent: 'emerald',
    versions: [
      { version: 'v1', route: '/testbed/allint-cop', status: 'experimental' },
    ],
  },
  {
    id: 'atom-rpc',
    name: 'Atom RPC',
    description: 'AtomRpc.Tag caching + reactivity keys.',
    category: 'state',
    keywords: ['atom', 'rpc', 'caching', 'reactivity', 'tag'],
    versions: [
      { version: 'v1', route: '/testbed/atom-rpc', status: 'experimental' },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (Data Access Only — Search is handled by src/lib/search consumers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all testbeds as flat list of { entry, version }
 */
export function getAllTestbedVersions(): ReadonlyArray<{
  entry: TestbedEntry;
  version: TestbedVersion;
}> {
  return TESTBED_REGISTRY.flatMap((entry) =>
    entry.versions.map((version) => ({ entry, version }))
  );
}

/**
 * Get testbeds by category
 */
export function getTestbedsByCategory(
  category: TestbedCategory
): readonly TestbedEntry[] {
  return TESTBED_REGISTRY.filter((entry) => entry.category === category);
}

/**
 * Get the primary (latest stable or first) version for a testbed
 */
export function getPrimaryVersion(entry: TestbedEntry): TestbedVersion {
  return (
    entry.versions.find((v) => v.status === 'stable') ??
    entry.versions.find((v) => v.status === 'experimental') ??
    entry.versions[0]
  );
}

/**
 * Get testbed by ID
 */
export function getTestbedById(id: string): TestbedEntry | undefined {
  return TESTBED_REGISTRY.find((entry) => entry.id === id);
}

/**
 * Category display metadata
 */
export const CATEGORY_META: Record<
  TestbedCategory,
  { label: string; icon: string }
> = {
  data: { label: 'Data', icon: '◈' },
  animation: { label: 'Animation', icon: '◎' },
  ui: { label: 'UI', icon: '▣' },
  state: { label: 'State', icon: '◉' },
  input: { label: 'Input', icon: '⌨' },
  charting: { label: 'Charting', icon: '◐' },
  canvas: { label: 'Canvas', icon: '◧' },
  infra: { label: 'Infrastructure', icon: '⚙' },
};

/**
 * Generate the Tauri window label for a testbed
 */
export function getWindowLabel(testbedId: string): string {
  return `testbed-${testbedId}`;
}

/**
 * Check if a testbed supports being opened in a separate window
 */
export function isWindowCapable(entry: TestbedEntry): boolean {
  return entry.windowCapable !== false; // Default to true
}

// ─────────────────────────────────────────────────────────────────────────────
// Searchable Item Shape (for src/lib/search integration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flattened testbed item for indexing with src/lib/search
 *
 * Usage:
 * ```ts
 * import { createFlexSearchDriver } from '@/lib/search'
 * import { getSearchableTestbeds } from '@/lib/testbed'
 *
 * const driver = await Effect.runPromise(createFlexSearchDriver<TestbedSearchItem>())
 * await Effect.runPromise(driver.index(getSearchableTestbeds(), {
 *   fields: ['name', 'description', 'keywords', 'version', 'label'],
 * }))
 * ```
 */
export interface TestbedSearchItem {
  readonly id: string; // "slider:v2"
  readonly entryId: string; // "slider"
  readonly name: string; // "Slider"
  readonly description: string;
  readonly category: TestbedCategory;
  readonly keywords: string; // Space-separated for indexing
  readonly version: string; // "v2"
  readonly route: string; // "/testbed/slider-v2"
  readonly status: TestbedStatus;
  readonly label?: string; // "CEW", "NEW"
  readonly accent?: string; // "cyan"
}

/**
 * Convert registry to searchable items for src/lib/search
 */
export function getSearchableTestbeds(): readonly TestbedSearchItem[] {
  return TESTBED_REGISTRY.flatMap((entry) =>
    entry.versions.map(
      (version): TestbedSearchItem => ({
        id: `${entry.id}:${version.version}`,
        entryId: entry.id,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        keywords: entry.keywords.join(' '),
        version: version.version,
        route: version.route,
        status: version.status,
        label: version.label,
        accent: entry.accent,
      })
    )
  );
}
