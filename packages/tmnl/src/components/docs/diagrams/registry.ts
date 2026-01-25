/**
 * Diagram Registry
 *
 * Central registry of Mermaid diagrams for living documentation.
 * Each diagram has an ID, title, description, and Mermaid source.
 *
 * @module docs/diagrams
 */

import { Schema } from "effect"

// =============================================================================
// Schema
// =============================================================================

export const DiagramId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{0,63}$/),
  Schema.brand("DiagramId")
)
export type DiagramId = typeof DiagramId.Type

export const DiagramCategory = Schema.Literal(
  "architecture",
  "flow",
  "sequence",
  "state",
  "class",
  "er",
  "integration"
)
export type DiagramCategory = typeof DiagramCategory.Type

export const DiagramEntry = Schema.Struct({
  id: DiagramId,
  title: Schema.NonEmptyString,
  description: Schema.String,
  category: DiagramCategory,
  source: Schema.String,
  /** Related beads or issues */
  relatedBeads: Schema.optional(Schema.Array(Schema.String)),
  /** Last updated timestamp */
  updatedAt: Schema.optional(Schema.String),
})
export type DiagramEntry = typeof DiagramEntry.Type

// =============================================================================
// Diagrams
// =============================================================================

/**
 * Apache Iggy Integration — Canonical Flow
 *
 * End-to-end sequence showing dashboard client ↔ Iggy ↔ AVA runtime flow.
 */
const IGGY_CANONICAL_FLOW: DiagramEntry = {
  id: "iggy-canonical-flow" as DiagramId,
  title: "Apache Iggy Integration — Canonical Flow",
  description: "End-to-end sequence diagram showing dashboard client registration, command flow, event flow, artifact distribution, and late-join/reconnect patterns through Apache Iggy.",
  category: "sequence",
  relatedBeads: ["tmnl-jixq", "tmnl-1mmb", "tmnl-15fd", "tmnl-mw93"],
  updatedAt: "2025-12-22",
  source: `sequenceDiagram
    autonumber
    participant DC as Dashboard Client
    participant API as AVA API
    participant Iggy as Apache Iggy
    participant Rec as ReconcilerV2
    participant EL as EventLog

    %% ═══════════════════════════════════════════════════════════════
    %% Phase 1: Client Registration
    %% ═══════════════════════════════════════════════════════════════
    rect rgb(30, 40, 50)
    Note over DC,Iggy: 1. Client Registration
    DC->>API: Connect (client_id: "dashboard-user-123")
    API->>Iggy: Create durable consumer<br/>consumer_name: "dashboard-user-123"
    Iggy-->>Iggy: Persist offset = 0
    Iggy-->>API: Consumer registered
    API-->>DC: Connection established
    end

    %% ═══════════════════════════════════════════════════════════════
    %% Phase 2: Command Flow (Client → AVA)
    %% ═══════════════════════════════════════════════════════════════
    rect rgb(40, 50, 60)
    Note over DC,Rec: 2. Command Flow
    DC->>API: POST /views/{view_id}/subscribe
    API->>Iggy: Publish ViewCommand::Subscribe<br/>topic: ava/views/{view_id}/commands
    Iggy->>Rec: CommandSource consumes
    Rec-->>Rec: Process Subscribe<br/>Register view in state
    end

    %% ═══════════════════════════════════════════════════════════════
    %% Phase 3: Event Flow (Internal)
    %% ═══════════════════════════════════════════════════════════════
    rect rgb(50, 60, 70)
    Note over Rec,EL: 3. Event Flow
    Rec->>Iggy: EventSink publishes<br/>ViewEvent::Created<br/>topic: ava/views/{view_id}/events
    Iggy->>EL: IggyEventLog adapter<br/>Append at offset N
    EL-->>EL: Durable log updated
    end

    %% ═══════════════════════════════════════════════════════════════
    %% Phase 4: Artifact Flow (AVA → Client)
    %% ═══════════════════════════════════════════════════════════════
    rect rgb(60, 70, 80)
    Note over Rec,DC: 4. Artifact Distribution
    Rec-->>Rec: Compute ViewArtifact<br/>from view state
    Rec->>Iggy: ArtifactSink publishes<br/>topic: ava/views/{view_id}/artifacts
    Iggy->>DC: ArtifactSource consumes<br/>(durable, from offset)
    DC-->>DC: Render artifact in UI
    end

    %% ═══════════════════════════════════════════════════════════════
    %% Phase 5: Late Join / Reconnect
    %% ═══════════════════════════════════════════════════════════════
    rect rgb(70, 80, 90)
    Note over DC,Iggy: 5. Late Join / Reconnect
    DC--xAPI: Disconnect (network failure)
    Note over DC: Time passes...
    DC->>API: Reconnect (same client_id)
    API->>Iggy: Resume consumer<br/>"dashboard-user-123"
    Iggy-->>Iggy: Load persisted offset
    Iggy->>DC: Stream missed artifacts<br/>from last offset
    DC-->>DC: UI catches up<br/>No data loss
    end

    %% ═══════════════════════════════════════════════════════════════
    %% Phase 6: Invalidation Flow
    %% ═══════════════════════════════════════════════════════════════
    rect rgb(80, 90, 100)
    Note over API,DC: 6. Invalidation Flow
    Note right of API: External trigger:<br/>Data source update
    API->>Iggy: Publish ViewCommand::Invalidate<br/>topic: ava/views/{view_id}/commands
    Iggy->>Rec: CommandSource consumes
    Rec-->>Rec: Recompute view
    Rec->>Iggy: ArtifactSink publishes<br/>updated artifact
    Iggy->>DC: Fresh artifact delivered
    end
`,
}

