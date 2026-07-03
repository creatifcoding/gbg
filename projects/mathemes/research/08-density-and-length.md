# Density & Length: The Compression Constraint

**Status**: New research document — addresses a gap identified during system design.

---

## The Problem We Missed

Mathemes Principle P6 ("frequency-length correlation") was stated as an axiom but never substantiated. We invoked Zipf and Miller in passing without asking the hard question:

**At what point does a descriptive name become so long that its transparency benefit is consumed by its processing cost?**

This isn't academic. If "conjugation-invariant subgroup" is better than "normal subgroup" but "locally-compact-second-countable-connected-metrizable-Hausdorff space" is worse than any eponym, then the system needs a principled boundary — not a vibe.

---

## 1. What the Psycholinguistics Says

### 1.1 Compound Word Processing Is Length-Dependent

Bertram & Hyönä (2003) demonstrate that word length fundamentally changes HOW morphologically complex words are processed:

- **Short compounds** (≤8 characters, ~2-3 syllables): processed as **whole units** via single eye fixation. Morphological decomposition is not required. The brain recognizes the compound as a gestalt.
- **Long compounds** (≥12 characters, ~4+ syllables): receive **multiple fixations** and are processed via **morphological decomposition** — the reader breaks the word into constituents, processes each, and reassembles meaning.

**Critical implication**: Short descriptive names get the best of both worlds — they're processed holistically (fast) AND their morphemes carry semantic content (transparent). Long descriptive names FORCE decomposition, which is slower than holistic recognition of a familiar opaque term.

This means: **a 2-morpheme descriptive name is almost always better than an eponym. A 5+ morpheme descriptive name may be worse than a familiar eponym for experts who process it holistically.**

### 1.2 Constituent Frequency Matters More Than Length

Research on compound word processing (Juhasz et al., 2003; Libben, 2006) consistently shows that the **frequency of the constituent morphemes** is a stronger predictor of processing speed than the overall compound length:

