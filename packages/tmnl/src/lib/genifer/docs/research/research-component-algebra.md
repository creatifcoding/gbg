# Research: Component Algebra — Algebraic Foundations of UI Composition

```
Topic:          Algebraic Data Types, Semiring Composition, Component Operators
Platform:       Genifer (Generative UI subsystem of TMNL)
Author:         Val (architectural conscience)
Date:           2026-02-19
Status:         DRAFT
Sections:       7
Frameworks:     Abstract Algebra, ADT Theory, Semiring Theory
Purpose:        Formal foundation for F445 (Component Algebra)
Tasks:          #1621 (formalize), #1622 (compose operators), #1623 (property tests)
Bibliography:   docs/genifer/research/BIBLIOGRAPHY.md
Extrapolates:   [TSG-DATA-FUSION], [TSG-FUSION-ONTOLOGY]
```

---

## 1. Problem Statement

### 1.1 What Is Component Algebra?

Genifer generates UI trees from LLM output. These trees are composed of *components* — typed nodes with props, children, visibility conditions, and actions. The question:

**What algebraic structure governs how components compose?**

If we can identify this structure, we gain:
1. **Formal composition rules** — which component combinations are valid
2. **Identity and zero elements** — empty/null components that compose neutrally
3. **Associativity guarantees** — reordering composition doesn't change semantics
4. **Property-based testing** — generate arbitrary valid trees via algebraic laws

### 1.2 Existing Genifer Primitives

Genifer already has implicit algebraic structure:

| Primitive | Algebraic Role |
|---|---|
| `UIElement` | The carrier set |
| `type` field (discriminator) | Tagged union constructor (sum type) |
| `props` record | Product type |
| `children` array | Free monoid (sequence) |
| `visibility` conditions | Boolean algebra |
| `actions` array | Free monoid |
| `UITree` (root + elements map) | Labeled tree (graph-theoretic) |

This research makes the algebra *explicit* and derives composition operators from it.

---

## 2. Algebraic Data Type Foundation

### 2.1 Sum and Product Types

From type theory [ADT-WIKI]:

**Product type (×)**: A record of fields. Each field must be present.
```
Props = columns × gap × padding  (all three required)
```

**Sum type (+)**: A tagged union. Exactly one variant is active.
```
UIElement = Text + Image + Grid + Card + Chart + ...
```

**Recursive type (μ)**: Self-referential structure.
```
UITree = μτ. Element × List(τ)
```
A tree is an element containing a list of trees.

### 2.2 The Component Type Equation

Every genifer component type defines a functor from props to rendered output:

```
Component[T] = T → Props(T) × Children(T) × Visibility(T) × Actions(T) → ReactNode
```

Where:
- `T` is the component's type tag (the discriminator value)
- `Props(T)` is the product type of the component's prop schema
- `Children(T)` is the list of child element types allowed
- `Visibility(T)` is the boolean visibility predicate
- `Actions(T)` is the list of user-triggerable actions

### 2.3 The Full UIElement Type

Using standard ADT notation:

```
UIElement = Σ_{T ∈ Catalog} ( Tag(T) × Key × Props(T) × Children(T)* × Visibility? × Actions* )
```

This is a *dependent sum* (Σ-type): the shape of Props depends on the tag T. Effect.Schema models this exactly via `Schema.Union` of `Schema.TaggedStruct` variants.

---

## 3. Component Composition Operators

### 3.1 Vertical Composition (Nesting)

**Definition**: Given components A and B, the vertical composition A ▷ B places B as a child of A.

```
A ▷ B = A with children = [...A.children, B]
```