/**
 * AVA View Lifecycle
 *
 * State machine showing view states: Created → Active → Invalidated → Updated
 */
const AVA_VIEW_LIFECYCLE: DiagramEntry = {
  id: "ava-view-lifecycle" as DiagramId,
  title: "AVA View Lifecycle",
  description: "State machine diagram showing the lifecycle of an AVA view from creation through invalidation and updates.",
  category: "state",
  relatedBeads: ["tmnl-9g8q"],
  updatedAt: "2025-12-22",
  source: `stateDiagram-v2
    [*] --> Idle: Initial

    Idle --> Subscribing: Subscribe Command
    Subscribing --> Active: View Created
    Subscribing --> Error: Creation Failed

    Active --> Invalidating: Invalidate Command
    Active --> Active: Data Update
    Active --> Unsubscribing: Unsubscribe Command

    Invalidating --> Computing: Start Recompute
    Computing --> Active: Artifact Ready
    Computing --> Error: Compute Failed

    Unsubscribing --> Idle: Cleanup Complete

    Error --> Idle: Reset
    Error --> Active: Retry Success

    note right of Active
      View is actively serving
      artifacts to consumers
    end note

    note right of Invalidating
      Data source changed,
      view needs recompute
    end note
`,
}

/**
 * Iggy Topic Structure
 *
 * Entity relationship diagram showing Iggy streams, topics, and partitions.
 */
const IGGY_TOPIC_STRUCTURE: DiagramEntry = {
  id: "iggy-topic-structure" as DiagramId,
  title: "Iggy Topic Structure",
  description: "Entity relationship diagram showing the hierarchical structure of Iggy streams, topics, and partitions for AVA.",
  category: "er",
  relatedBeads: ["tmnl-5wlt"],
  updatedAt: "2025-12-22",
  source: `erDiagram
    STREAM ||--o{ TOPIC : contains
    TOPIC ||--o{ PARTITION : contains
    PARTITION ||--o{ MESSAGE : contains

    STREAM {
        string id PK "ava"
        string name "AVA Streams"
        timestamp created_at
    }

    TOPIC {
        string id PK
        string stream_id FK
        string name "commands|events|artifacts"
        int partitions "1"
    }

    PARTITION {
        int id PK
        string topic_id FK
        int message_count
        int current_offset
    }

    MESSAGE {
        int offset PK
        string partition_id FK
        bytes payload "Protobuf"
        timestamp created_at
        map headers
    }

    CONSUMER ||--o{ OFFSET : tracks
    CONSUMER {
        string id PK "client-uuid"
        string consumer_group
        string kind "Consumer|ConsumerGroup"
    }

    OFFSET {
        string consumer_id FK
        string partition_id FK
        int offset
        timestamp updated_at
    }
`,
}