- A 4-morpheme compound made of high-frequency morphemes (e.g., "complete inner-product space") processes faster than a 2-morpheme compound with a low-frequency morpheme (e.g., "Tychonoff space" for someone who hasn't memorized the mapping)
- The **morpheme inventory** should preferentially use high-frequency English/Latin words as its atoms — this directly accelerates compound processing

### 1.3 Semantic Transparency Accelerates Processing

El-Bialy et al. (2013) show that **semantically transparent compounds** (where the whole meaning is derivable from the parts) are processed faster than opaque compounds of the same length:

- "Rosebud" (transparent: a bud of a rose) → faster
- "Hogwash" (opaque: nothing to do with hogs or washing) → slower

This is the core Mathemes thesis confirmed: transparency IS a processing advantage. But the advantage is **bounded** — it doesn't scale linearly with length. A 3-morpheme transparent compound is great. A 7-morpheme transparent compound is still transparent but the length penalty dominates.

### 1.4 The Working Memory Constraint Is Real But Nuanced

Miller (1956) said 7±2 chunks. Cowan (2001) refined to 4±1. But for compound terms specifically:

- A compound term is itself **one chunk** if the reader has encountered it before — "complete inner-product space" becomes a single chunk through familiarity
- For a first encounter, each morpheme is a separate chunk — 3 morphemes = 3 chunks, consuming most of working memory's capacity
- Beyond 4 novel morphemes in a single term, the reader cannot hold the entire name in working memory while simultaneously processing its meaning

**Practical threshold**: A Mathemes systematic name should contain **≤4 morphemes** for any concept encountered frequently. Rare concepts can tolerate 5-6 morphemes because the reader has more time to process them and encounters them less often.

---

## 2. What IUPAC's Experience Shows

### 2.1 The Three-Name Reality

IUPAC's Blue Book (2013) defines three categories precisely because systematic names can be impractically long:

1. **Preferred IUPAC Names (PINs)**: The canonical systematic name, used for regulatory and indexing purposes. Can be very long.
2. **Acceptable alternatives**: Shorter systematic variants permitted in general nomenclature.
3. **Retained trivial names**: Traditional non-systematic names kept for practical communication ("styrene" not "ethenylbenzene," "urea" not "carbonyl diamide").

The criteria for retaining a trivial name are instructive:
- The trivial name is **widely established** in the literature
- The systematic name is **significantly longer** without adding clarity in typical use
- The trivial name doesn't **actively mislead** about the structure

This is not a failure of IUPAC's system — it's a **designed feature**. The system acknowledges that a purely systematic vocabulary is unusable for daily communication. Chemistry solved this by being explicit about WHEN each register is appropriate.

### 2.2 Chemists Actually Say "Ethanol"

In practice, chemists use systematic names primarily for:
- Indexing and database queries
- Regulatory filings
- Disambiguation when discussing structurally similar compounds

For everything else, they use common names. Nobody says "2,4,6-trinitrotoluene" in conversation — they say "TNT." The systematic name exists for precision; the short name exists for communication.

**Lesson for Mathemes**: Our three-register system (systematic / standard / legacy) isn't just philosophically principled — it's **empirically necessary**. Chemistry proved that a single-register system doesn't survive contact with human communication behavior.

---

## 3. The Compression Behavior

### 3.1 Abbreviation Is Inevitable

Medical terminology research (Brunetti et al., 2007; Sinha et al., 2011) documents 50+ years of concern about abbreviation proliferation:

- **Every** systematic terminology gets abbreviated in practice
- Abbreviation is driven by **expression efficiency** (Zipfian pressure) — speakers minimize articulatory effort
- Abbreviations arise **independently and inconsistently** across communities
- Official attempts to restrict abbreviation have **universally failed**

**Implication**: If Mathemes prescribes "conjugation-invariant subgroup," practitioners WILL abbreviate it. The question is whether the system designs the abbreviation (standard register) or lets it happen chaotically (the medical model).

### 3.2 Designed Compression vs. Organic Compression

Two strategies:

**Organic** (what happens without planning): Users create their own abbreviations. "Locally compact Hausdorff" becomes "LCH." "Conjugation-invariant subgroup" becomes "CI-subgroup" or "conj-invariant." Multiple communities create different abbreviations for the same concept. The abbreviations carry no systematic relationship to each other.

**Designed** (what IUPAC does): The system specifies acceptable abbreviations. "Ethanol" is the designed short form of "ethan-1-ol." The abbreviation is curated, documented, and consistent across communities.

Mathemes must use designed compression. The standard register exists precisely for this.

---

## 4. The Density/Length Budget

Based on the psycholinguistic evidence, the IUPAC precedent, and the compression reality, here are the concrete constraints:

### 4.1 Morpheme Count Limits

| Usage Frequency | Max Morphemes (Systematic) | Standard Register | Rationale |
|---|---|---|---|
| Ubiquitous (daily use in papers) | 2-3 | 1-2 word shorthand | Holistic processing zone — must be fast |
| Common (weekly use) | 3-4 | 2-3 word shorthand | Decomposition zone — transparency helps |
| Specialized (monthly use) | 4-5 | Full systematic OK | Processing cost tolerable for rare terms |
| Rare (encountered in specific papers) | 5-7 | Full systematic | Reader has time; clarity trumps speed |

### 4.2 Syllable Budget

Based on the eye-tracking evidence (Bertram & Hyönä, 2003):

- **≤4 syllables**: holistic processing likely — this is the sweet spot
- **5-7 syllables**: decomposition required but manageable
- **8-10 syllables**: processing cost significant — needs a standard abbreviation
- **11+ syllables**: unusable without abbreviation — systematic name exists only for disambiguation/indexing

| Eponymous | Syllables | Mathemes Systematic | Syllables | Verdict |
|---|---|---|---|---|
| Hilbert space | 4 | complete inner-product space | 8 | ⚠️ Needs standard abbreviation |
| Hausdorff space | 4 | point-separated space | 6 | ✅ Manageable |
| Fourier series | 5 | frequency expansion | 7 | ✅ Manageable |
| Noether's theorem | 5 | symmetry-conservation theorem | 10 | ⚠️ Needs abbreviation |
| Abelian group | 5 | commutative group | 5 | ✅ Equal — clear win |
| Normal subgroup | 5 | conjugation-invariant subgroup | 10 | ⚠️ Needs abbreviation |
| Gaussian elimination | 7 | row reduction | 4 | ✅ Shorter AND clearer |

### 4.3 The 8-Syllable Rule

**Proposed principle**: Any systematic name exceeding 8 syllables MUST have a curated standard abbreviation in the standard register.

This is not arbitrary — it's the boundary between the decomposition zone (where transparency helps) and the overload zone (where length cost dominates transparency benefit).

---

## 5. Implications for System Design

### 5.1 Revision to P6 (Frequency-Length Correlation)

The original P6 was vague: "Common concepts get short names." The substantiated version:

**P6 (revised): The 8-Syllable Budget.**
- Systematic names ≤8 syllables need no abbreviation.
- Systematic names >8 syllables MUST have a curated standard abbreviation.
- The standard abbreviation should be 2-4 syllables.
- For ubiquitous concepts (used daily), the standard register — not the systematic — is the default in papers.

### 5.2 New Principle: P8. Designed Compression

Abbreviation is inevitable. The system must design it, not leave it to chance.

For every concept whose systematic name exceeds 8 syllables, the morpheme inventory must specify:
- The full systematic name (for disambiguation and indexing)
- The standard abbreviation (for working communication)
- The abbreviation's derivation (so it's not arbitrary — "CI-subgroup" from "conjugation-invariant")

