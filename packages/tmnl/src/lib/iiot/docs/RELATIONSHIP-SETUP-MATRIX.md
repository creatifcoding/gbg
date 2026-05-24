# Relationship Setup Matrix

> Status: implemented control-plane matrix
> Canonical source: `src/lib/iiot/schemas/relationships/setup-matrix.ts`

The relationship setup matrix maps durable event facts to graph projection writes.
It does **not** make Reactor decisions. It creates or closes topology so later
Reactor policies can traverse explicit relationships.

```text
Durable Event
  -> relationship setup matrix entry
  -> graph projection lane
  -> nodes / edges / audit
  -> Reactor may consume topology later, if a policy exists
```

## Jurisdiction

| Jurisdiction | Meaning |
| --- | --- |
| `structural_graph_projection` | ISA-95 structural events create/update/close hierarchy graph projection. |
| `context_graph_projection` | WorkOrder context events materialize operational relationships. |
| `audit_projection` | Durable event is audit/projection state only; no topology mutation. |

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `materializes_graph` | Event has direct graph node/edge writes. |
| `updates_node` | Event updates a graph node projection but does not alter relationships. |
| `closes_graph` | Event soft-closes one or more relationship edges. |
| `audit_only` | Event is intentionally non-topological. |
| `candidate_projection` | Event should project topology, but needs a resolver/mapping policy. |
| `blocked_by_registry` | Event reveals a relationship the current edge registry does not allow yet. |

## Key rows

| Event | Projection |
| --- | --- |
| `SiteCreated` | `site` node + `enterprise -[:contains]-> site` |
| `PlantCreated` | `plant` node + optional `site|area -[:contains]-> plant` |
| `MachineCreated` | `machine` node + canonical `line|workcell -[:contains]-> machine` |
| `SensorCreated` | `sensor` node + `sensor -[:monitors]-> machine` |
| `DeviceCreated` | `device` node only; machine/device containment is a registry gap. |
| `ContextCreated` | `work_order` node + candidate `targets` edges for `initialAssets[]`. |
| `AssetAttached` | candidate `work_order -[:targets]-> asset` after asset-type lookup. |
| `AssetDetached` | candidate soft-close of `work_order -[:targets]-> asset`. |
| `ResourceAllocated` | candidate `work_order -[:requires]-> external(resource)`. |
| `ExternalRefLinked` | candidate `requires` or `produces`, selected by external ref mapping. |
| `ChildWorkOrderSpawned` | `parent -[:depends_on]-> child` and `child -[:caused_by]-> parent`. |

## Known registry gaps

The matrix explicitly refuses to invent unregistered edges:

- `DeviceCreated` / `DeviceDecommissioned` need a Machine -> Device relationship.
- `AssetAttached` support/reference roles may need `related_to` widened to structural assets.
- `ResourceAllocated` personnel assignments may need a precise `supervises` mapping.

## Tests

Coverage lives in:

```text
src/lib/iiot/__tests__/relationships/relationship-setup-matrix.test.ts
```

The tests assert:

1. every StructuralEvent and ContextEvent tag has an explicit row;
2. every declared edge is allowed by `RELATIONSHIP_EDGE_REGISTRY`;
3. known registry gaps stay explicit instead of becoming accidental Cypher;
4. the matrix round-trips through Effect Schema.

## Next implementation unit

`#3944 Materialize relationships from ContextEvents` should use this matrix as
the source of truth for projection-handler routing. The handler should stay
projection-owned: write graph nodes/edges and audit, then let Reactor consume
that topology only through separately declared policies.
