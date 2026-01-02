/**
 * Axiom v2 Example - Ontology Definition
 *
 * Demonstrates the new Effect-native API:
 * - Schema.TaggedClass for pure Effect schemas
 * - ObjectType.from() for OSDK metadata
 * - Ontology<T>()() for service composition
 * - Target.OSDK and Target.OaC for compilation
 *
 * Run: bunx tsx src/lib/axiom/examples/ontology.ts
 */

import { Schema, Effect } from "effect"
import { Ontology, ObjectType, Target } from "../index"

// =============================================================================
// 1. Define Pure Effect Schemas
// =============================================================================

/**
 * Department - organizational unit
 */
class Department extends Schema.TaggedClass<Department>()("Department", {
  id: Schema.String.pipe(Schema.brand("DepartmentId")),
  name: Schema.NonEmptyString,
  code: Schema.String,
  budget: Schema.NullOr(Schema.Number),
  createdAt: Schema.DateTimeUtc,
}) {}

/**
 * Employee - company personnel
 */
class Employee extends Schema.TaggedClass<Employee>()("Employee", {
  employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
  firstName: Schema.String,
  lastName: Schema.String,
  fullName: Schema.NonEmptyString,
  email: Schema.String,
  hireDate: Schema.Date,
  salary: Schema.NullOr(Schema.Number),
  isActive: Schema.Boolean,
  departmentId: Schema.String, // Foreign key
}) {}

/**
 * Project - company initiative
 */
class Project extends Schema.TaggedClass<Project>()("Project", {
  projectId: Schema.String.pipe(Schema.brand("ProjectId")),
  name: Schema.NonEmptyString,
  description: Schema.NullOr(Schema.String),
  startDate: Schema.Date,
  endDate: Schema.NullOr(Schema.Date),
  status: Schema.Literal("active", "completed", "on-hold"),
}) {}

/**
 * Assignment - employee ↔ project junction
 */
class Assignment extends Schema.TaggedClass<Assignment>()("Assignment", {
  assignmentId: Schema.String.pipe(Schema.brand("AssignmentId")),
  role: Schema.NonEmptyString,
  hoursPerWeek: Schema.NullOr(Schema.Number),
  startDate: Schema.Date,
  endDate: Schema.NullOr(Schema.Date),
  employeeId: Schema.String,
  projectId: Schema.String,
}) {}

// =============================================================================
// 2. Create Ontology Service
// =============================================================================

/**
 * Example ontology with departments, employees, projects, and assignments
 */
class ExampleOntology extends Ontology<ExampleOntology>()("com.tmnl.example.", {
  objects: {
    Department: ObjectType.from(Department, {
      primaryKey: "id",
      title: "name",
      displayName: "Department",
      pluralDisplayName: "Departments",
      description: "Organizational departments",
    }),

    Employee: ObjectType.from(Employee, {
      primaryKey: "employeeId",
      title: "fullName",
      displayName: "Employee",
      pluralDisplayName: "Employees",
      description: "Company employees",
      links: {
        department: {
          target: () => Department,
          cardinality: "many-to-one",
          foreignKey: "departmentId",
        },
      },
    }),

    Project: ObjectType.from(Project, {
      primaryKey: "projectId",
      title: "name",
      displayName: "Project",
      pluralDisplayName: "Projects",
      description: "Company projects",
    }),

    Assignment: ObjectType.from(Assignment, {
      primaryKey: "assignmentId",
      title: "role",
      displayName: "Assignment",
      pluralDisplayName: "Assignments",
      description: "Employee project assignments",
      links: {
        employee: {
          target: () => Employee,
          cardinality: "many-to-one",
          foreignKey: "employeeId",
        },
        project: {
          target: () => Project,
          cardinality: "many-to-one",
          foreignKey: "projectId",
        },
      },
    }),
  },
}) {}

// =============================================================================
// 3. Type Inference (from Effect Schema)
// =============================================================================

// These types are inferred from the Effect Schema definitions
type DepartmentType = typeof Department.Type
type EmployeeType = typeof Employee.Type
type ProjectType = typeof Project.Type
type AssignmentType = typeof Assignment.Type

// =============================================================================
// 4. Compile and Generate
// =============================================================================

const program = Effect.gen(function* () {
  // Access ontology as service
  const ontology = yield* ExampleOntology

  console.log("Axiom v2 - Ontology Definition Example")
  console.log("".padEnd(50, "="))
  console.log()

  console.log(`Namespace: ${ontology.namespace}`)
  console.log(`Objects: ${ontology.objectNames.join(", ")}`)
  console.log(`Links: ${ontology.links.length}`)
  console.log()

  // Compile to OSDK
  console.log("Compiling to OSDK...")
  const osdkOutput = yield* Target.OSDK.compile(ontology)
  console.log(`  Objects compiled: ${osdkOutput.objects.length}`)
  console.log(`  Links compiled: ${osdkOutput.links.length}`)
  console.log()

  // Generate code
  console.log("Generated @osdk/maker code:")
  console.log("─".repeat(60))
  const code = yield* Target.OSDK.generate(ontology)
  console.log(code)
  console.log("─".repeat(60))

  // Preview OaC files
  console.log("\nPreview OaC repository files:")
  const files = yield* Target.OaC.preview(ontology, {
    packageName: "@tmnl/example-ontology",
    version: "1.0.0",
  })
  for (const [path] of files) {
    console.log(`  - ${path}`)
  }

  console.log("\nTo scaffold the repository, uncomment:")
  console.log('  yield* Target.OaC.scaffold(ontology, ".ontology-repo")')
})

// =============================================================================
// 5. Run
// =============================================================================

Effect.runPromise(program.pipe(Effect.provide(ExampleOntology.Default))).catch(
  (error) => {
    console.error("Failed:", error)
    process.exit(1)
  }
)
