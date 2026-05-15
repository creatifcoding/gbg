# effect-v4-schema — Changelog

> up: SKILL.md
> prereqs: none
> provides: change-history
> children: none
> meta: true

## [0.1.0] — 2026-03-02

Bootstrap. Comprehensive Effect v4 Schema skill with 10 reference docs covering the full Schema surface area. Written against `submodules/effect-smol/packages/effect/SCHEMA.md` (8167 lines, v4 canonical source).

| Action | File | What changed |
|---|---|---|
| `+` | `SKILL.md` | Created. Router, cheat sheet (v3→v4 critical changes table), AGENTS.md alignment note (TaggedStruct removed), import map for @tmnl/* aliases. |
| `+` | `CHANGELOG.md` | Created. |
| `+` | `GRAPH.md` | Created. 14 nodes, 13 edges. |
| `+` | `references/INDEX.md` | Created. Routes to 10 leaf docs + pending REF.md. |
| `+` | `references/elementary.md` | Primitives, Literals (array syntax), String checks, Number checks, Dates, TemplateLiterals. |
| `+` | `references/structs.md` | Struct, optionalKey/mutableKey, optional fields, defaults, index signatures, deriving (pick/omit/merge/mapFields), tagged structs, tagDefaultOmit. |
| `+` | `references/classes.md` | Opaque, Class (v4 call signature), TaggedClass, ErrorClass, TaggedErrorClass, extend, branded classes, recursive schemas, mutually recursive. |
| `+` | `references/unions.md` | Union (array syntax), tagged unions, matching, augmenting, union of literals, exclusive unions. |
| `+` | `references/collections.md` | Array, NonEmptyArray, unique arrays, Tuple (array syntax), rest elements, Record, literal struct records. |
| `+` | `references/validation.md` | .check() API, makeFilter, filter groups, abort, multiple issues, brands, refinements, structural filters, effectful filters, filter factories. |
| `+` | `references/transformations.md` | SchemaTransformation (first-class), SchemaGetter, decode/decodeTo, composition, passthrough helpers, optional key transforms, omitting keys, flipping. |
| `+` | `references/serialization.md` | JSON (UnknownFromJsonString, fromJsonString, toCodecJson), FormData, URLSearchParams, canonical codecs table. |
| `+` | `references/migration.md` | Full v3→v4 mapping: array syntax changes, renames (BigIntFromSelf→BigInt), decode/encode API renames, removed APIs (validate*, filter, TaggedStruct, keyof), transformation overhaul, optional field transforms. |
| `+` | `references/integration.md` | @tmnl/* alias pattern, module boundary rules, Effect services with Schema, EventLog payloads, atoms, domain modeling pattern (branded IDs → Literals → TaggedClass → TaggedErrorClass → JSON codec). |
