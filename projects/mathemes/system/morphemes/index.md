# Morpheme Inventory — Index

**Status**: Active construction.

---

## Organization

Morphemes are organized by **facet** — the semantic role they play in a compound name. Each facet has its own document with the full inventory for that facet.

| Facet | Document | Role in Names | Count Target |
|---|---|---|---|
| **Structures** | `structures.md` | The head noun — what kind of mathematical object | 30-40 |
| **Properties** | `properties.md` | Modifiers describing intrinsic characteristics | 50-70 |
| **Operations** | `operations.md` | Verbs/processes acting on or between objects | 25-35 |
| **Relations** | `relations.md` | How objects relate to each other | 15-25 |
| **Qualifiers** | `qualifiers.md` | Scope, size, cardinality constraints | 15-20 |
| **Domains** | `domains.md` | The mathematical substance being structured | 15-25 |

**Total target**: 150-215 morphemes.

## Entry Format

Each morpheme entry includes:

```
### morpheme-name

- **Meaning**: precise mathematical definition
- **Etymology**: source language + decomposition
- **Transparency**: ✅ transparent / ⚠️ semi-transparent / ❌ opaque
- **Polysemy check**: single-meaning ✅ / polysemous ⚠️ (see resolution)
- **Facet**: which facet this belongs to
- **Composes with**: which other morphemes it naturally combines with
- **Examples**: 2-3 compound names using this morpheme
- **Notes**: usage constraints, gotchas, historical context
```

## Polysemy Resolution Index

Terms that mean multiple things in mathematics. Each gets its own analysis before entering the inventory.

See `../polysemy/` directory for full polysemy network analyses.

| Term | Meanings | Resolution Status |
|---|---|---|
| normal | 5+ (subgroup, distribution, vector, space, operator) | 🔴 Needs full analysis |
| regular | 4+ (space, language, representation, polygon) | 🔴 Needs full analysis |
| complete | 3+ (metric space, lattice, graph) | 🟡 Partially analyzed |
| simple | 3+ (group, root, ring) | 🔴 Needs full analysis |
| free | 3+ (group, module, variable) | 🔴 Needs full analysis |
| closed | 3+ (set, form, manifold) | 🟡 Partially analyzed |
| dual | 3+ (space, category, graph) | 🟡 Partially analyzed |
| prime | 2+ (number, ideal) | 🟢 Related senses — may keep |
| ideal | 2+ (ring theory, general usage) | 🟡 Context-dependent |
| radical | 2+ (ring theory, root extraction) | 🔴 Needs analysis |
| projection | 2+ (linear algebra, topology) | 🟢 Related senses |
| kernel | 2+ (algebra, analysis) | 🟢 Related senses |
| characteristic | 2+ (field, class) | 🔴 Needs analysis |
| order | 3+ (group, relation, differential equation) | 🔴 Needs analysis |
| degree | 3+ (polynomial, vertex, map) | 🔴 Needs analysis |
| rank | 2+ (matrix, tensor) | 🟢 Related senses |
| spectrum | 2+ (operator, ring) | 🟡 Related but distinct |

## Construction Sequence

1. **Structures** first — the head nouns anchor everything
2. **Properties** next — the largest facet, requires most polysemy work
3. **Operations** — the action vocabulary
4. **Relations, Qualifiers, Domains** — smaller, more stable facets
5. **Polysemy networks** — cross-cutting analysis, done in parallel

---

*This index will be updated as each facet inventory is built.*