### 5.3 Morpheme Inventory Constraint

The morpheme inventory should prefer morphemes that are:
- **High-frequency** in general English or scientific English (faster constituent processing)
- **≤3 syllables each** (so compounds of 2-3 morphemes stay under the 8-syllable budget)
- **Phonologically distinct** (don't sound like other morphemes — avoids confusion in speech)

### 5.4 The Composition Sweet Spot

The ideal Mathemes name is **2-3 morphemes, 4-7 syllables, semantically transparent**:

```
[1 qualifier/property] + [1 distinguishing property] + [1 structure]

Examples:
  complete + inner-product + space     (3 morphemes, 8 syllables — at the limit)
  commutative + group                  (2 morphemes, 5 syllables — sweet spot)
  point-separated + space              (2 morphemes, 6 syllables — sweet spot)  
  frequency + expansion                (2 morphemes, 7 syllables — sweet spot)
  row + reduction                      (2 morphemes, 4 syllables — ideal)
```

Names that exceed this sweet spot need designed compression:

```
  conjugation-invariant + subgroup     (3 morphemes, 10 syllables — OVER)
  → Standard: "invariant subgroup"     (2 morphemes, 5 syllables — within budget)
  
  symmetry-conservation + theorem      (3 morphemes, 10 syllables — OVER)
  → Standard: "sym-con theorem"        (3 morphemes, 5 syllables — within budget)
```

---

## 6. What This Changes

This research fills a genuine gap. We were designing names without a cost function. Now we have one:

**Name quality = transparency benefit − length penalty − compression chaos risk**

- Transparency benefit: proportional to morpheme count and semantic transparency (more morphemes = more information, but diminishing returns past 3)
- Length penalty: accelerates past 8 syllables (psycholinguistic evidence)
- Compression chaos risk: proportional to the gap between systematic name length and what humans will actually say

A name is optimal when it maximizes transparency while staying within the 8-syllable budget. If it can't, it needs a designed abbreviation in the standard register.

---

## References

- Bertram, R. & Hyönä, J. (2003). "The length of a complex word modifies the role of morphological structure." *Journal of Memory and Language* 48(3), 615-634.
- Cowan, N. (2001). "The magical number 4 in short-term memory." *Behavioral and Brain Sciences* 24(1), 87-114.
- El-Bialy, R. et al. (2013). "Benefits and costs of lexical decomposition during processing of transparent and opaque English compounds." *Journal of Memory and Language* 68(4).
- IUPAC (2013). *Nomenclature of Organic Chemistry: Recommendations and Preferred Names*. Royal Society of Chemistry.
- Juhasz, B.J. et al. (2003). "Effects of morphology on compound word recognition." *Journal of Experimental Psychology: Learning, Memory, and Cognition*.
- Miller, G.A. (1956). "The magical number seven." *Psychological Review* 63(2), 81-97.

---

*This document substantiates the length/density constraint that was previously stated as an axiom. It introduces the 8-syllable budget, the designed compression principle, and the composition sweet spot — all grounded in psycholinguistic evidence.*
