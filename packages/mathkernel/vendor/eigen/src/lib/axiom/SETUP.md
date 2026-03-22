# Axiom v2: Effect-Native Ontology Definitions

## Overview

Axiom v2 is an Effect-native ontology framework that compiles to Palantir OSDK. It uses pure Effect Schema for type definitions and provides an Effect.Service-style API for ontology composition.

```
┌─────────────────────────────────────────────────────────────┐
│              Effect Schema.TaggedClass                       │
│   class Department extends Schema.TaggedClass<Department>()  │
│     ("Department", { id: Schema.String, name: Schema.String })│
└─────────────────────────────────────────────────────────────┘
                            │
                   ObjectType.from()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ontology<T>()                            │
│   class MyOntology extends Ontology<MyOntology>()("ns", {   │
│     objects: { Department: ObjectType.from(Department, {})  │
│   })                                                        │
└─────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
   ┌──────────────┐                    ┌──────────────┐
   │ Target.OSDK  │                    │  Target.OaC  │
   │  compile()   │                    │  scaffold()  │
   └──────────────┘                    └──────────────┘
```

## Installation

```bash
# Axiom is part of TMNL, but OSDK packages are separate
bun add @osdk/maker @osdk/client @osdk/api @osdk/oauth
```

## Quick Start

### 1. Define Pure Effect Schemas

```typescript
import { Schema } from "effect"

// Pure Effect Schema.TaggedClass - no Axiom imports needed
class Department extends Schema.TaggedClass<Department>()("Department", {
  id: Schema.String.pipe(Schema.brand("DepartmentId")),
  name: Schema.NonEmptyString,
  budget: Schema.NullOr(Schema.Number),
}) {}

class Employee extends Schema.TaggedClass<Employee>()("Employee", {
  employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
  fullName: Schema.NonEmptyString,
  email: Schema.String,
  hireDate: Schema.Date,
  departmentId: Schema.String, // Foreign key
}) {}

// Type inference from Effect Schema
type EmployeeType = typeof Employee.Type
```

### 2. Wrap with ObjectType for OSDK Metadata

```typescript
import { ObjectType } from "@/lib/axiom"

const DepartmentType = ObjectType.from(Department, {
  primaryKey: "id",
  title: "name",
  displayName: "Department",
  pluralDisplayName: "Departments",
})

const EmployeeType = ObjectType.from(Employee, {
  primaryKey: "employeeId",
  title: "fullName",
  displayName: "Employee",
  pluralDisplayName: "Employees",
  links: {
    department: {
      target: () => Department,
      cardinality: "many-to-one",
      foreignKey: "departmentId",
    },
  },
})
```

### 3. Create Ontology Service

```typescript
import { Effect } from "effect"
import { Ontology, ObjectType, Target } from "@/lib/axiom"

class MyOntology extends Ontology<MyOntology>()("com.mycompany.", {
  objects: {
    Department: ObjectType.from(Department, {
      primaryKey: "id",
      title: "name",
    }),
    Employee: ObjectType.from(Employee, {
      primaryKey: "employeeId",
      title: "fullName",
      links: {
        department: {
          target: () => Department,
          cardinality: "many-to-one",
          foreignKey: "departmentId",
        },
      },
    }),
  },
}) {}

// Use as Effect Service
const program = Effect.gen(function* () {
  const ontology = yield* MyOntology

  console.log(`Namespace: ${ontology.namespace}`)
  console.log(`Objects: ${ontology.objectNames.join(", ")}`)
  console.log(`Links: ${ontology.links.length}`)

  // Compile to OSDK
  const output = yield* Target.OSDK.compile(ontology)
  console.log(`Compiled ${output.objects.length} objects`)

  // Generate code
  const code = yield* Target.OSDK.generate(ontology)
  console.log(code)
})

Effect.runPromise(program.pipe(Effect.provide(MyOntology.Default)))
```

## Palantir Foundry Integration

### Option 1: Ontology as Code (Recommended)

Scaffold a complete OaC repository for Foundry Marketplace deployment:

```typescript
import { Effect } from "effect"
import { Ontology, ObjectType, Target } from "@/lib/axiom"

// Define ontology (as above)
class MyOntology extends Ontology<MyOntology>()("com.mycompany.", {
  objects: { /* ... */ },
}) {}

// Scaffold repository
const program = Effect.gen(function* () {
  const ontology = yield* MyOntology
  yield* Target.OaC.scaffold(ontology, "./my-ontology", {
    packageName: "@mycompany/ontology",
    version: "1.0.0",
  })
})

await Effect.runPromise(program.pipe(Effect.provide(MyOntology.Default)))
```

#### Deployment Workflow

1. **Scaffold repository**:
   ```bash
   bunx tsx src/lib/axiom/examples/ontology.ts
   ```

2. **Set up the repository**:
   ```bash
   cd .ontology-repo
   npm install
   npm run validate  # TypeScript type check
   npm run build     # Generate OSDK output
   ```

3. **Initialize Git and tag**:
   ```bash
   git init
   git add .
   git commit -m "Initial ontology"
   git tag v1.0.0
   ```

4. **Connect to Foundry**:
   - In Foundry, go to Ontology Manager -> New -> Ontology as Code repository
   - Connect your Git repository
   - The ontology will sync automatically on each tagged release

5. **Install via Marketplace**:
   - Your ontology appears as a Marketplace product
   - Click "Install" to deploy to your Foundry instance

### Option 2: Direct Code Generation

Generate @osdk/maker code without repository scaffolding:

