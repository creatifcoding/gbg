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
  "er"
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
// Registry
// =============================================================================

export const DIAGRAM_REGISTRY: readonly DiagramEntry[] = [
  IGGY_CANONICAL_FLOW,
  AVA_VIEW_LIFECYCLE,
  IGGY_TOPIC_STRUCTURE,
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
  }
  for (const diagram of DIAGRAM_REGISTRY) {
    counts[diagram.category]++
  }
  return counts
}