**Properties**:
- **Not commutative**: A ▷ B ≠ B ▷ A (parent-child is asymmetric)
- **Associative in a specific sense**: A ▷ (B ▷ C) creates a 3-level tree: A → B → C. This is the same tree whether we first nest C into B then B into A, or nest B into A then C into B. (The tree structure is the same.)
- **Identity**: There is no strict identity for vertical composition (you can't nest into nothing). However, a transparent wrapper component (e.g., `Fragment`) acts as a weak identity: `Fragment ▷ A ≈ A`.

### 3.2 Horizontal Composition (Sibling)

**Definition**: Given components A and B that are siblings under a common parent P, the horizontal composition A ⊕ B creates a sibling list.

```
P(A ⊕ B) = P with children = [..., A, B, ...]
```

**Properties**:
- **Associative**: (A ⊕ B) ⊕ C = A ⊕ (B ⊕ C) — sibling order is sequential
- **Not commutative** (in general): Rendering order matters. A ⊕ B and B ⊕ A produce different visual layouts.
- **Identity**: The empty component ε satisfies A ⊕ ε = ε ⊕ A = A. In genifer, this is a `null` element that renders nothing.
- **This is a free monoid**: (Children, ⊕, ε) forms a free monoid — the monoid of finite sequences.

### 3.3 Conditional Composition (Visibility)

**Definition**: Given a component A and a visibility predicate φ, the conditional A|φ renders A only when φ holds.

```
A|φ = A with visibility = φ
```

**Properties**:
- **Boolean algebra**: φ can be And, Or, Not, Eq, Gt, Lt with PathRef
- **Absorption**: A|true = A, A|false = ε (renders nothing)
- **Distribution over horizontal**: (A ⊕ B)|φ = A|φ ⊕ B|φ
- **Composition**: A|φ|ψ = A|(φ ∧ ψ) (nested conditions AND together)

### 3.4 Property Overlay (Props Merge)

**Definition**: Given two prop records p₁ and p₂ for the same component type, the overlay p₁ ⊘ p₂ merges them with p₂ taking precedence.

```
p₁ ⊘ p₂ = { ...p₁, ...p₂ }
```

**Properties**:
- **Associative**: (p₁ ⊘ p₂) ⊘ p₃ = p₁ ⊘ (p₂ ⊘ p₃)
- **Not commutative**: Precedence matters (p₂ overrides p₁)
- **Identity**: The empty record {} satisfies p ⊘ {} = {} ⊘ p = p
- **Idempotent**: p ⊘ p = p
- **This is a bounded semilattice** under the information ordering

---

## 4. The Component Semiring

### 4.1 Semiring Structure

Combining horizontal (⊕) and vertical (▷) composition:

**Claim**: The set of UIElements with operations (⊕, ▷, ε, Fragment) forms a *near-semiring*:

1. **(UIElements, ⊕, ε)** is a monoid (horizontal composition)
2. **(UIElements, ▷, Fragment)** is a monoid (vertical composition, with Fragment as weak identity)
3. **Left distribution**: A ▷ (B ⊕ C) = (A ▷ B) ⊕ (A ▷ C) ← **This does NOT hold in general**

Distribution fails because nesting B and C separately under A produces two copies of A, not one A with two children. Instead:

**Corrected**: A ▷ (B ⊕ C) means "A with children [B, C]" — which is a SINGLE node A, not a sum.

This means we have a **near-semiring without full distribution**. The vertical-over-horizontal interaction is:
```
A ▷ [B₁, B₂, ..., Bₙ] = A with children = [B₁, B₂, ..., Bₙ]
```

This is more naturally modeled as a **tree algebra** than a semiring.

### 4.2 Tree Algebra Formalization

**Definition (Component Tree Algebra).** The triple (C, ⊕, ▷) where C is the set of UIElements forms a **Σ-algebra** [COMON-TATA2007 §1.1]:

- For each component type f ∈ Σ with arity n, the interpretation is:
  ```
  f^A: C^n → C
  f^A(c₁, ..., cₙ) = Element(type=f, children=[c₁, ..., cₙ])
  ```

- The carrier set C is the set of all finite trees over Σ.

- The term algebra T(Σ) is the **initial algebra** — the free Σ-algebra generated by the ranked alphabet.

**Significance**: Genifer's UITree is an element of the initial algebra T(Σ_genifer). The regular tree grammar G_genifer (from research-tree-grammars.md) defines a recognizable subset of this algebra.

### 4.3 Relationship to Effect.Schema

Effect.Schema's `Schema.Union` of `Schema.TaggedStruct` variants is the TypeScript encoding of the sum type:

```typescript
// Algebraically: UIElement = Text + Image + Grid + Card + ...
const UIElement = Schema.Union(
  Schema.TaggedStruct('Text', { content: Schema.String }),
  Schema.TaggedStruct('Image', { src: Schema.String }),
  Schema.TaggedStruct('Grid', { columns: Schema.Number }),
  // ...
)
```

The discriminator-based decoding (`Schema.decodeUnknown`) is exactly the Σ-algebra interpretation function: given a tagged value, select the appropriate constructor and validate the arguments (props).

---

## 5. Composition Laws (Property Tests)

### 5.1 Laws for Property-Based Testing

These laws should hold for ALL valid components and trees. They are the foundation for generative property tests.

```
LAW 1 (Horizontal Identity):
  ∀ A : A ⊕ ε = A  AND  ε ⊕ A = A

LAW 2 (Horizontal Associativity):
  ∀ A, B, C : (A ⊕ B) ⊕ C = A ⊕ (B ⊕ C)

LAW 3 (Visibility Absorption):
  ∀ A : A|true = A  AND  A|false = ε

LAW 4 (Visibility Conjunction):
  ∀ A, φ, ψ : A|φ|ψ = A|(φ ∧ ψ)

LAW 5 (Props Identity):
  ∀ A : A.props ⊘ {} = A.props

LAW 6 (Props Associativity):
  ∀ p₁, p₂, p₃ : (p₁ ⊘ p₂) ⊘ p₃ = p₁ ⊘ (p₂ ⊘ p₃)

LAW 7 (Props Idempotence):
  ∀ p : p ⊘ p = p

LAW 8 (Nesting Preserves Identity):
  ∀ A : Fragment ▷ A ≈ A  (modulo wrapper node)

LAW 9 (Tree Membership):
  ∀ valid tree t : t ∈ L(G_genifer)
  (Every well-formed composition produces a tree in the grammar)
```

### 5.2 fast-check Implementation Sketch

```typescript
import * as fc from 'fast-check'

// Arbitrary UIElement generator (respects grammar)
const arbLeaf = fc.oneof(
  fc.record({ type: fc.constant('Text'), props: arbTextProps }),
  fc.record({ type: fc.constant('Image'), props: arbImageProps }),
)

const arbTree = fc.letrec(tie => ({
  leaf: arbLeaf,
  node: fc.record({
    type: fc.constantFrom('Grid', 'Flex', 'Stack'),
    children: fc.array(fc.oneof(tie('leaf'), tie('node')), { maxLength: 5 }),
  }),
  tree: fc.oneof(tie('leaf'), tie('node')),
}))

// LAW 2: Horizontal associativity
fc.assert(fc.property(
  arbTree.tree, arbTree.tree, arbTree.tree,
  (a, b, c) => {
    const left = horizontalCompose(horizontalCompose(a, b), c)
    const right = horizontalCompose(a, horizontalCompose(b, c))
    return deepEqual(left, right)
  }
))

// LAW 9: Grammar membership
fc.assert(fc.property(
  arbTree.tree,
  (t) => isInLanguage(G_genifer, t)
))
```

---

## 6. Catalog as Presentation of the Algebra

### 6.1 Generators and Relations

In abstract algebra, an algebra can be specified by **generators** (the basic elements) and **relations** (the equations they satisfy).

For genifer:
- **Generators**: The set of registered component types (DomainCatalog entries)
- **Relations**: The parent-child constraints, prop schemas, visibility conditions

A DomainCatalog registration is literally a *presentation* of a sub-algebra:

```typescript
registerDomainCatalog({
  domain: 'layout',
  components: [
    // Generator: Grid
    { type: 'Grid', schema: GridPropsSchema, acceptsChildren: ['GridItem'] },
    // Generator: GridItem  
    { type: 'GridItem', schema: GridItemPropsSchema, acceptsChildren: true },
  ]
})

// Relations (implicit):
//   Grid ▷ X is valid  iff  X.type = 'GridItem'
//   GridItem ▷ X is valid  for any X ∈ Σ_components
```

### 6.2 Composition of Catalogs

When multiple catalogs are registered, their presentations are combined:

```
G_combined = G_layout ∪ G_charts ∪ G_morphcard ∪ ...
```

This is the coproduct (disjoint union) of the sub-algebras. The union is well-defined because:
- Component types are unique across catalogs (enforced at registration)
- Relations from different catalogs don't conflict (they govern different types)
- Cross-catalog nesting is allowed unless explicitly constrained

---

## 7. Open Questions

1. **Monoidal categories**: The horizontal composition (⊕) makes UIElements a monoid. Can we lift this to a monoidal category where morphisms are tree transformations? This would connect to the categorical composition research (research-categorical-composition.md).

2. **Patch algebra**: When the LLM emits corrections to a previously generated tree, the diff is a *patch*. Patches form a group under composition (applying then reverting). Can we formalize the patch algebra using [ABADI-FOSSACS2015]'s Abelian group framework?

3. **Weighted composition**: Some compositions are "better" than others (e.g., a Grid with 3 items is more balanced than with 1). Can we attach weights (from information theory) to composition operations to guide LLM generation?

4. **Opacity of horizontal composition**: In practice, sibling order often doesn't matter semantically (a flex container with items A, B, C renders the same information as C, B, A). When is ⊕ commutative? When `display: flex` with no `order` property? This relates to the symmetry group of the layout.

---

## References

See [BIBLIOGRAPHY.md](./BIBLIOGRAPHY.md). Key references:

- [ADT-WIKI] — Algebraic data types (sum/product)
- [MANNU-COMPOSABLE2024] — Composable UI contracts (applied ADT for UI)
- [COMON-TATA2007] — Σ-algebras, initial algebras, tree algebras
- [ABADI-FOSSACS2015] — Abelian group structure for patches (future: patch algebra)
- [TSG-DATA-FUSION] — Fusion ontology composition (structural analogy)
