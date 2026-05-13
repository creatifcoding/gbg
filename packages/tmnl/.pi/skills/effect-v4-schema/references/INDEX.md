# effect-v4-schema — References

> up: ../SKILL.md
> prereqs: none
> provides: reference-routing
> children: elementary.md, structs.md, classes.md, unions.md, collections.md, validation.md, transformations.md, serialization.md, migration.md, integration.md

Reference docs for Effect v4 Schema. Each file covers one vertical slice.

| File | Covers |
|---|---|
| `elementary.md` | Primitives, Literals, Strings, Numbers, Dates, TemplateLiterals |
| `structs.md` | Struct, optional/mutable keys, defaults, index signatures, deriving (pick/omit/merge/map) |
| `classes.md` | Class, TaggedClass, Opaque, ErrorClass, TaggedErrorClass, extend, recursive |
| `unions.md` | Union, TaggedUnion, discriminated unions, exclusive unions, matching |
| `collections.md` | Array, Tuple, Record, rest elements, unique arrays |
| `validation.md` | .check(), filters, filter groups, brands, refinements, effectful filters |
| `transformations.md` | decode, decodeTo, SchemaTransformation, SchemaGetter, composition, optional keys |
| `serialization.md` | JSON, FormData, URLSearchParams, canonical codecs |
| `migration.md` | v3→v4 API mapping, removed APIs, renamed APIs |
| `integration.md` | @tmnl/* alias patterns, Effect services, EventLog, atoms |
