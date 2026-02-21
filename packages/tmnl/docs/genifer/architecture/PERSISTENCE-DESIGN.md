# Genifer Persistence Design — Leaves-as-Graph

> Every UIElement is a row. Trees are graphs. Composites are reusable fragments.
> Quality signals accumulate as append-only events.

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | PostgreSQL with native JSONB | GIN indexes on props, json_path queries, recursive CTEs |
| D2 | Leaves as first-class rows | Per-component queries, cross-tree reuse, graph structure in tables |
| D3 | Trees reconstructed via recursive CTE | `parent_key` encodes the graph; `children` array preserves ordering |
| D4 | `className` as universal column | Every component accepts Tailwind utility classes for layout |
| D5 | Composites = named tree fragments | Agent-created "LoginCard" = stored subgraph, expanded at generation time |
| D6 | Signals table (append-only) | Pipeline score, human rating, usage — accumulate independently |
| D7 | Effect.Schema ↔ DDL parity | Schema definitions are canonical; DDL mirrors them |

---

## Entity Relationship

```
┌──────────────────┐       ┌──────────────────────────┐
│  genifer_trees    │       │    genifer_elements       │
│──────────────────│       │──────────────────────────│
│ id (PK)          │◄──┐   │ id (PK)                  │
│ prompt            │   │   │ tree_id (FK) ────────────┤
│ root_key          │   │   │ element_key (UNIQUE w/   │
│ model             │   │   │   tree_id)               │
│ quality_score     │   │   │ element_type             │
│ element_count     │   │   │ props (JSONB)            │
│ repair_count      │   │   │ class_name               │
│ duration_ms       │   │   │ parent_key ──────────┐   │
│ thread_id         │   │   │ children (TEXT[])    │   │
│ parent_tree_id ───┤   │   │ depth               │   │
│ human_rating      │   │   │ entrance (JSONB)    │   │
│ usage_count       │   │   │ role, aria_label    │   │
│ tags (TEXT[])     │   │   │ visible (JSONB)     │   │
│ created_at        │   └───│ quality_score       │   │
│ updated_at        │       │ created_at          │   │
└──────────────────┘       └──────────────────────┘   │
         │                          │    ▲              │
         │                          │    └──────────────┘
         │                          │     (self-referential
         ▼                          │      parent→child)
┌──────────────────┐       ┌────────┴─────────────────┐
│ genifer_composites│       │    genifer_signals        │
│──────────────────│       │──────────────────────────│
│ id (PK)          │       │ id (PK)                  │
│ name (UNIQUE)    │       │ target_type              │
│ description      │       │ target_id (FK)           │
│ template (JSONB) │       │ signal_type              │
│ props_schema     │       │ value                    │
│ default_class    │       │ metadata (JSONB)         │
│ has_children     │       │ created_at               │
│ quality_score    │       └──────────────────────────┘
│ human_rating     │
│ usage_count      │
│ created_by       │
│ created_at       │
│ updated_at       │
└──────────────────┘
```

---

## DDL

### genifer_trees — Generation metadata

```sql
CREATE TABLE genifer_trees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt        TEXT NOT NULL,
  root_key      TEXT NOT NULL,
  model         TEXT,
  quality_score REAL NOT NULL DEFAULT 0,
  element_count INT  NOT NULL DEFAULT 0,
  repair_count  INT  NOT NULL DEFAULT 0,
  duration_ms   INT,
  thread_id     TEXT,
  parent_tree_id UUID REFERENCES genifer_trees(id),
  human_rating  SMALLINT CHECK (human_rating BETWEEN 1 AND 5),
  usage_count   INT DEFAULT 0,
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trees_thread   ON genifer_trees(thread_id);
CREATE INDEX idx_trees_model    ON genifer_trees(model);
CREATE INDEX idx_trees_tags     ON genifer_trees USING GIN(tags);
CREATE INDEX idx_trees_parent   ON genifer_trees(parent_tree_id);
CREATE INDEX idx_trees_quality  ON genifer_trees(quality_score DESC);
```

### genifer_elements — Every leaf/node is a row

