/**
 * Ontology as Code Example
 *
 * Demonstrates scaffolding a complete OaC repository from Axiom schemas.
 *
 * Run: bunx tsx src/lib/axiom/examples/oac-example.ts
 *
 * This will generate a deployable Ontology as Code repository at:
 *   .ontology-repo/
 *
 * Workflow after generation:
 *   1. cd .ontology-repo
 *   2. npm install
 *   3. npm run validate
 *   4. npm run build
 *   5. git init && git add . && git commit -m "Initial ontology"
 *   6. git tag v1.0.0
 *   7. Push to your git remote
 *   8. Install via Foundry Marketplace
 */

import { Effect } from "effect"
import * as A from "../index"
import { scaffoldOntologyRepo, previewOntologyRepo } from "../targets"

// =============================================================================
// Schema Definitions (the Axiom - canonical source of truth)
// =============================================================================

/**
 * Asset type - physical equipment or systems
 */
export const Asset = A.Object(
  "Asset",
  {
    assetId: A.String.pipe(A.primaryKey),
    name: A.String.pipe(A.title, A.displayName("Asset Name")),
    serialNumber: A.String.pipe(A.description("Manufacturer serial number")),
    assetType: A.String.pipe(A.displayName("Asset Type")),
    status: A.String.pipe(A.description("operational, maintenance, retired")),
    location: A.Struct({
      building: A.String,
      floor: A.Int,
      room: A.String.pipe(A.nullable),
    }),
    installDate: A.Date.pipe(A.displayName("Installation Date")),
    lastMaintenanceDate: A.Date.pipe(A.nullable),
    coordinates: A.GeoPoint.pipe(A.nullable),
  },
  {
    displayName: "Asset",
    pluralDisplayName: "Assets",
    description: "Physical equipment and systems",
  }
)

/**
 * Technician type - personnel who perform maintenance
 */
export const Technician = A.Object(
  "Technician",
  {
    technicianId: A.String.pipe(A.primaryKey),
    fullName: A.String.pipe(A.title, A.displayName("Full Name")),
    email: A.String,
    certifications: A.Array(A.String),
    specialties: A.Array(A.String),
    isActive: A.Boolean,
  },
  {
    displayName: "Technician",
    pluralDisplayName: "Technicians",
    description: "Maintenance personnel",
  }
)

/**
 * Work Order type - maintenance tasks
 */
export const WorkOrder = A.Object(
  "WorkOrder",
  {
    workOrderId: A.String.pipe(A.primaryKey),
    title: A.String.pipe(A.title),
    description: A.String,
    priority: A.Int.pipe(A.description("1=Critical, 2=High, 3=Medium, 4=Low")),
    status: A.String.pipe(A.description("open, in_progress, completed, cancelled")),
    createdAt: A.DateTimeUtc,
    completedAt: A.DateTimeUtc.pipe(A.nullable),
    estimatedHours: A.Number.pipe(A.nullable),
    actualHours: A.Number.pipe(A.nullable),
    // Links
    asset: A.link(() => Asset, "many-to-one"),
    technician: A.link(() => Technician, "many-to-one"),
  },
  {
    displayName: "Work Order",
    pluralDisplayName: "Work Orders",
    description: "Maintenance work orders",
  }
)

/**
 * Sensor Reading type - telemetry data
 */
export const SensorReading = A.Object(
  "SensorReading",
  {
    readingId: A.String.pipe(A.primaryKey),
    sensorType: A.String.pipe(A.title, A.displayName("Sensor Type")),
    value: A.Number,
    unit: A.String,
    timestamp: A.DateTimeUtc,
    quality: A.String.pipe(A.description("good, uncertain, bad")),
    // Link to asset
    asset: A.link(() => Asset, "many-to-one"),
  },
  {
    displayName: "Sensor Reading",
    pluralDisplayName: "Sensor Readings",
    description: "Asset sensor telemetry data",
  }
)

// =============================================================================
// Type Inference
// =============================================================================

export type AssetType = A.Infer<typeof Asset>
export type TechnicianType = A.Infer<typeof Technician>
export type WorkOrderType = A.Infer<typeof WorkOrder>
export type SensorReadingType = A.Infer<typeof SensorReading>

// =============================================================================
// Scaffold OaC Repository
// =============================================================================

const schemas = [Asset, Technician, WorkOrder, SensorReading] as const

const program = Effect.gen(function* () {
  console.log("Axiom → Ontology as Code Generator")
  console.log("".padEnd(50, "="))
  console.log()

  // First, preview what will be generated
  console.log("Previewing generated files...")
  const preview = yield* previewOntologyRepo({
    namespace: "com.tmnl.maintenance.",
    outputPath: ".ontology-repo",
    schemas,
    packageName: "@tmnl/maintenance-ontology",
    version: "1.0.0",
    description: "Asset maintenance management ontology",
    author: "TMNL Team",
    includeLinks: true,
  })

  console.log(`\nFiles to generate (${preview.size}):`)
  for (const [path] of preview) {
    console.log(`  - ${path}`)
  }

  console.log("\nScaffolding repository...")
  console.log()

  // Generate the complete repository
  yield* scaffoldOntologyRepo({
    namespace: "com.tmnl.maintenance.",
    outputPath: ".ontology-repo",
    schemas,
    packageName: "@tmnl/maintenance-ontology",
    version: "1.0.0",
    description: "Asset maintenance management ontology",
    author: "TMNL Team",
    includeLinks: true,
  })

  console.log("\nGeneration complete!")
  console.log("")
  console.log("Generated repository structure:")
  console.log("  .ontology-repo/")
  console.log("  ├── package.json")
  console.log("  ├── tsconfig.json")
  console.log("  ├── README.md")
  console.log("  ├── scripts/")
  console.log("  │   └── build.ts")
  console.log("  └── ontology/")
  console.log("      ├── index.ts")
  console.log("      ├── objects/")
  console.log("      │   ├── index.ts")
  console.log("      │   ├── Asset.ts")
  console.log("      │   ├── Technician.ts")
  console.log("      │   ├── WorkOrder.ts")
  console.log("      │   └── SensorReading.ts")
  console.log("      └── links/")
  console.log("          ├── index.ts")
  console.log("          ├── WorkOrderToAsset.ts")
  console.log("          ├── WorkOrderToTechnician.ts")
  console.log("          └── SensorReadingToAsset.ts")
})

// =============================================================================
// Run
// =============================================================================

Effect.runPromise(program).catch((error) => {
  console.error("Scaffold failed:", error)
  process.exit(1)
})
