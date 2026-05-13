# effect-v4-schema — Skill Graph

> up: SKILL.md
> prereqs: none
> provides: full-topology
> children: none
> meta: true

## Topology

```
SKILL.md                                    # Router + cheat sheet + AGENTS.md alignment
├──[routes]─→ GRAPH.md                      # This file
├──[routes]─→ CHANGELOG.md                  # Version history
│
└──[routes]─→ references/INDEX.md           # Reference router (10 leaf docs)
    ├──[contains]─→ elementary.md           # Primitives, Literals, Strings, Numbers, Dates, TemplateLiterals
    ├──[contains]─→ structs.md              # Struct, optional/mutable, defaults, index sigs, deriving
    ├──[contains]─→ classes.md              # Class, TaggedClass, Opaque, ErrorClass, recursive
    ├──[contains]─→ unions.md               # Union, TaggedUnion, discriminated, matching
    ├──[contains]─→ collections.md          # Array, Tuple, Record, rest, unique
    ├──[contains]─→ validation.md           # .check(), filters, brands, refinements, effectful
    ├──[contains]─→ transformations.md      # decode, decodeTo, SchemaTransformation, SchemaGetter
    ├──[contains]─→ serialization.md        # JSON, FormData, URLSearchParams, canonical codecs
    ├──[contains]─→ migration.md            # v3→v4 full API mapping, removed/renamed
    ├──[contains]─→ integration.md          # @tmnl/* aliases, Effect services, EventLog, atoms
    └──[pending]──→ REF.md                  # Internals deep dive (async research in progress)
```

## Counts

| Metric | Value |
|---|---|
| Skill doc nodes | 14 |
| Reference docs | 10 (+ 1 pending REF.md) |
| Total edges | 13 |
| Source of truth | `submodules/effect-smol/packages/effect/SCHEMA.md` (8167 lines) |
