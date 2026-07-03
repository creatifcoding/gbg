# Historical Analysis of Mathematical Naming

**Status**: Draft — traces how mathematical eponymy arose, calcified, and where it has been resisted.

---

## Thesis

Mathematical eponymy is not a natural law. It is a cultural practice with a traceable origin, specific propagation mechanisms, and historical contingency. Understanding how it arose reveals the pressure points where reform is possible.

---

## 1. The Priority Wars (17th–19th Century)

### 1.1 The Newton-Leibniz Dispute

The archetype of mathematical priority conflict. Newton and Leibniz independently developed calculus in the late 17th century. The ensuing dispute — which consumed decades, split European mathematics along national lines, and involved accusations of plagiarism — established a template: **mathematical reputation depends on being recognized as the first discoverer**.

The naming consequences were immediate. British mathematics used Newtonian notation (dots, fluxions) while Continental mathematics used Leibnizian notation (dy/dx, integrals). The notation carried the credit. British mathematics stagnated for a century partly because loyalty to Newton's notation impeded adoption of the more powerful Leibnizian framework.

Lesson: **naming as credit-locking has direct intellectual costs**. When names carry factional allegiance, they impede the free flow of ideas.

### 1.2 The Bernoulli Dynasty

The Bernoulli family (Jakob, Johann, Daniel, and others) produced at least eight mathematicians across three generations. The internal competition was fierce. Johann Bernoulli attempted to publish his son Daniel's work under his own name. Jakob and Johann engaged in public disputes over the brachistochrone problem.

