/**
 * Generate ontology.json from Axiom schemas
 *
 * Run: bunx tsx src/lib/axiom/examples/generate-ontology.ts
 */

import * as fs from "fs"
import { Effect } from "effect"
import * as A from "../index"
import { compileAllToOSDK, generateOntologyFile } from "../targets"

// Schema definitions
const Department = A.Object("Department", {
  id: A.String.pipe(A.primaryKey),
  name: A.String.pipe(A.title, A.displayName("Department Name")),
  code: A.String.pipe(A.description("Unique department code")),
  budget: A.Number.pipe(A.nullable, A.displayName("Annual Budget")),
  createdAt: A.DateTimeUtc,
})

const Employee = A.Object("Employee", {
  employeeId: A.String.pipe(A.primaryKey),
  firstName: A.String.pipe(A.displayName("First Name")),
  lastName: A.String.pipe(A.displayName("Last Name")),
  fullName: A.String.pipe(A.title, A.displayName("Full Name")),
  email: A.String.pipe(A.description("Work email address")),
  hireDate: A.Date.pipe(A.displayName("Hire Date")),
  salary: A.Number.pipe(A.nullable),
  isActive: A.Boolean,
  department: A.link(() => Department, "many-to-one"),
})

const schemas = [Department, Employee] as const

const program = Effect.gen(function* () {
  // Compile to OSDK format
  const osdkDefs = yield* compileAllToOSDK(schemas)

  // Generate @osdk/maker code
  const makerCode = yield* generateOntologyFile({
    namespace: "com.tmnl.",
    schemas,
    includeLinks: true,
  })

  // Create output directory
  fs.mkdirSync(".ontology", { recursive: true })

  // Write OSDK definitions as JSON
  fs.writeFileSync(
    ".ontology/osdk-definitions.json",
    JSON.stringify(osdkDefs, null, 2)
  )
  console.log("✅ Written: .ontology/osdk-definitions.json")

  // Write @osdk/maker code
  fs.writeFileSync(".ontology/ontology.ts", makerCode)
  console.log("✅ Written: .ontology/ontology.ts")

  console.log("\nNext steps:")
  console.log("1. Run: npx @osdk/maker -i .ontology/ontology.ts -o .ontology/ontology.json")
  console.log("2. Export your Foundry ontology to compare formats")
  console.log("3. Transform ontology.json to match Foundry format if needed")
  console.log("4. Import into Foundry via Ontology Manager → Advanced → Import")

  return osdkDefs
})

Effect.runPromise(program).catch(console.error)
