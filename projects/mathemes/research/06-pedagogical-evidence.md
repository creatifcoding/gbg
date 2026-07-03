# Pedagogical Evidence

**Status**: Enriched research draft

---

## Thesis

Mathemes is a pedagogical intervention disguised as a naming system. Its claim is not that students should avoid standard terminology. Its claim is that **opaque terminology should not be the first interface to a concept**.

The evidence comes from three converging lines:

1. Cognitive science: labels affect categorization, attention, memory, and transfer.
2. Mathematics education: language is central to mathematical learning, not an accessory after the “real math.”
3. Universal Design for Learning: multiple representations and accessible pathways improve participation without lowering rigor.

Descriptive names reduce arbitrary memorization, expose structural relations, and support cross-domain transfer. Standard names remain necessary for reading the literature; Mathemes solves that with **dual-register pedagogy**: teach the transparent structural name first, then attach the standard alias.

---

## 1. Mathematics Learning Is Concept Learning

Lakoff and Núñez argue that the intellectual content of mathematics lies in human ideas, not merely in symbols or formal proof strings. Symbols are visible, but understanding depends on conceptual structures grounded in ordinary cognition, embodied experience, and metaphor. Their examples include number-as-points-on-a-line, Boolean operations as algebraic operations, symbolic logic as calculation, complex multiplication as rotation, and actual infinity as metaphorical completion of endless process. [Lakoff & Núñez 2000](file:///tmp/mathemes-txt/lakoff-nunez2000-preface-intro.md)

Their educational implication is direct: mathematics teaching should orient toward understanding what theorems **mean** and why they are true on the basis of that meaning. Names participate in that orientation. `Complete inner-product space` places the learner inside the conceptual structure. `Hilbert space` asks the learner to retrieve a historical lookup table before reasoning can begin.

Lupyan’s label-feedback hypothesis strengthens the point. Labels can modulate visual perception and categorization, improve category learning, and make diagnostic features more salient. In novel category-learning tasks, labels help learners form more stable and flexible categories even when the labels are not logically required. [Lupyan 2012](file:///tmp/mathemes-txt/lupyan2012-linguistically-modulated-perception.md)

**Pedagogical claim:** if labels shape category learning in ordinary cognition, mathematical labels should be treated as instructional design. Names can reveal the category basis or hide it behind a password.

---

## 2. The Vocabulary Barrier Is Structural

Mathematics education research no longer treats language as a minor vocabulary issue. Erath, Ingram, Moschkovich, and Prediger review four decades of work and state a broad consensus: enhancing language is crucial for mathematics learning. They distinguish lexical, syntactic, and discursive dimensions, and emphasize that mathematics learning involves discourse practices such as explaining, justifying, arguing, defining, and generalizing. [Erath et al. 2021](https://link.springer.com/article/10.1007/s11858-020-01213-2)

Opaque names create barriers on all three dimensions:

| Dimension | Opaque-name barrier | Descriptive-name affordance |
|---|---|---|
| Lexical | `Hausdorff`, `Noetherian`, `Banach` must be memorized as arbitrary labels. | `point-separated`, `ascending-chain-condition`, `complete normed` expose meaning-bearing words. |
| Syntactic | Relations among modifiers are hidden or historical. | Modifier-head structure shows object type and constraints. |
| Discursive | Students can only recite. | Students can parse, compare, justify, and test against examples. |

A vocabulary list is not enough. Erath et al. warn that language-responsive instruction must not be restricted to vocabulary work; it must engage rich discourse and connect language varieties with mathematical representations. Mathemes should therefore be embedded in tasks where students **use** names to explain structure.

---

## 3. Cross-Domain Transfer: Opaque Names Hide Structure

Transfer fails when learners do not recognize that two situations share structure. Names are strong surface cues. When the same structure has unrelated names across domains, the learner must solve an unnecessary matching problem before doing mathematics.

### 3.1 Hilbert vs. Banach

Standard names:

- `Banach space`
- `Hilbert space`

Structural names:

- `complete normed vector space`
- `complete inner-product vector space`

The descriptive pair reveals the hierarchy. Every inner product induces a norm; therefore a complete inner-product vector space is a special kind of complete normed vector space. The eponymic pair hides the relationship. The learner must retrieve:

```text
Banach -> complete normed
Hilbert -> complete inner-product
inner product -> norm
therefore Hilbert -> Banach
```

Mathemes collapses the retrieval chain into the name.

### 3.2 Separation axioms

Topology mixes symbols, eponyms, and overloaded adjectives:

| Standard | Structural cue |
|---|---|
| T0 | distinguishable-points space |
| T1 | closed-points space |
| Hausdorff / T2 | disjoint-neighborhood point-separated space |
| regular | point-and-closed-set neighborhood-separated space |
| Tychonoff | point-and-closed-set function-separated space |
| normal | disjoint-closed-sets neighborhood-separated space |

The descriptive set shows the conceptual ladder: the objects being separated change, and the separating witnesses change. The standard names scatter the ladder across a shed.

### 3.3 Fourier, spectral, harmonic

Across signal processing, physics, PDEs, and pure mathematics, related ideas are named differently:

| Domain | Common name | Structural family |
|---|---|---|
| Signal processing | Fourier transform | frequency-decomposition transform |
| Quantum mechanics | spectral decomposition | eigenmode / observable-value decomposition |
| Harmonic analysis | harmonic decomposition | character / frequency decomposition |
| PDEs | eigenfunction expansion | operator-mode decomposition |

The expert sees the family resemblance. The novice sees unrelated doors. A descriptive alias such as `frequency-mode decomposition` or `eigenmode decomposition` makes transfer possible without erasing domain terms.

### 3.4 Hermitian, symmetric, self-adjoint

Physics often says `Hermitian operator` for observables. Mathematics distinguishes `symmetric` from `self-adjoint`, especially for unbounded operators. Descriptive names help separate:

- `adjoint-equal operator` for self-adjointness;
- `inner-product-symmetric operator` for symmetry on a domain;
- `conjugate-transpose-equal matrix` for finite-dimensional Hermitian matrices.

The point is not to make speech unbearable. The point is to expose hidden distinctions during learning.

---

## 4. Universal Design for Learning: Names as Access Features

CAST’s Universal Design for Learning framework emphasizes multiple means of engagement, representation, and action/expression so learners can access meaningful, challenging learning opportunities. The goal is learner agency: purposeful and reflective, resourceful and authentic, strategic and action-oriented. [CAST UDL Guidelines](https://udlguidelines.cast.org/)

Descriptive naming supports all three principles.

### 4.1 Multiple means of representation

A descriptive name is a representation. It links language to structure.

```text
Hausdorff space
```

is opaque.

```text
distinct-points-disjoint-neighborhoods space
```

represents a relation among points and neighborhoods. It complements diagrams and formal quantifiers.

### 4.2 Multiple means of engagement

Opaque terms can make mathematics feel like a private club with inherited passwords. Descriptive names invite prediction:

- What does an `order-preserving map` preserve?
- What might a `measure-preserving transformation` do?
- Why would a `conjugation-invariant subgroup` support quotient groups?

This does not make the mathematics trivial. It makes entry possible.

### 4.3 Multiple means of action and expression

Students should express understanding in both registers:

```text
A Hausdorff space is a point-separated topological space: any two distinct points have disjoint neighborhoods.
```

This sentence demonstrates literature fluency and structural understanding. “Hausdorff means T2” is only a synonym chain.

---

## 5. Language-Responsive Instruction: Mathemes as a Design Tool

Erath et al. identify six design principles for instruction that enhances language for mathematics learning:

1. Engage students in rich discourse practices.
2. Establish mathematics language routines.
3. Connect language varieties and multimodal representations.
4. Include students’ multilingual resources.
5. Use macro-scaffolding to sequence language and mathematics learning.
6. Compare language pieces to raise language awareness. [Erath et al. 2021](https://link.springer.com/article/10.1007/s11858-020-01213-2)

Mathemes fits these principles if used correctly.

### 5.1 Rich discourse, not vocabulary substitution

Bad use:

```text
Memorize: Hausdorff = point-separated.
```

Good use:

```text
Compare three spaces. For each pair of distinct points, can you find disjoint neighborhoods? Explain why the name point-separated fits or fails.
```

The second task uses the name as a reasoning prompt.

### 5.2 Language routine

A Mathemes routine:

1. **Parse the name** — head, modifiers, relation words.
2. **Predict the definition** — what must be true if the name is honest?
3. **Test examples/non-examples**.
4. **Map to standard alias**.
5. **Use both registers in a proof sentence**.

Example:

```text
Name: ascending-chain-condition ring
Prediction: increasing chains of ideals eventually stop.
Alias: Noetherian ring.
Proof sentence: Since R is Noetherian, every ascending chain of ideals stabilizes.
```

### 5.3 Connecting representations

For `complete normed vector space`, connect the name to metric diagrams of Cauchy sequences, algebraic vector operations, norm balls, formal quantifiers, and the alias `Banach space`. The name is one representation among many, not a replacement.

### 5.4 Raising language awareness

Compare overloaded terms:

```text
normal subgroup          -> conjugation-invariant subgroup
normal vector            -> perpendicular vector
normal operator          -> adjoint-commuting operator
normal distribution      -> Gaussian bell distribution
normal topological space -> disjoint-closed-sets separable space
```

This reveals that `normal` is not one mathematical idea. It is an overloaded historical adjective. Awareness prevents false transfer.

---

## 6. Specific Pedagogical Benefits

### 6.1 Reduced extraneous load

Opaque terms force arbitrary mappings:

```text
Hilbert -> complete inner-product space
Noetherian -> ascending chain condition
Hausdorff -> disjoint neighborhoods for distinct points
```

Working memory spent retrieving mappings is not spent reasoning. Descriptive names convert some of that load into germane load: concept structure, not password management.

### 6.2 Error detection

Descriptive names expose contradictions:

- “A non-complete complete-normed space” sounds wrong.
- “A point-separated space where distinct points cannot be separated” sounds wrong.
- “A conjugation-invariant subgroup not closed under conjugation” sounds wrong.

With `Banach`, `Hausdorff`, and `normal`, the contradiction is hidden until the mapping is retrieved.

### 6.3 Hierarchy recognition

```text
complete inner-product vector space
complete normed vector space
normed vector space
metric space
```

The learner sees which modifiers add structure and which properties follow.

### 6.4 Self-study and multilingual access

A self-learner reading “Noetherian ring” must stop and search. A self-learner reading “ideal-ascending-chain ring” can make an anchored guess before searching. This especially helps students outside the oral tradition of mathematics: multilingual students, first-generation students, autodidacts, and students from under-resourced institutions.

This aligns with language-as-resource approaches, where students’ existing language repertoires are resources for mathematical meaning-making. [Erath et al. 2021](https://link.springer.com/article/10.1007/s11858-020-01213-2)

---

## 7. Counterargument: Students Must Learn Standard Terminology

Correct. Students must learn standard terminology to read papers, attend lectures, pass exams, search databases, and join mathematical communities.

But standard terminology need not be the first or only interface.

### 7.1 Dual-register pedagogy

Teach in this order:

1. **Experience / examples** — see the structure.
2. **Descriptive name** — name it transparently.
3. **Formal definition** — state precise conditions.
4. **Standard alias** — attach the literature term.
5. **Register switching** — translate both ways.

Example:

```text
Concept: complete normed vector space
Formal: a normed vector space complete under the metric induced by its norm
Standard alias: Banach space
Usage: “Let X be a Banach space, i.e. a complete normed vector space.”
```

This does not shelter students from literature. It gives them a bridge into it.

### 7.2 Fade the scaffold

Early:

```text
A complete normed vector space (Banach space) ...
```

Later:

```text
A Banach space (complete normed vector space) ...
```

Eventually, use the expert term alone when the mapping is automated. The scaffold disappears after doing its job. Very civilized.

### 7.3 Preserve searchability

Every Mathemes entry should include standard term, descriptive name, formal definition, aliases, historical notes, field variants, examples, and non-examples. That makes students better at reading literature, not worse.

---

## 8. Risks and Constraints

1. **Long names can burden use.** Use full descriptive names at introduction, shorter local aliases after definition, and expert aliases when appropriate.
2. **Names can overpromise.** `Point-separated space` is useful, but exact quantifiers still matter. Always pair names with formal definitions.
3. **Some concepts resist compact description.** Universal properties, derived functors, schemes, stacks, and spectra may need multi-part descriptions. Expose the central structural role; do not force monster names.
4. **Existing terms carry culture.** `Noetherian`, `Galois`, and `Fourier` preserve history. Mathemes should separate historical credit from first-contact comprehension, not erase it.

---

## Design Implications

1. Use descriptive names as first-contact scaffolds.
2. Attach standard aliases early and explicitly.
3. Require bidirectional translation: `Hilbert space -> complete inner-product space` and back.
4. Use names in discourse tasks, not vocabulary lists.
5. Expose hierarchy and transfer through modifier structure.
6. Flag overloaded words with domain-specific aliases.
7. Fade scaffolds as expertise develops.
8. Treat naming as UDL representation: improve access without lowering rigor.

---

## Key Sources

- Lakoff, G. & Núñez, R. (2000). *Where Mathematics Comes From*, preface and introduction. `file:///tmp/mathemes-txt/lakoff-nunez2000-preface-intro.md`
- Lupyan, G. (2012). “Linguistically modulated perception and cognition.” `file:///tmp/mathemes-txt/lupyan2012-linguistically-modulated-perception.md`
- Erath, K., Ingram, J., Moschkovich, J., & Prediger, S. (2021). “Designing and enacting instruction that enhances language for mathematics learning.” *ZDM Mathematics Education*, 53, 245–262. <https://doi.org/10.1007/s11858-020-01213-2>
- CAST. *Universal Design for Learning Guidelines 3.0*. <https://udlguidelines.cast.org/>
- Gick, M. L. & Holyoak, K. J. (1983). “Schema induction and analogical transfer.” *Cognitive Psychology*, 15, 1–38.
