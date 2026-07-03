# Mathemes System Overview

**Status**: Active design — principles locked from interview 2025-05-11.

---

## Design Principles (Locked)

These are the axioms of the naming system. Every subsequent design decision must be consistent with them.

### P1. Three Registers

Every concept has up to three names, each with a defined context:

| Register | Form | Context | Example |
|---|---|---|---|
| **Systematic** | Full compositional name from morpheme grammar | Textbooks, cross-domain papers, first encounters, formal definitions | complete inner-product space |
| **Standard** | Approved abbreviation or compact form | Working papers, lecture notes, within-domain communication | CIP-space (or similar) |
| **Legacy** | Traditional/eponymous name preserved as alias | Expert conversation, historical reference, backward compatibility | Hilbert space |

The system **generates** the systematic name. The standard abbreviation is **curated** per concept. The legacy alias is **inherited** from existing usage.

No register is deprecated. Each serves a communicative function. The systematic name is canonical for disambiguation; the others are convenience.

### P2. Facet-Consistent, Cross-Facet Pragmatic Metaphor

Morphemes are organized into facets. Within each facet, metaphor domains are consistent:

| Facet | Metaphor Domain | Examples |
|---|---|---|
| **Structure** | Spatial/architectural | space, group, ring, field, bundle, lattice, tower |
| **Property** | State of being | complete, compact, connected, dense, bounded, closed |
| **Operation** | Motion/action | transform, project, embed, lift, fold, decompose |
| **Relation** | Positional | dual, adjoint, conjugate, inverse, quotient |
| **Qualifier** | Scope/measure | finite, countable, local, global, uniform |
| **Domain** | Material/substance | number, function, set, sequence, operator, measure |

Across facets, pragmatism rules — if the clearest name for a concept mixes metaphor domains (e.g., "frequency decomposition" = domain + operation), that's fine. Consistency is enforced *within* a facet, not *across* facets.

### P3. Total Polysemy Resolution

Every morpheme in the inventory has **exactly one meaning**. If a word currently means multiple things in mathematics, each meaning gets a distinct morpheme.

**The resolution process is analytic, not naive.** For each polysemous term:

1. **Collect** all distinct mathematical meanings (the polysemy set)
2. **Map** the semantic network — how are the meanings related? Are they generalizations of each other, or genuinely distinct concepts?
3. **Analyze** the precision requirements — would a candidate replacement over-narrow or over-broaden the concept?
4. **Name** each distinct meaning with a morpheme whose semantic scope matches the mathematical scope exactly

Example: "normal" is NOT simply replaced with "perpendicular" everywhere, because orthogonality generalizes beyond geometric perpendicularity. The polysemy network must be mapped first:

```
"normal" polysemy set:
├── normal subgroup → invariant-under-conjugation → "conjugation-invariant subgroup"
├── normal distribution → the specific bell-curve distribution → "bell distribution" or retain "normal" here (original usage)
├── normal vector → perpendicular to a surface → "surface-orthogonal vector" (preserves generality)
├── normal space (T4) → disjoint-closed-sets-separable → "closed-set-separated space"
└── normal operator → commutes with its adjoint → "adjoint-commuting operator"
```

Each replacement must be vetted for precision at the level of working mathematicians, not just pedagogical clarity.

### P4. Morpheme Transparency Test

A morpheme is admissible if it passes the **decomposition test**: can a reader with general scientific literacy decompose it into meaningful sub-units?

| Term | Decomposable? | Verdict |
|---|---|---|
| commutative | com + mutare = "change together" | ✅ Keep |
| injective | in + jactare = "throw in" | ✅ Keep |
| Hausdorff | ??? | ❌ Replace |
| Noetherian | ??? | ❌ Replace |
| compact | com + pactum = "pressed together" | ✅ Keep |
| metrizable | metron + -izable = "measurable" | ✅ Keep |
| Tychonoff | ??? | ❌ Replace |

The test applies equally to Latin/Greek roots and English vernacular. "Swappable" passes (swap + -able). "Commutative" passes (Latin decomposition). "Hausdorff" fails (opaque proper noun). The source language doesn't matter — transparency does.

