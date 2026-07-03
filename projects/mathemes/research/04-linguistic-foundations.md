# Linguistic & Terminological Foundations

**Status**: Enriched research draft

---

## Thesis

Mathemes is a **controlled compositional language** for mathematical concepts: a morphology, a semantics, and a set of register-shifting rules that let a learner move from transparent description to expert shorthand without losing structure. Names are not decoration. They are cognitive handles.

The linguistic evidence is careful rather than magical: language does not imprison thought, but labels can guide attention, modulate perception, support categorization, and make some distinctions easier to keep active. For mathematics — already abstract, symbolic, and heavily metaphorical — terminology is part of the interface through which concepts are learned.

---

## 1. Language Shapes Mathematical Cognition — Carefully

Wolff and Holmes reject hard linguistic determinism but retain several empirically supported weaker mechanisms. Language can act as a **meddler** by inserting linguistic codes into nonlinguistic judgments, an **augmenter** by enabling representations that are difficult without language, a **spotlight** by making certain properties habitually salient, and an **inducer** by pushing cognition toward schematic processing. Their review covers color, motion, space, number, false-belief reasoning, and relational analogy. The conclusion: language may not close conceptual doors, but it can fling some open and build others. [Wolff & Holmes 2011](https://www.reed.edu/psychology/thought-lab/assets/publications/Wolff%20_%20Holmes%202011%20-%20WIREs%20Cognitive%20Science.pdf)

Lupyan’s label-feedback hypothesis gives a mechanism: labels are not merely post-hoc tags. Hearing or activating a label can modulate visual discrimination, category learning, memory, and feature attention; verbal interference can reduce such effects. Labels participate in cognition online. [Lupyan 2012](file:///tmp/mathemes-txt/lupyan2012-linguistically-modulated-perception.md)

Lakoff and Núñez make the mathematical version explicit. Mathematical ideas are not exhausted by symbols and formal proofs; they are human concepts structured by embodied cognition and conceptual metaphor — number lines, class algebra, symbolic logic as calculation, complex multiplication as rotation, and actual infinity as metaphorical completion. [Lakoff & Núñez 2000](file:///tmp/mathemes-txt/lakoff-nunez2000-preface-intro.md)

**Mathemes consequence:** a name should do at least one of three things:

1. **Index structure** — expose defining relations.
2. **Cue transfer** — align parallel ideas across domains.
3. **Stabilize metaphor** — use consistent spatial, operational, or relational metaphors.

Prime, a name is a tiny interface. If the interface lies, overloads, or hides affordances, the learner pays interest forever.

---

## 2. Morphological Typology: Which Strategy Fits Mathematics?

Morphology studies how meaningful units combine. Linguists often distinguish analytic, agglutinative, fusional, and polysynthetic patterns. These are prototypes, not rigid boxes, but they are excellent design options.

| Type | Pattern | Mathematical analogue | Mathemes verdict |
|---|---|---|---|
| **Analytic / isolating** | Low morphemes per word; relations expressed by separate words and order. | `complete inner product space`; `left adjoint functor` | Best for vernacular teaching. |
| **Agglutinative** | Morphemes stack with clear boundaries and stable meanings. | `point-separated-topological-space`; IUPAC names | Best for formal precision and machine parsing. |
| **Fusional** | One affix encodes multiple features; boundaries blur. | `endomorphism`, `idempotent`, `homology` | Useful historically, opaque for novices. |
| **Polysynthetic** | Very high morpheme-to-word ratio; sentence-like words. | `complete-separable-infinite-dimensional-complex-inner-product-space` | Too dense except as formal encoding. |

Ramoo’s morphology overview defines analytic languages as using independent morphemes, agglutinative languages as combining identifiable morphemes, fusional languages as fusing features into one form, and polysynthetic languages as forming high-morpheme words equivalent to whole sentences. [Ramoo, §3.3](https://psychologyoflanguage.pressbooks.tru.ca/chapter/morphology-of-different-languages/)

### Mathemes choice

Mathemes should be **analytic in the learning register** and **agglutinative in the formal register**:

```text
Learning register: complete inner-product space
Formal register: complete-inner-product-space / Space[Vector, InnerProduct, Complete]
Expert alias: Hilbert space
```

Human learners need readable phrases. Machines and catalogs need canonical morpheme boundaries. Experts need short handles. One surface form cannot optimize all three.

---

## 3. Category Theory as Evidence of Deliberate Naming

Eilenberg and Mac Lane’s 1945 *General Theory of Natural Equivalences* is primary evidence for mathematical terminology as deliberate design. Their motivating example is the finite-dimensional vector space `L` and its double conjugate `T(T(L))`. The isomorphism `L ≅ T(T(L))` is available without choosing a basis; it is “natural” because it is given **simultaneously for all vector spaces and all linear transformations between them**. They formalize this with a diagrammatic naturality condition. [Eilenberg & Mac Lane 1945](file:///tmp/mathemes-txt/eilenberg-maclane1945-natural-equivalences.md)

Their vocabulary is not accidental:

- **Natural** = choice-free, basis-independent, compatible with maps.
- **Transformation** = componentwise comparison between functors.
- **Functor** = a paired operation on objects and mappings.
- **Category** = objects plus mappings, abstracting groups, spaces, vector spaces, ordered sets, and complexes.
- **Covariant / contravariant** = preserving or reversing mapping direction.
- **Equivalence**, **identity**, **domain**, **range**, **composition** = names chosen around mapping behavior.

They also justify the theory conceptually: it supplies notions applicable across abstract mathematics, compares constructions across fields, and continues the Klein Erlangen Program by replacing “a space with its transformation group” with “a category with its algebra of mappings.” That is exactly the Mathemes mission: terminology as architecture for transfer.

### Category-theoretic morphemes already behave like Mathemes

| Term | Morpheme parse | Cognitive payload |
|---|---|---|
| **pullback** | pull + back | Reverse-motion metaphor: transport structure backward along a map. |
| **pushforward** | push + forward | Forward-motion metaphor: transport data along a map. |
| **forgetful functor** | forget + ful | Information-loss metaphor: preserve underlying object, discard structure. |
| **natural transformation** | natural + transformation | Choice-free, diagram-compatible family of maps. |
| **universal property** | universal + property | Unique mediation from/to all relevant objects. |
| **fiber / base / lifting** | spatial-motion family | Coherent spatial metaphor for bundles, covers, projections. |

These terms work because their metaphors are systematic. Pull/push/lift/fiber/base belong to a spatial-action domain; natural/universal belong to invariance and generality; forgetful belongs to information loss. Mathemes should extend productive metaphor families rather than replacing them with sterile bureaucratese. Clarity, not taxonomic cosplay.

---

## 4. IUPAC as the Agglutinative Benchmark

Chemistry solved a version of this problem earlier. IUPAC nomenclature uses stable morphemes, canonical ordering, locants, stems, prefixes, and suffixes to encode structure:

- `meth-yl` = one-carbon substituent.
- `prop-an-ol` = three-carbon saturated chain with alcohol group.
- `2-methylpropan-1-ol` = propan-1-ol parent with a methyl substituent at position 2.

The IUPAC Blue Book states the pressure directly: older chemists did not always need unique names, but the information explosion made unambiguous systematic names increasingly important. IUPAC also notes that preferred systematic names must retain recognition value and acceptance among chemists. [IUPAC Blue Book](https://iupac.org/what-we-do/books/bluebook/)

Mathemes should borrow the principles, not the surface style:

1. **Canonical order** for modifiers.
2. **Stable morphemes** with one primary technical function per register.
3. **Locants / indices** for arity, direction, variance, dimension, or position.
4. **Parent-head structure**: the head gives the object kind; modifiers constrain it.
5. **Preferred names plus aliases**: one systematic name, many accepted synonyms.

Mathematics differs from chemistry: concepts are often relational, axiomatic, and context-dependent, not just graph-like physical structures. So Mathemes needs a dual grammar:

```text
Readable phrase: complete inner-product vector space
Typed schema: Space[Vector, InnerProduct, Complete]
Historical alias: Hilbert space
```

---

## 5. Polysemy: The “Normal” Problem

Mathematics tolerates astonishing polysemy. The same adjective is reused across fields until it becomes a family of passwords. `Normal` is the mascot — a linguistic goblin wearing seven departmental badges.

The nLab disambiguation page lists `normal`/`normalization` across linear algebra, category theory, group theory, topology, algebraic geometry, formal logic, and operator algebra. Examples include normal vector, normal bundle, normal subobject, normal subgroup, normalizer, normal topological space, normal variety, normal form, and normal operator. [nLab: normalization](http://nlab.mathforge.org/nlab/show/normal)

Polysemy is not always bad. Experts reuse words because they gesture at loose family resemblances: perpendicular-to, canonical, invariant, well-behaved, rule-like. But the learner pays the cost when `normal` means unrelated things in different neighborhoods.

Mathemes should classify overloaded terms:

1. **Benign polysemy** — same metaphor, compatible structure (`dual` often marks reversal/pairing).
2. **Contextual polysemy** — different meanings recoverable from field (`regular`, `proper`).
3. **Dangerous polysemy** — structurally unrelated meanings (`normal distribution`, `normal subgroup`, `normal topological space`).

For dangerous polysemy, provide domain-qualified aliases:

| Standard term | Descriptive alias |
|---|---|
| normal subgroup | conjugation-invariant subgroup |
| normal topological space | disjoint-closed-sets neighborhood-separable space |
| normal vector | perpendicular vector |
| normal operator | adjoint-commuting operator |
| normal distribution | Gaussian bell distribution / Gaussian law |
| normal form | canonical rewrite form |

The alias need not replace expert usage. It exposes structure on first contact.

---

## 6. Morpheme Design Rules for Mathemes

### 6.1 Head-last by default

English mathematical names should place the head last:

- `complete inner-product space` is a kind of **space**.
- `conjugation-invariant subgroup` is a kind of **subgroup**.
- `measure-preserving transformation` is a kind of **transformation**.

The head controls type; modifiers constrain it.

### 6.2 Modifier order should be canonical

Recommended order:

1. size / finiteness / dimension;
2. base domain;
3. structure;
4. operations / relations;
5. properties;
6. head.

Thus `separable complete complex inner-product vector space` is parseable; random modifier soup is not.

### 6.3 Prefer relational morphemes over evaluative adjectives

Weak: `normal`, `nice`, `good`, `regular`, `proper`, `simple`.

Stronger: `conjugation-invariant`, `adjoint-commuting`, `closed-set-separating`, `finite-kernel`, `identity-preserving`, `order-reflecting`.

### 6.4 Use systematic metaphor domains

Following Lakoff and Núñez, metaphor is not contamination; it is part of abstract understanding. But it must be disciplined.

| Domain | Use for | Examples |
|---|---|---|
| Spatial | structure/topology | space, boundary, fiber, base |
| Motion | maps/operations | push, pull, lift, project |
| Vision | representation | visible, observable, transparent |
| Algebraic balance | invariance | preserve, commute, cancel, invert |
| Construction | universal definitions | generate, freely, complete, quotient |

### 6.5 Preserve expert aliases but attach transparent expansions

```text
Hilbert space
= complete inner-product vector space
= Space[Vector, InnerProduct, Complete]
```

The historical name remains usable; the structural name becomes searchable, teachable, and transferable.

---

## Design Implications

1. **Dual morphology:** analytic phrases for learners; agglutinative schemas for precision.
2. **Controlled morpheme inventory:** each morpheme gets a canonical role.
3. **Category theory as precedent:** Eilenberg and Mac Lane show names can encode invariance, direction, and comparison.
4. **Borrow from IUPAC cautiously:** canonical composition and preferred names are useful; maximal chemical-style names are not always humane.
5. **Treat polysemy as technical debt:** overloaded words need domain-qualified transparent aliases.
6. **Stabilize metaphor families:** pull/push/lift/fiber systems are assets when coherent.
7. **Support register switching:** standard name, descriptive name, and formal schema must map cleanly.

---

## Key Sources

- Eilenberg, S. & Mac Lane, S. (1945). *General Theory of Natural Equivalences*. `file:///tmp/mathemes-txt/eilenberg-maclane1945-natural-equivalences.md`
- Lakoff, G. & Núñez, R. (2000). *Where Mathematics Comes From*, preface and introduction. `file:///tmp/mathemes-txt/lakoff-nunez2000-preface-intro.md`
- Lupyan, G. (2012). “Linguistically modulated perception and cognition.” `file:///tmp/mathemes-txt/lupyan2012-linguistically-modulated-perception.md`
- Wolff, P. & Holmes, K. J. (2011). “Linguistic relativity.” <https://doi.org/10.1002/wcs.104>
- IUPAC. *Nomenclature of Organic Chemistry: IUPAC Recommendations and Preferred Names 2013*. <https://iupac.org/what-we-do/books/bluebook/>
- Ramoo, D. “Morphology of Different Languages.” <https://psychologyoflanguage.pressbooks.tru.ca/chapter/morphology-of-different-languages/>