// =============================================================================
// AFFiNE Integration Diagrams
// =============================================================================

/**
 * AFFiNE ↔ TMNL Layer Architecture
 */
const AFFINE_TMNL_LAYERS: DiagramEntry = {
  id: "affine-tmnl-layers" as DiagramId,
  title: "AFFiNE ↔ TMNL Layer Architecture",
  description: "Comparative architecture showing how AFFiNE layers map to TMNL equivalents.",
  category: "integration",
  updatedAt: "2025-12-22",
  source: `flowchart TB
    subgraph AFFiNE["AFFiNE Stack"]
        A1[React Application<br/>@affine/core, Jotai atoms]
        A2[BlockSuite Editor<br/>Lit Components, BlockSpec]
        A3[CRDT Data Layer<br/>Yjs / Y-OCTO, SyncController]
        A4[Storage Abstraction<br/>nbstore: IndexedDB / SQLite]
        A1 --> A2
        A2 --> A3
        A3 --> A4
    end

    subgraph TMNL["TMNL Stack"]
        T1[React Application<br/>effect-atom, Effect.Service]
        T2[BlockSuite Editor<br/>Custom TMNL Blocks]
        T3[Effect-native State<br/>Atom.runtime, Schema]
        T4[Storage<br/>Tauri SQLite / IndexedDB]
        T1 --> T2
        T2 --> T3
        T3 --> T4
    end

    A1 -.->|"State Bridge"| T1
    A2 -.->|"Embed"| T2
    A3 -.->|"Share"| T3
    A4 -.->|"Adapt"| T4

    style A1 fill:#1e3a5f,stroke:#4a90d9
    style A2 fill:#2d3748,stroke:#718096
    style A3 fill:#3c366b,stroke:#9f7aea
    style A4 fill:#234e52,stroke:#38b2ac
    style T1 fill:#065f46,stroke:#10b981
    style T2 fill:#1f2937,stroke:#6b7280
    style T3 fill:#312e81,stroke:#818cf8
    style T4 fill:#065f46,stroke:#10b981
`,
}

/**
 * BlockSuite Editor Modes
 */
const BLOCKSUITE_MODES: DiagramEntry = {
  id: "blocksuite-modes" as DiagramId,
  title: "BlockSuite Editor Modes",
  description: "Page mode vs Edgeless mode architecture and mode switching.",
  category: "integration",
  updatedAt: "2025-12-22",
  source: `stateDiagram-v2
    [*] --> PageMode: Default

    state PageMode {
        [*] --> PageRoot
        PageRoot --> Note: Contains
        Note --> Blocks: Contains
        Blocks --> Paragraph
        Blocks --> Heading
        Blocks --> List
        Blocks --> Code
    }

    state EdgelessMode {
        [*] --> EdgelessRoot
        EdgelessRoot --> Surface: Canvas
        Surface --> Shapes
        Surface --> Connectors
        Surface --> Frames
        EdgelessRoot --> Notes: Floating
        Notes --> Blocks2: Contains
    }

    PageMode --> EdgelessMode: Toggle Mode
    EdgelessMode --> PageMode: Toggle Mode

    note right of PageMode
        Linear document layout
        TextSelection + BlockSelection
        DOM-based rendering
    end note

    note right of EdgelessMode
        Infinite canvas
        SurfaceSelection
        Canvas-based rendering
    end note
`,
}