```typescript
const program = Effect.gen(function* () {
  const ontology = yield* MyOntology
  const code = yield* Target.OSDK.generate(ontology)
  // Save to file and run with @osdk/maker
})
```

## API Reference

### ObjectType.from()

Wraps an Effect Schema.TaggedClass with OSDK metadata:

```typescript
ObjectType.from(Schema, {
  primaryKey: "fieldName",        // Required: primary key field
  title?: "fieldName",            // Optional: title field for display
  displayName?: "Human Name",     // Optional: singular display name
  pluralDisplayName?: "Names",    // Optional: plural display name
  description?: "Description",    // Optional: description text
  links?: {                       // Optional: link definitions
    linkName: {
      target: () => TargetSchema, // Lazy reference to target
      cardinality: "many-to-one", // Link cardinality
      foreignKey?: "fieldName",   // Foreign key field
    },
  },
})
```

### Ontology<T>()()

Creates an Effect.Service-style ontology class:

```typescript
class MyOntology extends Ontology<MyOntology>()("namespace.", {
  objects: {
    Name: ObjectType.from(Schema, config),
  },
}) {}

// Static properties
MyOntology.namespace    // "namespace."
MyOntology.Tag          // Context.Tag for DI
MyOntology.Default      // Layer.Layer<MyOntology>

// Usage in Effect.gen
const ontology = yield* MyOntology
ontology.namespace      // string
ontology.objectNames    // readonly string[]
ontology.objects        // ReadonlyMap<string, ObjectTypeDef>
ontology.links          // readonly ResolvedLink[]
ontology.getObject(name) // ObjectTypeDef | undefined
```

### Target.OSDK

```typescript
// Compile ontology to OSDK output
Target.OSDK.compile(ontology)
// Effect<{ objects: OSDKObjectDefinition[], links: OSDKLinkDefinition[] }, CompileError>

// Generate @osdk/maker code
Target.OSDK.generate(ontology)
// Effect<string, CompileError>

// Compile single ObjectTypeDef
Target.OSDK.compileObject(objectTypeDef)
// Effect<OSDKObjectDefinition, CompileError>
```

### Target.OaC

```typescript
// Scaffold complete repository
Target.OaC.scaffold(ontology, outputPath, options?)
// Effect<void, Error>

// Preview files without writing
Target.OaC.preview(ontology, options?)
// Effect<Map<string, string>, CompileError>
```

## Effect Schema to OSDK Type Mapping

| Effect Schema | OSDK Type | Notes |
|--------------|-----------|-------|
| `Schema.String` | `string` | |
| `Schema.Number` | `decimal` | |
| `Schema.Boolean` | `boolean` | |
| `Schema.Date` | `string` | ISO date format |
| `Schema.DateTimeUtc` | `string` | ISO datetime format |
| `Schema.NullOr(T)` | `T` with `nullable: true` | |
| `Schema.brand(name)` | `string` | Branded types as string |
| `Schema.NonEmptyString` | `string` | |
| `Schema.Literal(...)` | `string` | |

## Link Cardinalities

```typescript
type LinkCardinality =
  | "one-to-one"     // Single reference, single back-reference
  | "one-to-many"    // Single reference, multiple back-references
  | "many-to-one"    // Multiple references, single back-reference
  | "many-to-many"   // Multiple references, multiple back-references
```

## Error Handling

All Target functions return `Effect<T, CompileError>`:

```typescript
import { Effect, Exit } from "effect"

const result = await Effect.runPromiseExit(
  program.pipe(Effect.provide(MyOntology.Default))
)

if (Exit.isSuccess(result)) {
  console.log("Success:", result.value)
} else {
  console.error("Error:", result.cause)
}
```

## File Structure

```
src/lib/axiom/
├── index.ts           # Barrel export
├── ontology.ts        # Ontology<T>()() factory
├── object-type.ts     # ObjectType.from() wrapper
├── link.ts            # Link types and resolvers
├── errors.ts          # CompileError types
├── examples/
│   └── ontology.ts    # Complete example
├── targets/
│   ├── index.ts       # Target.OSDK, Target.OaC
│   ├── osdk.ts        # OSDK compiler
│   └── oac.ts         # OaC repository scaffolder
├── v1/                # Archived v1 API (reference only)
│   ├── primitives.ts
│   ├── modifiers.ts
│   ├── object.ts
│   └── types.ts
└── __tests__/
    └── axiom.test.ts  # Test suite
```

## Running the Example

```bash
bunx tsx src/lib/axiom/examples/ontology.ts
```

This will:
1. Define schemas using Effect Schema.TaggedClass
2. Create an Ontology service
3. Compile to OSDK format
4. Generate @osdk/maker code
5. Preview OaC repository files

## Migration from v1

The v1 API (`A.Object`, `A.String`, `A.pipe`, etc.) has been archived to `v1/`. Here's how to migrate:

```typescript
// v1 (Archived)
const Dept = A.Object("Department", {
  id: A.String.pipe(A.primaryKey),
  name: A.String.pipe(A.title),
})

// v2 (Current)
class Department extends Schema.TaggedClass<Department>()("Department", {
  id: Schema.String.pipe(Schema.brand("DepartmentId")),
  name: Schema.NonEmptyString,
}) {}

const DepartmentType = ObjectType.from(Department, {
  primaryKey: "id",
  title: "name",
})
```

Key changes:
- Use pure Effect Schema.TaggedClass for type definitions
- Use ObjectType.from() to attach OSDK metadata
- Use Ontology<T>()() to compose as Effect Service
- Use Target.OSDK and Target.OaC for compilation
