/**
 * Axiom v2 Tests
 *
 * Verify Effect Schema-based ontology definitions and OSDK compilation.
 */

import { describe, it, expect } from "vitest"
import { Effect, Schema } from "effect"
import { ObjectType, Ontology, Target, resolveLinks } from "../index"

// =============================================================================
// Test Schemas (using pure Effect Schema.TaggedClass)
// =============================================================================

class Person extends Schema.TaggedClass<Person>()("Person", {
  id: Schema.String.pipe(Schema.brand("PersonId")),
  name: Schema.NonEmptyString,
  email: Schema.NullOr(Schema.String),
  age: Schema.NullOr(Schema.Number),
}) {}

class Department extends Schema.TaggedClass<Department>()("Department", {
  id: Schema.String.pipe(Schema.brand("DepartmentId")),
  name: Schema.NonEmptyString,
  budget: Schema.NullOr(Schema.Number),
}) {}

class Employee extends Schema.TaggedClass<Employee>()("Employee", {
  employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
  firstName: Schema.String,
  lastName: Schema.String,
  fullName: Schema.NonEmptyString,
  hireDate: Schema.Date,
  isActive: Schema.Boolean,
  salary: Schema.NullOr(Schema.Number),
  departmentId: Schema.String,
}) {}

class AllTypes extends Schema.TaggedClass<AllTypes>()("AllTypes", {
  id: Schema.String.pipe(Schema.brand("AllTypesId")),
  stringField: Schema.String,
  numberField: Schema.Number,
  boolField: Schema.Boolean,
  dateField: Schema.Date,
  timestampField: Schema.DateTimeUtc,
  nullableField: Schema.NullOr(Schema.String),
}) {}

// =============================================================================
// Tests
// =============================================================================

