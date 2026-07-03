# Mathemes

**A compositional naming system for mathematical concepts.**

*Math + morphemes — the smallest meaningful units of mathematical language.*

---

## The Problem

Mathematics is the only major science without a systematic naming convention. Biology has Linnaean taxonomy (1735). Chemistry has IUPAC nomenclature (1919). Medicine has WHO ICD. Mathematics has... eponyms and historical accidents.

"Hausdorff space" tells you nothing about what it is. "Point-separated space" tells you everything. Yet the former is standard and the latter is not. Multiply this by thousands of concepts, and you have a field where the naming tradition actively impedes understanding — functioning as a gatekeeping mechanism dressed as tradition.

## The Insight

Category theory — the most abstract branch of mathematics, the one most divorced from physical intuition — produced the most descriptive, semantically transparent vocabulary in all of mathematics: *pullback*, *pushforward*, *lifting*, *fiber*, *natural transformation*, *forgetful functor*.

This is not coincidence. Category theory's abstraction **forced** good naming, because no physical intuition existed to subsidize opaque terminology. The name was the only cognitive interface available. Meanwhile, fields with strong physical intuition (waves, heat, mechanics) could afford to stamp surnames on concepts because the physics did the explanatory work the names should have done.

If the most abstract field proved that descriptive naming scales to arbitrary abstraction, then every field that defaults to eponymous naming is leaving pedagogical value on the table — not because descriptive naming can't handle their subject, but because they never needed it badly enough to bother.

## The System

Mathemes is a compositional naming system with two registers:

**Formal register** — Neo-classical morphemes (Latin/Greek roots) that compose algorithmically, analogous to IUPAC nomenclature. Language-agnostic by design.

**Vernacular register** — Plain English descriptive names built from the same compositional principles. Maximally accessible.

Both registers are generated from the same underlying morpheme vocabulary and compositional grammar.

### Architecture

1. **Morpheme vocabulary** — A finite inventory of atomic meaningful units, organized by facet:
   - Structures (space, group, ring, field, algebra, category, manifold...)
   - Properties (complete, compact, connected, commutative, linear, bounded...)
   - Operations (transform, decompose, project, embed, lift, factor...)
   - Relations (dual, adjoint, conjugate, inverse, quotient, product...)
   - Qualifiers (finite, countable, local, global, uniform, pointwise...)
   - Domains (number, function, set, sequence, operator, measure...)

2. **Compositional grammar** — Rules for combining morphemes into concept names, including precedence, abbreviation, and context-dependent shortening.

3. **Curated extensions** — For concepts that resist clean decomposition (specific theorems, conjectures, constants), principled naming heuristics rather than algorithmic generation.

### Example Derivations

| Eponymous | Compositional Derivation | Formal Register | Vernacular Register |
|---|---|---|---|
| Hilbert space | complete + inner-product + space | — | complete inner-product space |
| Hausdorff space | point-separated + topological space | — | point-separated space |
| Fourier series | harmonic + frequency + expansion | — | frequency expansion |
| Jacobian | derivative + matrix (of a map) | — | derivative matrix |
| Laplace transform | exponential + half-line + frequency transform | — | exponential frequency transform |
| Noether's theorem | symmetry-conservation + correspondence | — | symmetry-conservation theorem |

## Interdisciplinary Foundations

This is not a lexicography project. It is a **cognitive engineering** project. The foundations draw on:

- **Linguistics** — Morphology, terminology science (ISO 704), semantic transparency
- **Cognitive science** — Cognitive load theory, semantic priming, dual coding, chunking
- **Cognitive psychology** — Expert blind spot, math anxiety, transfer of learning
- **Philosophy of language** — Rigid designators vs. definite descriptions (Kripke/Russell)
- **Information architecture** — Faceted classification (Ranganathan), ontology design
- **History of nomenclature** — IUPAC, Linnaeus, PhyloCode, DSM reform precedents

## Deliverables

| Artifact | Description | Status |
|---|---|---|
| **Paper** | The philosophical/pedagogical case, including the category theory paradox | Planned |
| **System Specification** | Morpheme vocabulary + compositional grammar + conventions | Planned |
| **Corpus** | 200+ concepts across 8 domains, dual-register names with derivations | Planned |
| **Living Reference** | Searchable, browsable, community-contributable reference | Future |

## Project Structure

```
mathemes/
├── README.md                          # This file
├── MANIFESTO.md                       # The accessible public case
├── research/                          # Interdisciplinary foundations
│   ├── 00-literature-review.md
│   ├── 01-category-theory-paradox.md
│   ├── 02-comparative-systems.md
│   ├── 03-cognitive-foundations.md
│   ├── 04-linguistic-foundations.md
│   ├── 05-philosophy-of-naming.md
│   ├── 06-pedagogical-evidence.md
│   └── 07-historical-naming.md
├── system/                            # The naming system specification
│   ├── 00-overview.md
│   ├── morphemes/                     # Atomic vocabulary by facet
│   ├── 01-grammar.md                  # Compositional rules
│   ├── 02-precedence.md               # Ordering within compound names
│   ├── 03-registers.md                # Formal + vernacular dual naming
│   ├── 04-conventions.md              # Abbreviation, context shortening
│   └── 05-edge-cases.md               # Theorems, conjectures, constants
├── corpus/                            # 200+ renamed concepts by domain
│   ├── algebra/
│   ├── analysis/
│   ├── topology/
│   ├── linear-algebra/
│   ├── calculus/
│   ├── probability/
│   ├── category-theory/               # The exemplar analysis
│   └── diff-geometry/
├── paper/                             # The publishable paper
└── assets/references/                 # Bibliography + source materials
```

## Prior Art

| Work | Year | Contribution | What It Lacks |
|---|---|---|---|
| Henwood & Rival, "Eponymy in Mathematical Nomenclature" | 1980 | First manifesto against eponyms | No system — just principles |
| Bourbaki, *Éléments de mathématique* | 1939–83 | Introduced injective/surjective/bijective | Incidental, not systematic |
| Steve White, "Better Terms for Mathematical Concepts" | 2019– | Exhaustive ad hoc rename catalog | No generative grammar |
| Marco Beretta, "Names as Rewards" | 2019 | Eponyms as credit/reward system (Nuncius) | Historical analysis only |
| Nautilus, "Why Mathematicians Should Stop..." | 2020 | Popular case against eponyms | No constructive alternative |

**What doesn't exist**: A compositional naming grammar for mathematics — one that can *generate* the right name from a concept's defining properties, the way IUPAC generates a name from molecular structure.

That's what Mathemes builds.

---

*Initiated May 2025.*
