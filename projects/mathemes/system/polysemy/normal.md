# Polysemy Network: "Normal"

**Status**: Analysis draft — requires mathematician review for precision.

---

## The Problem

"Normal" is used for at least 7 mathematically distinct concepts. The word's vernacular meaning ("usual, typical, not deviant") bleeds into mathematical usage in misleading ways — it implies the named concept is the "default" or "well-behaved" case, which is sometimes true and sometimes not.

## Semantic Network

```
                          "normal" (vernacular: usual, standard, not deviant)
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
     GEOMETRIC SENSE          ALGEBRAIC SENSE         ANALYTIC SENSE
     "perpendicular"          "invariant"             "well-behaved"
            │                       │                       │
     ┌──────┴──────┐         ┌──────┴──────┐         ┌──────┴──────┐
     │             │         │             │         │             │
  normal        normal    normal       normal     normal       normal
  vector        space     subgroup     operator   distribution   form
  (geometry)    (T4)      (algebra)    (func.     (probability)  (diff.
                                       analysis)                 geom.)
```

## Concept-by-Concept Analysis

### 1. Normal Vector (Geometry / Differential Geometry)

**Mathematical meaning**: A vector perpendicular (orthogonal) to a surface or curve at a given point.

**Why "normal" is used**: From Latin *normalis* — "made according to a square" (the carpenter's square, *norma*). A line at right angles. This is the oldest mathematical usage, geometrically precise.

**Why naive replacement fails**: "Perpendicular vector" is adequate in Euclidean geometry but loses precision in:
- Riemannian geometry (orthogonality defined by the metric tensor, not Euclidean angles)
- Pseudo-Riemannian geometry (orthogonality can involve null vectors — "perpendicular" misleads)
- Abstract inner-product spaces (orthogonality is defined by the inner product, not by visual right angles)

**Proposed Mathemes resolution**:
- **Systematic**: surface-orthogonal vector (geometry), metric-orthogonal vector (Riemannian)
- **Standard**: orthogonal vector (in context where the surface/metric is clear)
- **Legacy**: normal vector

**Precision check**: "Orthogonal" inherits from Greek *orthos* (right, straight) + *gonia* (angle). It generalizes beyond perpendicularity because it's defined relative to whatever inner product or metric is in scope. This is the correct level of generality.

### 2. Normal Subgroup (Algebra)

**Mathematical meaning**: A subgroup H of G such that gHg⁻¹ = H for all g in G. Equivalently, H is invariant under conjugation by any element of G.

**Why "normal" is used**: Galois used *sous-groupe distingué* ("distinguished subgroup"). The English "normal" was introduced later, probably from the sense of "standard" or "canonical" — a normal subgroup is the "right" kind of subgroup for forming quotients.

**Why this is problematic**: The word "normal" gives no hint of the defining property (invariance under conjugation). A student encountering "normal subgroup" has zero semantic scaffolding.

**Proposed Mathemes resolution**:
- **Systematic**: conjugation-invariant subgroup
- **Standard**: invariant subgroup (already used by some authors)
- **Legacy**: normal subgroup

**Precision check**: "Conjugation-invariant" is exactly the defining property. "Invariant subgroup" is slightly ambiguous (invariant under what?) but is standard and understood in context. "Self-conjugate subgroup" is another option but less intuitive.

### 3. Normal Space (Topology — T4 separation)

**Mathematical meaning**: A topological space where any two disjoint closed sets can be separated by disjoint open sets.

**Why "normal" is used**: Part of the Hausdorff/Tychonoff separation hierarchy. "Normal" was chosen as a value judgment — this is the "nice" separation condition. It tells you nothing about closed sets or open neighborhoods.

**Proposed Mathemes resolution**:
- **Systematic**: closed-set-separated space
- **Standard**: T4 space (already standard, but T4 is itself opaque)
- **Legacy**: normal space

**Precision check**: "Closed-set-separated" exactly describes the defining property. Fits the pattern from the Steve White / Claude renaming: T0 = distinct-point, T1 = closed-point, T2 = point-separated, T3 = point-set-separated, T4 = closed-set-separated.

### 4. Normal Operator (Functional Analysis)

**Mathematical meaning**: An operator A on a Hilbert space such that A*A = AA* (commutes with its adjoint).

**Why "normal" is used**: In the sense of "standard" or "well-behaved" — normal operators have nice spectral properties (the spectral theorem applies). The word encodes a value judgment about the operator's tractability.

**Proposed Mathemes resolution**:
- **Systematic**: adjoint-commuting operator
- **Standard**: self-adjoint-commuting operator (disambiguates from "commuting with other operators")
- **Legacy**: normal operator

**Precision check**: "Adjoint-commuting" is precisely the defining property. The name tells you exactly what to check: does it commute with its adjoint?

### 5. Normal Distribution (Probability / Statistics)

**Mathematical meaning**: The Gaussian probability distribution with density (1/σ√2π)exp(-(x-μ)²/2σ²).

**Why "normal" is used**: Gauss called it this (from the connection to the geometric normal via inner products). Francis Galton popularized "normal distribution" in the sense of "the distribution of normal (typical) variation." The name stuck through Galton's prestige.

**Why this is a special case**: "Normal distribution" is arguably the LEAST problematic use of "normal" — it's the most widely known mathematical term using this word, and "normal" in the vernacular sense of "typical/standard" is close to the mathematical meaning (the distribution describes typical random variation).

**Proposed Mathemes resolution**:
- **Systematic**: Retain "normal distribution" as the canonical home of "normal" in the morpheme inventory. This is the usage with the strongest vernacular-to-mathematical mapping.
- **Alternative systematic**: bell-curve distribution (more visually descriptive)
- **Legacy**: Gaussian distribution (eponymous alias)

### 6. Normal Form (Various)

**Mathematical meaning**: A canonical or standardized representation. Used in:
- Database theory (1NF, 2NF, 3NF — normalization)
- Logic (conjunctive/disjunctive normal form)
- Linear algebra (Jordan normal form, Smith normal form)
- Differential equations (Frobenius normal form)

**Why "normal" is used**: Here "normal" means "standard, canonical, regularized." The closest to the vernacular meaning.

**Proposed Mathemes resolution**:
- **Systematic**: canonical form (already widely used as a synonym)
- **Standard**: standard form
- **Legacy**: normal form

### 7. Normal Bundle / Normal Coordinates (Differential Geometry)

**Mathematical meaning**: Related to sense #1 — the bundle of vectors normal (orthogonal) to a submanifold.

**Proposed Mathemes resolution**: Follows from #1.
- **Systematic**: orthogonal bundle, orthogonal coordinates
- **Legacy**: normal bundle, normal coordinates

## Resolution Summary

| Current Usage | Underlying Concept | Mathemes Systematic Name | Confidence |
|---|---|---|---|
| Normal vector | Orthogonal to surface | surface-orthogonal vector | High |
| Normal subgroup | Invariant under conjugation | conjugation-invariant subgroup | High |
| Normal space (T4) | Closed sets separable by open sets | closed-set-separated space | High |
| Normal operator | Commutes with adjoint | adjoint-commuting operator | High |
| Normal distribution | The standard bell curve | normal distribution (RETAIN) | High |
| Normal form | Canonical representation | canonical form | High |
| Normal bundle | Orthogonal complement bundle | orthogonal bundle | High |

## Design Decision

**"Normal" in the Mathemes inventory means**: the probability distribution. This is the one usage where the vernacular meaning ("typical, standard") genuinely illuminates the mathematical concept. All other senses get replaced by descriptive morphemes that encode their actual defining properties.

## Network Implications

Resolving "normal" cascades into these related terms:
- "Orthogonal" becomes a property morpheme (replacing the geometric "normal")
- "Invariant" becomes a property morpheme (replacing the algebraic "normal")  
- "Canonical" replaces "normal form" in all contexts
- The separation axiom hierarchy gets systematic descriptive names throughout

---

*This analysis is the template for all polysemy resolutions. Each polysemous term gets the same treatment: collect meanings → map the network → analyze precision → propose resolutions → check cascading implications.*