/**
 * State Management Bridge Pattern
 */
const STATE_BRIDGE_PATTERN: DiagramEntry = {
  id: "state-bridge-pattern" as DiagramId,
  title: "State Management Bridge Pattern",
  description: "How AFFiNE's LiveData/Jotai bridges to TMNL's effect-atom.",
  category: "integration",
  updatedAt: "2025-12-22",
  source: `flowchart LR
    subgraph AFFiNE["AFFiNE State"]
        J1[Jotai Atom]
        LD[LiveData Observable]
        SVC[Service State]
        J1 --> LD
        SVC --> LD
    end

    subgraph Bridge["Bridge Layer"]
        SUB[RxJS Subscription]
        SYNC[Atom.set on change]
        SUB --> SYNC
    end

    subgraph TMNL["TMNL State"]
        EA[effect-atom]
        ES[Effect.Service]
        EA --> ES
    end

    LD --> SUB
    SYNC --> EA

    style J1 fill:#7c3aed,stroke:#a78bfa
    style LD fill:#059669,stroke:#34d399
    style SVC fill:#2563eb,stroke:#60a5fa
    style SUB fill:#d97706,stroke:#fbbf24
    style SYNC fill:#dc2626,stroke:#f87171
    style EA fill:#10b981,stroke:#6ee7b7
    style ES fill:#0891b2,stroke:#22d3ee
`,
}

/**
 * Data Layer Stack
 */
const DATA_LAYER_STACK: DiagramEntry = {
  id: "data-layer-stack" as DiagramId,
  title: "Data Layer Stack",
  description: "Local-first storage architecture with CRDT synchronization.",
  category: "integration",
  updatedAt: "2025-12-22",
  source: `flowchart TB
    subgraph Client["Client Application"]
        UI[React Components]
        BS[BlockSuite Editor]
        YJS[Yjs Document]
    end

    subgraph Storage["Local Storage"]
        IDB[(IndexedDB<br/>Browser)]
        SQL[(SQLite<br/>Tauri/Electron)]
    end

    subgraph Sync["Synchronization"]
        WS[WebSocket Gateway]
        CRDT[Y-OCTO CRDT Engine]
    end

    subgraph Remote["Cloud Sync"]
        API[GraphQL API]
        DB[(PostgreSQL)]
    end

    UI --> BS
    BS --> YJS
    YJS --> CRDT
    CRDT --> IDB
    CRDT --> SQL
    CRDT <--> WS
    WS <--> API
    API --> DB

    style UI fill:#1e40af,stroke:#60a5fa
    style BS fill:#7c3aed,stroke:#a78bfa
    style YJS fill:#059669,stroke:#34d399
    style IDB fill:#d97706,stroke:#fbbf24
    style SQL fill:#0891b2,stroke:#22d3ee
    style WS fill:#dc2626,stroke:#f87171
    style CRDT fill:#4f46e5,stroke:#818cf8
    style API fill:#0d9488,stroke:#2dd4bf
    style DB fill:#374151,stroke:#9ca3af
`,
}

/**
 * Sync Protocol Flow
 */
