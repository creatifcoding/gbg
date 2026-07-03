# Morpheme Inventory — Structures

**Facet**: Structure (head nouns — what kind of mathematical object)
**Metaphor domain**: Spatial/architectural
**Count**: 35

---

These are the **head nouns** of compound names. Every mathematical name ends with one of these (or a compound of these). They answer: "what kind of thing is this?"

## Algebraic Structures

### space
- **Meaning**: A set with structure (topological, metric, vector, etc.)
- **Etymology**: Latin *spatium* — extent, room, area
- **Transparency**: ✅ Universally understood spatial metaphor
- **Polysemy**: ⚠️ Very broad — always qualified by property morphemes. "Space" alone is not a complete name.
- **Composes with**: [complete, compact, connected, normed, metric, inner-product, topological, measurable, ...] + space
- **Examples**: complete inner-product space, point-separated space, locally-compact space

### group
- **Meaning**: A set with an associative binary operation, identity element, and inverses
- **Etymology**: French *groupe* (Galois, 1830s) — colloquial "collection, cluster"
- **Transparency**: ⚠️ Semi — the word is vernacular but doesn't specifically suggest algebraic structure
- **Polysemy**: 🟢 Mathematical meaning is dominant in context
- **Composes with**: [commutative, finite, cyclic, free, solvable, simple, ...] + group
- **Examples**: commutative group, finite cyclic group, free group

### ring
- **Meaning**: A set with addition (commutative group) and multiplication (associative, distributive)
- **Etymology**: German *Zahlring* (Hilbert, 1897) — "number ring," ring as in "association"
- **Transparency**: ⚠️ Semi — metaphor of cyclical return (modular arithmetic) is loose
- **Polysemy**: 🟢 Mathematical meaning is dominant in context
- **Composes with**: [commutative, integral, local, polynomial, ...] + ring
- **Examples**: commutative ring, local ring, polynomial ring

### field
- **Meaning**: A commutative ring where every nonzero element has a multiplicative inverse
- **Etymology**: English translation of German *Körper* (Dedekind) — "body"; Moore (1893) chose "field"
- **Transparency**: ❌ "Field" suggests agriculture or physics vector fields, not algebraic closure under division
- **Polysemy**: ⚠️ Conflicts with "vector field," "field of study." Mathematical meaning is opaque.
- **Notes**: This is a hard case. "Field" is entrenched but genuinely misleading. Dedekind's *Körper* (body) was arguably better — a self-contained body of arithmetic. Candidate replacements: "arithmetic" (White's suggestion), "division-ring" (too narrow — misses commutativity). For now, retained with a polysemy warning.
- **Composes with**: [finite, algebraically-closed, ordered, ...] + field

### algebra
- **Meaning**: A vector space with a bilinear product
- **Etymology**: Arabic *al-jabr* — "reunion of broken parts" (al-Khwarizmi, 820 CE)
- **Transparency**: ⚠️ Semi — the word is ancient and well-known but doesn't describe the structure
- **Polysemy**: ⚠️ "Algebra" as a field of study vs. "an algebra" as a specific structure
- **Composes with**: [Lie → tangential, Boolean → binary-logic, Clifford → geometric, ...] + algebra

### module
- **Meaning**: A generalization of a vector space where scalars come from a ring instead of a field
- **Etymology**: Latin *modulus* — "small measure"
- **Transparency**: ⚠️ Semi — suggests measurement/proportion, which is loose
- **Composes with**: [free, finitely-generated, projective, injective, flat, ...] + module

### lattice
- **Meaning**: A partially ordered set where every pair has a least upper bound and greatest lower bound
- **Etymology**: Old French *lattis* — crossed strips forming a grid
- **Transparency**: ✅ The grid/crosshatch metaphor maps well to the order structure
- **Composes with**: [complete, distributive, modular, Boolean, ...] + lattice

### monoid
- **Meaning**: A set with an associative binary operation and identity element (group without inverses)
- **Etymology**: Greek *monos* (single) + *eidos* (form) — coined by Bourbaki
- **Transparency**: ⚠️ Semi — requires Greek to decompose
- **Composes with**: [commutative, free, cancellative, ...] + monoid

### semigroup
- **Meaning**: A set with an associative binary operation (monoid without identity)
- **Etymology**: Latin *semi* (half) + French *groupe* — "half-group"
- **Transparency**: ⚠️ Misleading — it's not "half" a group in any precise sense
- **Notes**: White suggests "bunch." Mathemes could use "associative-set" for full systematic name.

## Topological/Geometric Structures

### manifold
- **Meaning**: A topological space locally resembling Euclidean space
- **Etymology**: German *Mannigfaltigkeit* (Riemann) — "manifoldness, multiplicity"
- **Transparency**: ⚠️ Semi — suggests multiplicity/variety, which is loose
- **Composes with**: [smooth, Riemannian → curved-metric, compact, oriented, ...] + manifold