### P5. Distinguishing Properties Only

Names encode only the properties that distinguish a concept from its siblings in the structural hierarchy. Implied properties are not spelled out.

```
✅ complete inner-product space
   (inner-product implies normed, normed implies metric, metric implies topological)

❌ complete inner-product normed metric topological space
   (redundant — every word after 'inner-product' is implied)
```

The composition rules document which properties imply which. A reader who knows the rules can reconstruct the full hierarchy from the name. A reader who doesn't still gets the key distinguishing features.

### P6. The 8-Syllable Budget (Substantiated)

Grounded in psycholinguistic evidence on compound word processing (Bertram & Hyönä, 2003; El-Bialy et al., 2013). See `research/08-density-and-length.md` for full analysis.

**The constraint**: Any systematic name exceeding 8 syllables MUST have a curated standard abbreviation.

| Syllable Count | Processing Mode | Requirement |
|---|---|---|
| ≤4 syllables | Holistic (single fixation) | No abbreviation needed — this is ideal |
| 5-7 syllables | Decomposition (manageable) | Standard abbreviation optional |
| 8-10 syllables | Decomposition (costly) | Standard abbreviation REQUIRED |
| 11+ syllables | Overload | Systematic name for indexing only; standard register is the default |

**The composition sweet spot**: 2-3 morphemes, 4-7 syllables, semantically transparent.

```
[qualifier/property] + [distinguishing property] + [structure]
Examples:
  commutative + group                 (2 morphemes, 5 syllables) ✅ ideal
  point-separated + space              (2 morphemes, 6 syllables) ✅ sweet spot
  complete + inner-product + space     (3 morphemes, 8 syllables) ⚠️ at limit — abbreviation available
```

### P7. Designed Compression

Abbreviation is inevitable (50+ years of medical terminology research confirms this). The system must design it, not leave it to chance.

For every concept whose systematic name exceeds 8 syllables:
1. The full systematic name exists for disambiguation and indexing
2. A curated standard abbreviation exists for working communication
3. The abbreviation's derivation is documented (not arbitrary)

```
conjugation-invariant subgroup  (10 syllables — OVER budget)
→ Standard: invariant subgroup  (5 syllables — within budget, already in use)

symmetry-conservation theorem   (10 syllables — OVER budget)
→ Standard: sym-con theorem     (5 syllables — designed compression)
```

### P8. The Tiered Source Language

Morphemes are drawn from all three source traditions, selected by the transparency test (P4):

1. **Existing transparent terms** (keep as-is): commutative, injective, compact, continuous, linear, metric, topology...
2. **Classical roots** (for new formal-register morphemes): Latin/Greek morphemes that compose cleanly and cross languages
3. **English vernacular** (for new vernacular-register morphemes): plain words that maximize accessibility

The three registers (P1) map naturally:
- Systematic register may use classical morphemes for precision
- Standard register uses whatever's shortest and clear
- Legacy register preserves historical terms

---

## Architecture Summary

```
┌─────────────────────────────────────────────┐
│            MATHEMES SYSTEM                   │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │  Morpheme     │   │  Polysemy        │    │
│  │  Inventory    │──▶│  Resolution      │    │
│  │  (~200 atoms) │   │  Networks        │    │
│  └──────┬───────┘   └────────┬─────────┘    │
│         │                    │               │
│         ▼                    ▼               │
│  ┌──────────────────────────────────────┐   │
│  │  Compositional Grammar               │   │
│  │  (precedence + ordering + nesting)   │   │
│  └──────────────┬───────────────────────┘   │
│                 │                            │
│         ┌───────┼───────┐                   │
│         ▼       ▼       ▼                   │
│  ┌──────────┐ ┌─────┐ ┌────────┐           │
│  │Systematic│ │Std  │ │Legacy  │           │
│  │Register  │ │Abbr │ │Alias   │           │
│  └──────────┘ └─────┘ └────────┘           │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Edge Case Handling                   │   │
│  │  (theorems, conjectures, constants)  │   │
│  └──────────────────────────────────────┘   │
│                                              │
└─────────────────────────────────────────────┘
```

---

*Principles locked 2025-05-11. All subsequent system design must conform.*