```sql
CREATE TABLE genifer_elements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id       UUID NOT NULL REFERENCES genifer_trees(id) ON DELETE CASCADE,
  element_key   TEXT NOT NULL,
  element_type  TEXT NOT NULL,
  props         JSONB NOT NULL DEFAULT '{}',
  class_name    TEXT,
  parent_key    TEXT,
  children      TEXT[] DEFAULT '{}',
  depth         INT NOT NULL DEFAULT 0,
  entrance      JSONB,
  role          TEXT,
  aria_label    TEXT,
  visible       JSONB,
  quality_score REAL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tree_id, element_key)
);

CREATE INDEX idx_elements_tree    ON genifer_elements(tree_id);
CREATE INDEX idx_elements_type    ON genifer_elements(element_type);
CREATE INDEX idx_elements_parent  ON genifer_elements(tree_id, parent_key);
CREATE INDEX idx_elements_props   ON genifer_elements USING GIN(props);
CREATE INDEX idx_elements_class   ON genifer_elements(class_name) WHERE class_name IS NOT NULL;
CREATE INDEX idx_elements_depth   ON genifer_elements(tree_id, depth);
```

### genifer_composites — Agent-created reusable fragments

```sql
CREATE TABLE genifer_composites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  description     TEXT,
  template        JSONB NOT NULL,
  props_schema    JSONB,
  default_class   TEXT,
  has_children    BOOLEAN DEFAULT false,
  quality_score   REAL DEFAULT 0,
  human_rating    SMALLINT CHECK (human_rating BETWEEN 1 AND 5),
  usage_count     INT DEFAULT 0,
  created_by      TEXT NOT NULL DEFAULT 'agent'
                  CHECK (created_by IN ('system', 'agent', 'human')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_composites_name    ON genifer_composites(name);
CREATE INDEX idx_composites_quality ON genifer_composites(quality_score DESC);
CREATE INDEX idx_composites_usage   ON genifer_composites(usage_count DESC);
CREATE INDEX idx_composites_creator ON genifer_composites(created_by);
```

### genifer_signals — Append-only quality events

```sql
CREATE TABLE genifer_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('element', 'tree', 'composite')),
  target_id    UUID NOT NULL,
  signal_type  TEXT NOT NULL CHECK (signal_type IN (
    'pipeline_score', 'human_rating', 'usage', 'repair',
    'reuse', 'promote', 'deprecate'
  )),
  value        REAL NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signals_target ON genifer_signals(target_type, target_id);
CREATE INDEX idx_signals_type   ON genifer_signals(signal_type);
CREATE INDEX idx_signals_time   ON genifer_signals(created_at DESC);
```

---

## Recursive CTE — Tree Assembly

### Full tree from tree_id

```sql
WITH RECURSIVE tree_walk AS (
  -- Root
  SELECT e.*, 0 AS walk_level
  FROM genifer_elements e
  JOIN genifer_trees t ON e.tree_id = t.id
  WHERE t.id = $1
    AND e.element_key = t.root_key

  UNION ALL

  -- Children (ordered by array position)
  SELECT child.*, tw.walk_level + 1
  FROM tree_walk tw
  JOIN genifer_elements child
    ON child.tree_id = tw.tree_id
   AND child.parent_key = tw.element_key
)
SELECT
  element_key,
  element_type,
  props,
  class_name,
  parent_key,
  children,
  depth,
  entrance,
  walk_level
FROM tree_walk
ORDER BY walk_level, element_key;
```

### Subtree from any node

```sql
WITH RECURSIVE subtree AS (
  SELECT e.*, 0 AS rel_depth
  FROM genifer_elements e
  WHERE e.tree_id = $1
    AND e.element_key = $2

  UNION ALL

  SELECT child.*, s.rel_depth + 1
  FROM subtree s
  JOIN genifer_elements child
    ON child.tree_id = s.tree_id
   AND child.parent_key = s.element_key
)
SELECT * FROM subtree ORDER BY rel_depth;
```

### All trees containing a specific component type

```sql
SELECT DISTINCT t.*
FROM genifer_trees t
JOIN genifer_elements e ON e.tree_id = t.id
WHERE e.element_type = $1
ORDER BY t.quality_score DESC;
```