const SYNC_PROTOCOL_FLOW: DiagramEntry = {
  id: "sync-protocol-flow" as DiagramId,
  title: "Sync Protocol Flow",
  description: "WebSocket synchronization protocol between client and server.",
  category: "sequence",
  updatedAt: "2025-12-22",
  source: `sequenceDiagram
    autonumber
    participant Client
    participant WS as WebSocket Gateway
    participant Server
    participant DB as PostgreSQL

    rect rgb(30, 40, 50)
    Note over Client,WS: 1. Connection & Join
    Client->>WS: Connect
    WS-->>Client: Connected
    Client->>WS: space:join(workspaceId)
    WS->>Server: Validate access
    Server-->>WS: Access granted
    WS-->>Client: Joined
    end

    rect rgb(40, 50, 60)
    Note over Client,DB: 2. Initial Sync
    Client->>WS: space:load-doc(docId, stateVector)
    WS->>Server: diffUpdate(stateVector)
    Server->>DB: Query missing updates
    DB-->>Server: Updates
    Server-->>WS: Missing updates
    WS-->>Client: Doc updates
    Client-->>Client: applyUpdate()
    end

    rect rgb(50, 60, 70)
    Note over Client,WS: 3. Local Edit
    Client-->>Client: User types
    Client->>WS: space:push-doc-update(update)
    WS->>Server: applyUpdate()
    Server->>DB: Persist update
    WS->>Client: broadcast-doc-update
    Note right of Client: Other clients
    end

    rect rgb(60, 70, 80)
    Note over Client,WS: 4. Awareness
    Client->>WS: space:update-awareness(cursor, selection)
    WS-->>Client: Broadcast to peers
    end
`,
}

/**
 * Integration Roadmap
 */
const INTEGRATION_ROADMAP: DiagramEntry = {
  id: "integration-roadmap" as DiagramId,
  title: "Integration Roadmap",
  description: "Phased approach for integrating AFFiNE into TMNL.",
  category: "integration",
  updatedAt: "2025-12-22",
  source: `gantt
    title TMNL ← AFFiNE Integration Phases
    dateFormat  YYYY-MM-DD
    section Phase 0
    Foundation & Submodule Setup       :p0, 2025-01-01, 7d
    Build Integration                  :after p0, 5d
    Documentation                      :after p0, 7d
    section Phase 1
    BlockSuite Embedding               :p1, after p0, 14d
    Basic Blocks (P, H, List, Code)    :after p1, 10d
    Mode Switching                     :after p1, 5d
    section Phase 2
    Custom TMNL Blocks                 :p2, 2025-02-01, 14d
    Effect Integration                 :after p2, 10d
    Widget System                      :after p2, 7d
    section Phase 3
    Atom Bridge                        :p3, 2025-02-20, 10d
    Service Bridge                     :after p3, 10d
    Event Bridge                       :after p3, 7d
    section Phase 4
    Local Persistence                  :p4, 2025-03-10, 14d
    Tauri SQLite                       :after p4, 10d
    Optional Cloud Sync                :after p4, 14d
    section Phase 5
    UI Polish                          :p5, 2025-04-01, 14d
    Extensions                         :after p5, 10d
    Testing                            :after p5, 14d
`,
}

// =============================================================================
// Registry
// =============================================================================

export const DIAGRAM_REGISTRY: readonly DiagramEntry[] = [
  // Original diagrams
  IGGY_CANONICAL_FLOW,
  AVA_VIEW_LIFECYCLE,
  IGGY_TOPIC_STRUCTURE,
  // AFFiNE Integration diagrams
  AFFINE_TMNL_LAYERS,
  BLOCKSUITE_MODES,
  STATE_BRIDGE_PATTERN,
  DATA_LAYER_STACK,
  SYNC_PROTOCOL_FLOW,
  INTEGRATION_ROADMAP,
] as const

/**
 * Get diagram by ID
 */
export const getDiagram = (id: string): DiagramEntry | undefined =>
  DIAGRAM_REGISTRY.find((d) => d.id === id)

/**
 * Get diagrams by category
 */
export const getDiagramsByCategory = (category: DiagramCategory): DiagramEntry[] =>
  DIAGRAM_REGISTRY.filter((d) => d.category === category)

/**
 * Get all diagram categories with counts
 */
export const getCategoryCounts = (): Record<DiagramCategory, number> => {
  const counts: Record<DiagramCategory, number> = {
    architecture: 0,
    flow: 0,
    sequence: 0,
    state: 0,
    class: 0,
    er: 0,
    integration: 0,
  }
  for (const diagram of DIAGRAM_REGISTRY) {
    counts[diagram.category]++
  }
  return counts
}