The proliferation of "Bernoulli" in mathematical terminology (Bernoulli numbers, Bernoulli distribution, Bernoulli equation, Bernoulli process, Bernoulli trial, Bernoulli's principle) makes the eponym practically useless as a reference — which Bernoulli? Which result? The name disambiguates nothing. It's pure credit-stamping.

### 1.3 Gauss and the Suppression Strategy

Gauss famously withheld results for years, then claimed priority when others published. His strategy was the opposite of hasty naming: he suppressed publication until the result was polished to his satisfaction, then relied on his towering reputation to ensure credit. The result: "Gaussian" is attached to an extraordinary range of concepts (Gaussian elimination, Gaussian integers, Gaussian curvature, Gaussian distribution, Gaussian quadrature), many of which were known before Gauss or independently discovered by others.

The "Gaussian distribution" is the most famous case — de Moivre described it first, but Gauss's prestige overwhelmed de Moivre's priority. This is Stigler's Law made concrete: the name follows fame, not discovery.

## 2. The Textbook Calcification Mechanism

### 2.1 How Names Stick

Mathematical names calcify through a specific mechanism:

1. **Originator or contemporary uses eponym in a paper**: "I extend Hilbert's method..."
2. **Graduate students learn the name from their advisor**: oral tradition transmits name→concept mappings
3. **Textbook authors inherit the name**: they cite prior textbooks, perpetuating the term
4. **Each new textbook reinforces the name**: switching costs increase with each generation
5. **The name becomes "standard"**: any deviation is marked as non-standard, eccentric, or confusing

This is Kripke's causal chain in action: the name propagates through a chain of speakers, each inheriting it from the previous. Breaking the chain requires not just a better name but a coordinated switch across multiple textbooks simultaneously.

### 2.2 The Switching Cost Problem

By the time a name is entrenched:
- Every existing textbook uses it
- Every existing paper references it
- Every search index catalogs it
- Every mathematician's memory stores it

The cost of switching is borne collectively (everyone must learn the new name), while the benefit accrues individually (each new learner saves time). This is a classic collective action problem — rational for no individual to switch, despite being rational for the community as a whole.

IUPAC solved this problem through institutional mandate (the Union sets the standard) and dual naming (old names persist as acceptable alternatives). Mathematics lacks the institutional mechanism.

## 3. Where Descriptive Naming Won

Despite the general dominance of eponymy, there are domains where descriptive naming prevailed. Understanding WHY they succeeded is critical for Mathemes.

### 3.1 Basic Topology

The foundational vocabulary of topology is overwhelmingly descriptive:
- **Open set**, **closed set** — describe the defining property
- **Compact** — suggests compression, finite covering
- **Connected** — describes path-connectivity
- **Continuous** — describes absence of breaks
- **Dense** — describes filling a space
- **Bounded** — describes containment within limits

These terms predate the formalization of topology as a discipline. They were drawn from the vernacular by mathematicians who were building the language of a new field and had no established eponyms to inherit. **Descriptive naming is the default when a field is young enough that no one has staked credit claims yet.**

The contrast with the later vocabulary (Hausdorff, Tychonoff, Urysohn, Lindelöf) is instructive: as topology matured and became a prestige field, eponyms proliferated. The young field named descriptively; the mature field named possessively.

### 3.2 Category Theory (The Central Example)

As argued in `01-category-theory-paradox.md`, category theory's descriptive vocabulary was forced by its abstraction. But there's also a historical factor: Eilenberg and Mac Lane were **deliberately designing a language**. Their 1945 founding paper is explicitly concerned with building vocabulary that enables thought, not with staking credit.

Mac Lane later wrote that they were "purloining words from the philosophers" — Category from Aristotle/Kant, Functor from Carnap, "natural transformation" from informal mathematical parlance. They chose terms for their conceptual resonance, not for credit.

This was possible because category theory emerged as a **service discipline** — a language for expressing relationships between other mathematical structures. Its practitioners were building infrastructure, not claiming territory.

### 3.3 Bourbaki's Selective Contribution

The Bourbaki group (1930s–1970s) introduced several descriptive terms that stuck:
- **Injective**: "in-throwing" — maps that throw distinct elements to distinct targets
- **Surjective**: "over-throwing" — maps that cover the entire target
- **Bijective**: "double-throwing" — both injective and surjective

These terms are morphologically transparent (Latin roots decompose into meaningful prefixes), compose naturally (an "injective surjective" map is bijective), and are now universal. They demonstrate that descriptive neologisms CAN replace prior terminology — Bourbaki's terms displaced various older names (one-to-one, onto, one-to-one correspondence).

But Bourbaki also introduced opaque terms ("Noetherian") and failed to systematize their naming approach. Their contribution was incidental, not principled.

### 3.4 Computer Science and Programming

The field that most directly builds things chose descriptive names almost exclusively:
- **Array**, **hash map**, **tree**, **stack**, **queue** — not "Turing sequence" or "Knuth table"
- **Algorithm** (from al-Khwarizmi) is the notable exception, and it's so old it functions as a vernacular word

Computer science's descriptive naming culture likely stems from engineering pragmatism: ambiguity has a compile-time cost. If you call a data structure by a name that doesn't describe it, you write bugs. Mathematics lacks this feedback loop — incorrect naming doesn't produce runtime errors, it produces confused students, and confused students are silent.

## 4. The Guild Function of Opaque Naming

### 4.1 Terminology as Gatekeeping

Opaque terminology functions as a **guild barrier**. To participate in mathematical discourse, you must first memorize a large vocabulary of arbitrary name→concept mappings. This filters for:
- Access to elite education (where the oral tradition lives)
- Persistence through memorization-heavy coursework
- Social belonging in the mathematical community (using the "right" names signals membership)

This filtering has nothing to do with mathematical ability. It selects for cultural capital, not intellectual capacity.

### 4.2 The Status Signaling Function

Using eponymous terms signals expertise — "I know what Hausdorff means" is a status claim. Descriptive terms don't carry the same signal — "point-separated space" is comprehensible to anyone who knows the constituent words, which defeats the signaling purpose.

This is not conspiracy — it's emergent. No individual mathematician decided to gatekeep through naming. But the system's incentive structure rewards those who master the arbitrary vocabulary and disadvantages those who haven't been acculturated.

### 4.3 The "Tradition" Defense

The most common defense of eponymous naming is "tradition" — "that's what it's always been called." This is a pure appeal to the causal chain (Kripke) without any consideration of whether the chain carries useful semantic content. Chemistry had tradition too. Biology had tradition too. Both reformed their nomenclature despite tradition, because the cost of opacity exceeded the cost of change.

Mathematics has never crossed that threshold — not because the cost is lower, but because the cost is invisible (borne by students who leave the field, not by experts who stay).

## 5. Timeline of Key Events

| Year | Event | Significance |
|---|---|---|
| 1735 | Linnaeus publishes *Systema Naturae* | Proves systematic naming works for science |
| 1780s | Lavoisier reforms chemical nomenclature | First systematic reform of scientific naming |
| 1892 | Geneva Nomenclature Congress | Chemistry tries rigid systematic naming — too cumbersome |
| 1919 | IUPAC founded | Institutional body for nomenclature |
| 1930 | Liège Nomenclature | Chemistry gets "systematic flexibility" — the winning formula |
| 1935 | Bourbaki founded | Introduces injective/surjective/bijective — incidental naming reform |
| 1945 | Eilenberg & Mac Lane publish | Category theory's deliberately descriptive vocabulary |
| 1980 | Henwood & Rival publish | First mathematical anti-eponymy manifesto |
| 1980 | Stigler's Law published | "No discovery is named after its discoverer" |
| 2019 | Beretta's *Names as Rewards* | Historical sociology of scientific eponymy |
| 2019+ | White's *Better Terms* | Most extensive ad hoc rename catalog |
| 2025 | **Mathemes initiated** | First compositional naming system for mathematics |

---

## Implications for Mathemes

1. **Young fields name descriptively; mature fields name possessively.** Mathemes can succeed if it positions itself as infrastructure for cross-domain communication, not as a challenge to any field's internal conventions.

2. **Institutional adoption matters more than intellectual merit.** The arguments have been sound since 1980. What's been missing is institutional backing. Target textbook authors, encyclopedia editors, and mathematical societies.

3. **Dual naming reduces switching costs to zero.** Nobody has to stop using "Hilbert space." They just also see "(complete inner-product space)" in the margin. Over a generation, the descriptive name becomes familiar.

4. **Computer science proves the case by existence.** The most practically consequential mathematical discipline chose descriptive naming because ambiguity has a cost. Mathematics should learn from its own applied offspring.

---

*This document traces the historical mechanisms that produced and sustain mathematical eponymy, identifying the pressure points where the Mathemes system can intervene.*
