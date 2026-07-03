# Philosophy of Naming

**Status**: Enriched research draft — Kripkean reference theory applied to mathematical nomenclature.

---

## Thesis

Mathematical names operate in two different semantic modes.

1. **Rigid designators** point through a historical chain of use: `Hilbert space`, `Noetherian ring`, `Hausdorff space`, `Fourier transform`.
2. **Descriptions** identify by properties: `complete inner-product space`, `ascending-chain-condition ring`, `point-separated topological space`, `frequency-decomposition transform`.

Kripke’s *Naming and Necessity* explains why these modes are not interchangeable. Eponyms behave like names: they inherit reference through baptism and causal transmission, not through descriptive content. Mathemes deliberately builds **Russellian mathematical descriptions**: terms that expose the conditions by which a concept is recognized.

The conclusion is not “ban all eponyms.” That would be adorable, Prime, but history is not a linter. The conclusion is: **use eponyms as expert aliases and descriptive names as the learning/cross-domain interface.**

---

## 1. Kripke’s Target: Description Theories of Names

Kripke begins Lecture I by distinguishing proper names from definite descriptions. A description such as “the man who corrupted Hadleyburg” refers to whoever uniquely satisfies it. A proper name such as `Aristotle` appears to refer to a particular individual directly. [Kripke 1980, Lecture I](file:///tmp/mathemes-txt/kripke1980-naming-and-necessity.md)

The Frege-Russell tradition explains names by descriptions. `Aristotle` might abbreviate “the teacher of Alexander,” “the student of Plato,” “the author of the *Metaphysics*,” or a cluster of such descriptions.

Kripke separates two theories:

1. **Meaning theory:** the name *means* the description.
2. **Reference-fixing theory:** the description does not mean the same thing as the name, but fixes which object the name refers to.

That distinction matters for Mathemes. A descriptive mathematical name can be a genuine definition (`complete inner-product space`) or a reference-fixing gloss for an alias (`Hilbert space`). Confusing those uses is how terminology becomes fog with a bibliography.

---

## 2. The Cluster Theory and Kripke’s Objections

Kripke’s refined target is the cluster theory associated with Wittgenstein, Searle, Strawson, and others. The view says that a name’s reference is determined by a weighted family of descriptions believed by the speaker.

For `Moses`, the cluster might include “led the Israelites out of Egypt,” “received the commandments,” and “did much of what the Bible relates.” For `Aristotle`, it might include “studied with Plato,” “taught Alexander,” and “wrote works on logic and metaphysics.”

Kripke formulates the theory as theses: a speaker associates properties with a name; believes some subset uniquely picks out an individual; the object satisfying most of them is the referent; if no unique object satisfies them, the name fails to refer; and the speaker knows a priori that the bearer has enough of those properties. He then attacks the theory from several directions. [Kripke 1980, Lecture II](file:///tmp/mathemes-txt/kripke1980-naming-and-necessity.md)

### 2.1 Modal argument

Names are **rigid designators**: they designate the same object in every possible world in which that object exists. Descriptions are usually non-rigid: they may pick out different objects in different possible worlds.

`Aristotle` designates Aristotle. “The teacher of Alexander” could have designated someone else if Aristotle had never gone into pedagogy. Aristotle might never have taught Alexander, but Aristotle could not have failed to be Aristotle.

Applied to mathematical eponyms:

- `Hilbert space` rigidly designates the concept historically called Hilbert space.
- `complete inner-product space` describes the structure by defining properties.
- The eponym points; the description explains.

If the mathematical community had named complete inner-product spaces after Riesz, von Neumann, or nobody at all, the structure would remain. The eponym is historically contingent; the structure is not.

### 2.2 Epistemological argument

Kripke separates **a priori** from **necessary**. `Hesperus is Phosphorus` is necessary if true, because both names rigidly designate Venus, but it was known empirically. Conversely, if `one meter` is fixed by a standard stick, one can know by stipulation that the stick is one meter at the fixing time, but the stick could have been stretched.

For mathematics, a student may learn empirically from a textbook that `Hilbert space` means complete inner-product space. Once the definition is accepted, the equivalence is treated as definitional. But the eponym gives no access to the structure until someone supplies the description.

### 2.3 Misinformation argument

Kripke’s most devastating examples involve error. Suppose everyone believes Gödel proved incompleteness, but in a fictional scenario Schmidt actually proved it and Gödel stole the manuscript. Ordinary speakers saying `Gödel` still refer to Gödel, not Schmidt. The description “the man who proved incompleteness” would pick Schmidt; the name picks Gödel. Kripke also notes that the so-called Peano axioms may trace to Dedekind.

This is the philosophical root of the eponym problem. Eponyms are not reliable semantic descriptions. They are historical pointers, and historical pointers can carry misinformation.

---

## 3. Baptism and Causal Chains

Kripke’s positive picture: a name begins with an initial **baptism**. An object is named by ostension (“that is Hesperus”) or by description (“the planet causing these orbital perturbations is Neptune”). The name is then passed from speaker to speaker through a causal chain. Later speakers can refer successfully even if they possess only thin or partially false descriptions.

This fits mathematical terminology almost too well.

### 3.1 Mathematical baptism

A mathematical concept is baptized when a paper, lecture, textbook, or research community attaches a term to a definition or construction:

```text
Call a complete inner-product vector space a Hilbert space.
```

Reference then propagates through journals, lectures, textbooks, theorem statements, software libraries, and citation networks. A student who says `Hilbert space` may know only “some vector space used in functional analysis.” The reference can still succeed because the student is embedded in the chain.

### 3.2 Who baptized Hilbert space?

The structures now called Hilbert spaces arose from work by David Hilbert, Erhard Schmidt, Frigyes Riesz, and others in integral equations and functional analysis. Hilbert studied the relevant infinite-dimensional settings; Riesz and Fischer clarified `L^2`; von Neumann’s 1927 formulation helped place Hilbert-space methods at the center of quantum mechanics. Some summaries credit von Neumann with introducing or stabilizing the name, while broader accounts credit Hilbert as source of the underlying spaces. [Britannica: Hilbert space](http://www.britannica.com/eb/article-9384376/Hilbert-space); [Oxford Reference: Hilbert space](https://www.oxfordreference.com/display/10.1093/oi/authority.20110803095936537)

That ambiguity is instructive. The term’s causal chain remembers a person, not the structural checklist:

- vector space;
- scalar field;
- inner product;
- induced norm/metric;
- completeness.

`Complete inner-product space` remembers the checklist.

### 3.3 Chains carry false credit

Stigler’s Law of Eponymy says no scientific discovery is named after its original discoverer. Stigler’s 1980 article formulates the law while crediting Robert Merton for the underlying insight, making the law self-instantiating. [Stigler 1980](https://www.scienceopen.com/document?vid=68165956-29d6-4692-8b45-3a831283442b)

Mathematical examples include `Peano axioms`/Dedekind, `Pell equation`, ancient antecedents of `Pythagorean theorem`, and non-European antecedents of elimination algorithms. Kripke explains why such errors are stable: once a name enters the chain, ordinary use does not update automatically when historical credit changes.

**Mathemes consequence:** credit belongs in metadata and history notes; structure belongs in the term.

---

## 4. Russellian Descriptions as the Mathemes Alternative

Russell’s theory analyzes phrases like “the author of *Waverley*” as quantified descriptions: there exists exactly one object satisfying the condition, and it has the asserted property. Descriptions identify by criteria.

Mathematical descriptive names are Russellian in this sense:

| Standard/eponymic term | Descriptive form |
|---|---|
| Hilbert space | complete inner-product vector space |
| Banach space | complete normed vector space |
| Hausdorff space | topological space whose distinct points have disjoint neighborhoods |
| Noetherian ring | ring satisfying the ascending chain condition on ideals |
| Cauchy sequence | sequence whose terms eventually become arbitrarily close |
| Fourier transform | transform decomposing a function into frequency components |

A Russellian description carries verification conditions. To test whether something is a Banach space, ask:

1. Is it a vector space?
2. Does it have a norm?
3. Is the metric induced by the norm complete?

The name becomes a checklist. Eponyms do not provide that.

### 4.1 But descriptions can be too long

Kripke also explains why experts resist replacement. In expert discourse, an eponym is a short rigid designator with stable reference. Once everyone knows the referent, `Hilbert space` is efficient. Replacing every occurrence with `complete inner-product vector space` may add load.

Correct architecture: **dual register**.

```text
Learning / transfer: complete inner-product space
Expert / literature: Hilbert space
Formal schema: Space[Vector, InnerProduct, Complete]
```

The descriptive register teaches and transfers. The eponymic register compresses and cites tradition.

### 4.2 Descriptions can become rigid too

In formal mathematics, a descriptive term can be rigidified by definition. Once a community stipulates that `Banach space` means complete normed vector space, both terms designate the same class. But their cognitive roles differ:

- `Banach space`: rigid historical label.
- `complete normed vector space`: structural description.

They may be extensionally equivalent inside a theory, but they are not pedagogically equivalent.

---

## 5. Possible Worlds and Mathematical Concepts

Kripke’s possible-worlds apparatus separates what a name refers to from which properties identify it. `Nixon` refers to Nixon in counterfactual situations where he loses the election. `The winner of the 1968 election` may refer to someone else.

Mathematical objects behave differently because mathematical structures are often necessary if they exist at all. Still, the naming lesson survives.

```text
Hilbert space = complete inner-product space
```

As a formal equivalence, this is necessary inside adopted definitions. But `Hilbert` is not what makes it true. The definition does. In another mathematical history where the concept was named `Riesz space`, the structure would not change. The causal chain would.

Mathemes should separate:

1. **Concept identity** — fixed by definitions, axioms, equivalences, universal properties.
2. **Term reference** — fixed by historical baptism and community transmission.
3. **Pedagogical access** — improved by transparent descriptions and morphology.

---

## 6. Naming Ethics: Credit, Clarity, Memory

Eponyms do real work. They honor mathematicians, compress discourse, and preserve historical lineage. But they also distort credit, obscure structure, and impose arbitrary memorization.

A Kripkean diagnosis is precise:

- An eponym is a rigid designator sustained by a causal chain.
- The chain is historically sticky.
- The chain can survive false beliefs about origin, priority, and defining properties.
- Therefore, eponyms are poor teaching names even when they are stable expert names.

Example: `Hausdorff space` is efficient for experts, but to a learner it says only “Hausdorff-ish.” A descriptive expansion such as `point-separated topological space` or `distinct-points-disjoint-neighborhoods space` carries the separation condition. It also reveals hierarchy: T0 distinguishes points, T1 closes points, T2/Hausdorff separates distinct points by disjoint neighborhoods, and stronger axioms separate points/closed sets or closed sets/closed sets by neighborhoods or functions.

The eponym hides the ladder. The description shows the rungs.

---

## 7. Mathemes Design Principles from Kripke

### 7.1 Distinguish reference from meaning

A term may successfully refer while conveying no meaning to a novice. Track both:

```text
alias: Noetherian ring
meaning-name: ascending-chain-condition ring
formal: Ring[Ideals.ACC]
```

### 7.2 Separate baptism from definition

Record who introduced a term and where, but do not make that the primary learning surface. Historical baptism belongs in metadata.

### 7.3 Treat eponyms as rigid aliases

```text
Hilbert space -> complete inner-product space
Banach space -> complete normed vector space
Hausdorff space -> point-separated topological space
Noetherian ring -> ideal-ascending-chain ring
```

### 7.4 Prefer descriptions across domains

When a concept travels between analysis, topology, algebra, physics, computer science, or education, use the description first. Causal chains fragment across domains; structure transfers.

### 7.5 Preserve credit without making credit the concept

```text
Hilbert space
Structural name: complete inner-product space
Named for: David Hilbert
Historical chain: Hilbert, Schmidt, Riesz, Fischer, von Neumann
```

This gives credit more honestly than the eponym alone.

---

## Final Position

Kripke does not prove that descriptive mathematical names are always better. He proves something more useful: **names and descriptions serve different semantic functions**.

- Eponyms are Kripkean: rigid, historical, efficient, opaque.
- Mathemes names are Russellian: descriptive, structural, teachable, transferable.
- Mature mathematical communication needs both registers.

The philosophical defense of Mathemes is not that eponyms fail to refer. They refer beautifully. That is exactly the problem: they refer while explaining almost nothing.

---

## Key Sources

- Kripke, S. A. (1980). *Naming and Necessity*, Lectures I–II. `file:///tmp/mathemes-txt/kripke1980-naming-and-necessity.md`
- Russell, B. (1905). “On Denoting.” Background theory of descriptions.
- Stigler, S. M. (1980). “Stigler’s Law of Eponymy.” *Transactions of the New York Academy of Sciences*, 39(1), 147–157. <https://www.scienceopen.com/document?vid=68165956-29d6-4692-8b45-3a831283442b>
- Britannica. “Hilbert space.” <http://www.britannica.com/eb/article-9384376/Hilbert-space>
- Oxford Reference. “Hilbert space.” <https://www.oxfordreference.com/display/10.1093/oi/authority.20110803095936537>