describe("Axiom v2", () => {
  describe("ObjectType.from()", () => {
    it("should wrap a Schema.TaggedClass with OSDK metadata", () => {
      const PersonType = ObjectType.from(Person, {
        primaryKey: "id",
        title: "name",
        displayName: "Person",
        pluralDisplayName: "People",
        description: "A person entity",
      })

      expect(PersonType._tag).toBe("ObjectType")
      expect(PersonType.name).toBe("Person")
      expect(PersonType.config.primaryKey).toBe("id")
      expect(PersonType.config.title).toBe("name")
      expect(PersonType.config.displayName).toBe("Person")
      expect(PersonType.config.pluralDisplayName).toBe("People")
      expect(PersonType.config.description).toBe("A person entity")
    })

    it("should work with minimal config", () => {
      const DeptType = ObjectType.from(Department, {
        primaryKey: "id",
      })

      expect(DeptType._tag).toBe("ObjectType")
      expect(DeptType.config.primaryKey).toBe("id")
      expect(DeptType.config.title).toBeUndefined()
    })

    it("should support links configuration", () => {
      const EmpType = ObjectType.from(Employee, {
        primaryKey: "employeeId",
        title: "fullName",
        links: {
          department: {
            target: () => Department,
            cardinality: "many-to-one",
            foreignKey: "departmentId",
          },
        },
      })

      expect(EmpType.config.links).toBeDefined()
      expect(EmpType.config.links?.department.cardinality).toBe("many-to-one")
      expect(EmpType.config.links?.department.foreignKey).toBe("departmentId")
    })
  })

  describe("Ontology<T>()()", () => {
    // Define test ontology
    class TestOntology extends Ontology<TestOntology>()("com.test.", {
      objects: {
        Person: ObjectType.from(Person, {
          primaryKey: "id",
          title: "name",
          displayName: "Person",
        }),
        Department: ObjectType.from(Department, {
          primaryKey: "id",
          title: "name",
          displayName: "Department",
        }),
        Employee: ObjectType.from(Employee, {
          primaryKey: "employeeId",
          title: "fullName",
          displayName: "Employee",
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

    it("should be usable as Effect service with yield*", async () => {
      const program = Effect.gen(function* () {
        const ontology = yield* TestOntology
        return ontology.namespace
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestOntology.Default))
      )
      expect(result).toBe("com.test.")
    })

    it("should provide object names", async () => {
      const program = Effect.gen(function* () {
        const ontology = yield* TestOntology
        return ontology.objectNames
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestOntology.Default))
      )
      expect(result).toContain("Person")
      expect(result).toContain("Department")
      expect(result).toContain("Employee")
    })

    it("should resolve links", async () => {
      const program = Effect.gen(function* () {
        const ontology = yield* TestOntology
        return ontology.links
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestOntology.Default))
      )
      expect(result.length).toBe(1)
      expect(result[0].sourceName).toBe("Employee")
      expect(result[0].targetName).toBe("Department")
      expect(result[0].propertyName).toBe("department")
    })

    it("should get objects by name", async () => {
      const program = Effect.gen(function* () {
        const ontology = yield* TestOntology
        return ontology.getObject("Person")
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestOntology.Default))
      )
      expect(result).toBeDefined()
      expect(result!.name).toBe("Person")
    })

    it("should have static namespace property", () => {
      expect(TestOntology.namespace).toBe("com.test.")
    })

    it("should have static Tag property", () => {
      expect(TestOntology.Tag).toBeDefined()
    })

    it("should have Default layer", () => {
      expect(TestOntology.Default).toBeDefined()
    })
  })

  describe("resolveLinks()", () => {
    it("should resolve links from ObjectTypeDefs", () => {
      const objects = new Map([
        [
          "Employee",
          ObjectType.from(Employee, {
            primaryKey: "employeeId",
            links: {
              department: {
                target: () => Department,
                cardinality: "many-to-one",
                foreignKey: "departmentId",
              },
            },
          }),
        ],
        [
          "Department",
          ObjectType.from(Department, {
            primaryKey: "id",
          }),
        ],
      ])

      const links = resolveLinks(objects)

      expect(links.length).toBe(1)
      expect(links[0].apiName).toBe("EmployeeToDepartment")
      expect(links[0].sourceName).toBe("Employee")
      expect(links[0].targetName).toBe("Department")
      expect(links[0].cardinality).toBe("many-to-one")
    })
  })

  describe("Target.OSDK", () => {
    it("should compile ObjectTypeDef to OSDK definition", async () => {
      const personType = ObjectType.from(Person, {
        primaryKey: "id",
        title: "name",
        displayName: "Person",
        pluralDisplayName: "People",
      })

      const result = await Effect.runPromise(Target.OSDK.compileObject(personType))

      expect(result.apiName).toBe("Person")
      expect(result.displayName).toBe("Person")
      expect(result.pluralDisplayName).toBe("People")
      expect(result.primaryKeyPropertyApiName).toBe("id")
      expect(result.titlePropertyApiName).toBe("name")
      expect(result.properties.id.type).toBe("string")
      expect(result.properties.name.type).toBe("string")
      expect(result.properties.email?.nullable).toBe(true)
    })

    it("should compile ontology to OSDK output", async () => {
      class MiniOntology extends Ontology<MiniOntology>()("com.mini.", {
        objects: {
          Person: ObjectType.from(Person, {
            primaryKey: "id",
            title: "name",
          }),
        },
      }) {}

      const program = Effect.gen(function* () {
        const ontology = yield* MiniOntology
        return yield* Target.OSDK.compile(ontology)
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(MiniOntology.Default))
      )

      expect(result.objects.length).toBe(1)
      expect(result.objects[0].apiName).toBe("Person")
    })

    it("should generate @osdk/maker code", async () => {
      class MiniOntology extends Ontology<MiniOntology>()("com.mini.", {
        objects: {
          Person: ObjectType.from(Person, {
            primaryKey: "id",
            title: "name",
          }),
        },
      }) {}

      const program = Effect.gen(function* () {
        const ontology = yield* MiniOntology
        return yield* Target.OSDK.generate(ontology)
      })

      const code = await Effect.runPromise(
        program.pipe(Effect.provide(MiniOntology.Default))
      )

      expect(code).toContain('import { defineOntology, defineObject, defineLink } from "@osdk/maker"')
      expect(code).toContain('apiName: "Person"')
      expect(code).toContain('primaryKeyPropertyApiName: "id"')
    })

    it("should map all Effect Schema types to OSDK", async () => {
      const allTypesType = ObjectType.from(AllTypes, {
        primaryKey: "id",
      })

      const result = await Effect.runPromise(Target.OSDK.compileObject(allTypesType))

      expect(result.properties.id.type).toBe("string")
      expect(result.properties.stringField.type).toBe("string")
      expect(result.properties.numberField.type).toBe("decimal")
      expect(result.properties.boolField.type).toBe("boolean")
      expect(result.properties.dateField.type).toBe("string") // Effect Date → string
      expect(result.properties.timestampField.type).toBe("string") // DateTimeUtc → string
      expect(result.properties.nullableField.nullable).toBe(true)
    })
  })

  describe("Target.OaC", () => {
    it("should preview OaC repository files", async () => {
      class MiniOntology extends Ontology<MiniOntology>()("com.mini.", {
        objects: {
          Person: ObjectType.from(Person, {
            primaryKey: "id",
            title: "name",
          }),
        },
      }) {}

      const program = Effect.gen(function* () {
        const ontology = yield* MiniOntology
        return yield* Target.OaC.preview(ontology, {
          packageName: "@test/ontology",
          version: "1.0.0",
        })
      })

      const files = await Effect.runPromise(
        program.pipe(Effect.provide(MiniOntology.Default))
      )

      expect(files.has("package.json")).toBe(true)
      expect(files.has("tsconfig.json")).toBe(true)
      expect(files.has("ontology/objects/Person.ts")).toBe(true)
      expect(files.has("ontology/index.ts")).toBe(true)
    })
  })

  describe("Type Inference", () => {
    it("should infer types from Schema.TaggedClass", () => {
      // Type-level test: these should compile
      type PersonType = typeof Person.Type

      // Runtime assertion for type structure
      const person: PersonType = {
        _tag: "Person",
        id: "123" as typeof Person.Type.id,
        name: "John" as typeof Person.Type.name,
        email: "john@example.com",
        age: 30,
      }
      expect(person.id).toBe("123")
      expect(person._tag).toBe("Person")
    })
  })
})
