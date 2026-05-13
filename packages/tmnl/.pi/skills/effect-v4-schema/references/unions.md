# Unions and Tagged Unions

> up: INDEX.md
> prereqs: elementary.md, classes.md
> provides: union, tagged-union, discriminated-union, matching

⚠️ **v4: `Schema.Union` takes an ARRAY, not variadic args.**

## Basic Union

```ts
import { Schema } from "effect"

// v3 WRONG: Schema.Union(Schema.String, Schema.Number)
// v4:
const StringOrNumber = Schema.Union([Schema.String, Schema.Number])
```

## Tagged Unions (Discriminated)

The fast path. Schema checks `_tag` first — O(1) dispatch, not O(n) trial-and-error.

```ts
class Cat extends Schema.TaggedClass<Cat>()("Cat", { lives: Schema.Number }) {}
class Dog extends Schema.TaggedClass<Dog>()("Dog", { wagsTail: Schema.Boolean }) {}
class Fish extends Schema.TaggedClass<Fish>()("Fish", { color: Schema.String }) {}

const Animal = Schema.Union([Cat, Dog, Fish])

Schema.decodeUnknownSync(Animal)({ _tag: "Dog", wagsTail: true })
// Dog { _tag: 'Dog', wagsTail: true }
```

### Accessing Members by Tag

```ts
// Get the Cat member schema from the union
const CatFromUnion = Animal.members.find(m => m._tag === "Cat")
```

### Matching on Tag

```ts
// Pattern match — exhaustive
function describe(animal: typeof Animal.Type): string {
  switch (animal._tag) {
    case "Cat": return `Cat with ${animal.lives} lives`
    case "Dog": return animal.wagsTail ? "Happy dog" : "Sad dog"
    case "Fish": return `${animal.color} fish`
  }
}
```

### Augmenting Tagged Unions

```ts
class Bird extends Schema.TaggedClass<Bird>()("Bird", { canFly: Schema.Boolean }) {}

// Add a member
const ExtendedAnimal = Schema.Union([...Animal.members, Bird])
```

## Union of Literals

```ts
const Color = Schema.Literals(["red", "green", "blue"])

// Derive new literals from existing
const Warm = Color.pick(["red"])
```

## Exclusive Unions

By default, if a value matches multiple members, the first match wins. Exclusive unions reject ambiguous values:

```ts
const Exclusive = Schema.Union([Schema.String, Schema.Number], { exclusive: true })
```

## Excluding Incompatible Members

```ts
// Only keep members whose Encoded type extends { readonly _tag: string }
const TaggedOnly = Animal.members.filter(m => "_tag" in m.fields)
```