### Component frequency across all trees

```sql
SELECT
  element_type,
  COUNT(*) as total_uses,
  COUNT(DISTINCT tree_id) as trees_used_in,
  AVG(quality_score) as avg_quality
FROM genifer_elements
GROUP BY element_type
ORDER BY total_uses DESC;
```

### Find reusable subtrees (same structure across trees)

```sql
-- Elements that appear with same type+props pattern in multiple trees
SELECT
  element_type,
  props,
  class_name,
  COUNT(DISTINCT tree_id) as tree_count
FROM genifer_elements
GROUP BY element_type, props, class_name
HAVING COUNT(DISTINCT tree_id) > 3
ORDER BY tree_count DESC;
```

---

## Effect.Schema Definitions

These are the canonical types. DDL mirrors them.

```typescript
import { Schema } from "effect"

// ─── Stored Element (row in genifer_elements) ───

export class StoredElement extends Schema.Class<StoredElement>("StoredElement")({
  id: Schema.UUID,
  treeId: Schema.UUID,
  elementKey: Schema.String,
  elementType: Schema.String,
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  className: Schema.NullOr(Schema.String),
  parentKey: Schema.NullOr(Schema.String),
  children: Schema.Array(Schema.String),
  depth: Schema.Number,
  entrance: Schema.NullOr(Schema.Unknown),
  role: Schema.NullOr(Schema.String),
  ariaLabel: Schema.NullOr(Schema.String),
  visible: Schema.NullOr(Schema.Unknown),
  qualityScore: Schema.Number,
  createdAt: Schema.DateFromString,
}) {}

// ─── Stored Tree (row in genifer_trees) ───

export class StoredTree extends Schema.Class<StoredTree>("StoredTree")({
  id: Schema.UUID,
  prompt: Schema.String,
  rootKey: Schema.String,
  model: Schema.NullOr(Schema.String),
  qualityScore: Schema.Number,
  elementCount: Schema.Number,
  repairCount: Schema.Number,
  durationMs: Schema.NullOr(Schema.Number),
  threadId: Schema.NullOr(Schema.String),
  parentTreeId: Schema.NullOr(Schema.UUID),
  humanRating: Schema.NullOr(Schema.Int.pipe(Schema.between(1, 5))),
  usageCount: Schema.Number,
  tags: Schema.Array(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

// ─── Stored Composite (row in genifer_composites) ───

export const CompositeCreator = Schema.Literal("system", "agent", "human")

export class StoredComposite extends Schema.Class<StoredComposite>("StoredComposite")({
  id: Schema.UUID,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  template: Schema.Unknown,         // Serialized tree fragment
  propsSchema: Schema.NullOr(Schema.Unknown),
  defaultClass: Schema.NullOr(Schema.String),
  hasChildren: Schema.Boolean,
  qualityScore: Schema.Number,
  humanRating: Schema.NullOr(Schema.Int.pipe(Schema.between(1, 5))),
  usageCount: Schema.Number,
  createdBy: CompositeCreator,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

// ─── Signal (row in genifer_signals) ───

export const SignalTargetType = Schema.Literal("element", "tree", "composite")
export const SignalType = Schema.Literal(
  "pipeline_score", "human_rating", "usage",
  "repair", "reuse", "promote", "deprecate"
)

export class StoredSignal extends Schema.Class<StoredSignal>("StoredSignal")({
  id: Schema.UUID,
  targetType: SignalTargetType,
  targetId: Schema.UUID,
  signalType: SignalType,
  value: Schema.Number,
  metadata: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.DateFromString,
}) {}
```

---

## UIElement Schema Change — `className`

The existing `UIElement` needs a new field. This is a **non-breaking additive change** — existing trees without `className` remain valid (field is optional).

```typescript
// In src/lib/genifer/core/schemas.ts — add to UIElement
className: Schema.optional(Schema.String)
```

**Renderer change** — apply className to the wrapper div:

```tsx
// In renderer.tsx — ElementRenderer
const classNames = [element.className].filter(Boolean).join(" ")
return (
  <div className={classNames || undefined}>
    <Component element={element} ... />
  </div>
)
```

**Catalog prompt change** — tell the LLM about className:

```markdown
## Styling

Every component accepts an optional `className` string with Tailwind utility classes
for layout control: margins, padding, sizing, positioning, display overrides.

Examples:
- `"className": "mt-4 px-6"` — margin top + horizontal padding
- `"className": "w-full max-w-md mx-auto"` — constrained centered width
- `"className": "grid grid-cols-3 gap-4"` — CSS grid on any container
- `"className": "hidden md:block"` — responsive visibility

Use className for layout tweaks. Use component props for semantic behavior.
```

---

## Persistence Flow

### Save after generate()

```
generate(prompt)
  → UITree + GenerateResult
  → INSERT INTO genifer_trees (prompt, root_key, model, quality_score, ...)
  → For each element in tree.elements:
      INSERT INTO genifer_elements (tree_id, element_key, element_type, props, ...)
  → INSERT INTO genifer_signals (target_type='tree', signal_type='pipeline_score', value=score)
```

### Save after refine()

```
refine(prompt, currentTree)
  → UITree + GenerateResult
  → INSERT INTO genifer_trees (prompt, root_key, parent_tree_id=currentTree.id, ...)
  → For each element: INSERT INTO genifer_elements (...)
  → Signal: pipeline_score
```

### Save agent-created composite

```
ComponentDefine tool call
  → UPSERT INTO genifer_composites (name, template, description, ...)
  → Signal: pipeline_score (from validation)
```

### Human rating

```
User thumbs-up on rendered tree
  → INSERT INTO genifer_signals (target_type='tree', signal_type='human_rating', value=4)
  → UPDATE genifer_trees SET human_rating = 4, updated_at = now()
```

### Usage tracking

```
Composite "LoginCard" referenced in a generation
  → UPDATE genifer_composites SET usage_count = usage_count + 1
  → INSERT INTO genifer_signals (target_type='composite', signal_type='usage', value=1)
```

---

## Composite Quality Score (Materialized)

```sql
-- Materialized view for composite ranking
CREATE MATERIALIZED VIEW genifer_composite_rankings AS
SELECT
  c.id,
  c.name,
  c.usage_count,
  c.quality_score AS pipeline_score,
  c.human_rating,
  -- Composite score: 40% pipeline + 30% human + 30% usage
  (
    COALESCE(c.quality_score, 0) * 0.4 +
    COALESCE(c.human_rating::real / 5.0, 0) * 0.3 +
    LEAST(c.usage_count::real / 100.0, 1.0) * 0.3
  ) AS composite_rank
FROM genifer_composites c
ORDER BY composite_rank DESC;

-- Refresh periodically
REFRESH MATERIALIZED VIEW genifer_composite_rankings;
```

---

## Box Primitive + className

The new `Box` component alongside existing layout components:

```typescript
// In layout catalog
Box: {
  schema: Schema.Struct({
    className: Schema.optional(Schema.String),
    as: Schema.optional(Schema.Literal("div", "section", "article", "aside", "nav", "main", "header", "footer")),
  }),
  renderer: BoxRenderer,
  description: "Generic container with Tailwind className for custom layout. Use when VStack/HStack/Grid don't fit.",
  hasChildren: true,
}
```

Agent can now do:
```json
{
  "type": "Box",
  "key": "hero",
  "props": {
    "className": "flex items-center justify-center min-h-[60vh] bg-gradient-to-b from-zinc-900 to-zinc-950",
    "as": "section"
  },
  "children": ["hero-content"]
}
```

While still using VStack/HStack/Grid for common patterns:
```json
{
  "type": "VStack",
  "key": "sidebar",
  "props": { "gap": 8, "padding": 16, "className": "border-r border-zinc-800 min-w-[240px]" }
}
```

---

## Migration Path

1. **Phase 1**: Add `className` to UIElement schema + renderer + catalog prompt
2. **Phase 2**: Add Box component to layout catalog
3. **Phase 3**: DDL migration + Effect schemas for persistence layer
4. **Phase 4**: Wire save/load into generate()/refine() pipeline
5. **Phase 5**: ComponentDefine tool for agent composite authoring
6. **Phase 6**: Rating signals + materialized rankings