### bundle
- **Meaning**: A space that locally looks like a product of two spaces
- **Etymology**: Middle English *bundel* — things bound together
- **Transparency**: ✅ The metaphor of things bundled over a base space works well
- **Composes with**: [fiber, vector, principal, tangent, cotangent, ...] + bundle

### sheaf
- **Meaning**: A tool for tracking locally defined data on a topological space
- **Etymology**: Old English *scēaf* — a bundle of stalks
- **Transparency**: ✅ The agricultural metaphor (stalks over a base) maps to fibers over a space
- **Composes with**: [coherent, locally-free, flasque → soft, ...] + sheaf

### complex
- **Meaning**: A sequence of algebraic objects connected by maps (chain complex, simplicial complex)
- **Etymology**: Latin *complexus* — "entwined, embraced"
- **Transparency**: ⚠️ Conflicts with "complex number." In the chain-complex sense, the word is reasonably transparent (things woven together).
- **Polysemy**: ⚠️ Complex number vs. chain complex vs. simplicial complex. Different structures entirely.

## Analytic Structures

### function
- **Meaning**: A rule assigning each element of one set to exactly one element of another
- **Etymology**: Latin *functio* — "performance, execution"
- **Transparency**: ✅ Well-established, universally understood in mathematical context

### map / mapping
- **Meaning**: Synonym of function, preferred in algebra and topology for structure-preserving functions
- **Etymology**: Latin *mappa* — cloth, chart
- **Transparency**: ✅ Spatial metaphor of one territory mapped onto another

### transform
- **Meaning**: A function that changes the representation of an object (Fourier, Laplace, etc.)
- **Etymology**: Latin *transformare* — "change shape"
- **Transparency**: ✅ Clearly suggests shape-changing

### series
- **Meaning**: A sum of a sequence of terms
- **Etymology**: Latin *series* — "row, chain, sequence"
- **Transparency**: ✅ Suggests ordered succession

### sequence
- **Meaning**: An ordered list of elements
- **Etymology**: Latin *sequentia* — "that which follows"
- **Transparency**: ✅

### operator
- **Meaning**: A function from a space to itself (or between function spaces)
- **Etymology**: Latin *operari* — "to work, to perform"
- **Transparency**: ✅ Suggests something that acts/works on inputs

### distribution
- **Meaning**: (Analysis) A generalized function. (Probability) A measure on outcomes.
- **Etymology**: Latin *distribuere* — "divide, scatter"
- **Transparency**: ✅ for probability; ⚠️ for analysis (generalized function is clearer)
- **Polysemy**: ⚠️ Analysis vs. probability senses are genuinely different concepts

### measure
- **Meaning**: A function assigning sizes to sets (Lebesgue, Haar, etc.)
- **Etymology**: Latin *mensura* — "measurement"
- **Transparency**: ✅

## Category-Theoretic Structures

### category
- **Meaning**: A collection of objects and morphisms (arrows) between them
- **Etymology**: Greek *kategoria* (Aristotle) — "accusation, predication, classification"
- **Transparency**: ⚠️ Semi — borrowed from philosophy, doesn't describe the mathematical structure
- **Notes**: Retained despite semi-transparency because it's the foundational term of an entire branch

### functor
- **Meaning**: A structure-preserving map between categories
- **Etymology**: Latin *functor* — "performer" (borrowed from Carnap's *Logische Syntax*)
- **Transparency**: ⚠️ Semi — suggests "something that functions" but doesn't specify structure-preservation
- **Notes**: Eilenberg & Mac Lane deliberately chose this. Retained.

### morphism
- **Meaning**: A structure-preserving map (in category theory, an arrow between objects)
- **Etymology**: Greek *morphe* — "form, shape" + *-ism*
- **Transparency**: ✅ "Form-preserving" is recoverable from the Greek

### topos
- **Meaning**: A category that behaves like a universe of sets (with internal logic)
- **Etymology**: Greek *topos* — "place"
- **Transparency**: ✅ The spatial metaphor is precise — a "place" where mathematics happens

## Logical/Set-Theoretic

### set
- **Meaning**: A collection of distinct objects
- **Etymology**: Old English *settan* — "to place"
- **Transparency**: ✅

### class
- **Meaning**: A collection that may be too large to be a set
- **Etymology**: Latin *classis* — "division, group"
- **Transparency**: ✅

### type
- **Meaning**: A classification of terms in a formal system
- **Etymology**: Greek *typos* — "impression, model"
- **Transparency**: ✅

---

**Total**: 35 structure morphemes.

*Next: Properties facet (the largest — 50-70 morphemes with polysemy analysis).*
