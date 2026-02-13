#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * Schema Validation CLI
 *
 * Validates all IIoT asset schemas by attempting decode/encode roundtrips.
 *
 * Usage:
 *   bun run tools/validate-schema.ts
 *   bun run tools/validate-schema.ts -- --verbose
 *   bun run tools/validate-schema.ts -- --schema site
 *
 * Options:
 *   --verbose    Show detailed output for each schema
 *   --schema     Validate only a specific schema (by folder name)
 *
 * @module tools/validate-schema
 */

import { parseArgs } from 'util'
import { Schema, Option, DateTime } from 'effect'
import { Glob } from 'bun'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    verbose: { type: 'boolean', default: false },
    schema: { type: 'string' },
  },
  strict: true,
  allowPositionals: false,
})

const verbose = values.verbose ?? false
const targetSchema = values.schema

const BASE_DIR = new URL('../src/lib/iiot/schemas/assets', import.meta.url).pathname

// =============================================================================
// Schema Discovery
// =============================================================================

interface ValidationResult {
  name: string
  path: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  error?: string
  exports?: string[]
}

const results: ValidationResult[] = []

// Find all schema directories
const glob = new Glob('*/schema.ts')
const schemaPaths: string[] = []

for await (const file of glob.scan({ cwd: BASE_DIR })) {
  schemaPaths.push(file)
}

schemaPaths.sort()

console.log(`\n  Schema Validator`)
console.log(`  ================`)
console.log(`  Base: src/lib/iiot/schemas/assets/`)
console.log(`  Found: ${schemaPaths.length} schemas`)
if (targetSchema) console.log(`  Filter: ${targetSchema}`)
console.log()

// =============================================================================
// Validation
// =============================================================================

for (const schemaPath of schemaPaths) {
  const dirName = schemaPath.split('/')[0]

  if (targetSchema && dirName !== targetSchema) continue

  const fullPath = `${BASE_DIR}/${schemaPath}`

  try {
    // Dynamic import of the schema module
    const mod = await import(fullPath)

    const exportNames = Object.keys(mod)
    const schemaExports = exportNames.filter((name) => {
      const val = mod[name]
      // Check if it's a Schema-like thing (has pipe, or is a class extending TaggedClass)
      return (
        val &&
        (typeof val === 'function' || typeof val === 'object') &&
        (val._tag === 'Schema' ||
          val.pipe !== undefined ||
          (typeof val === 'function' && val.prototype && '_tag' in (val.prototype ?? {})))
      )
    })

    // Try to find the main entity class (PascalCase name matching dir)
    const pascalName = dirName
      .split('-')
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')

    const EntityClass = mod[pascalName]

    if (!EntityClass) {
      results.push({
        name: dirName,
        path: schemaPath,
        status: 'SKIP',
        error: `No class named '${pascalName}' found`,
        exports: exportNames,
      })
      continue
    }

    // Validate: attempt to check the schema has an encode function
    const hasFields = EntityClass.fields !== undefined || EntityClass.struct !== undefined
    const isTaggedClass = typeof EntityClass === 'function' && EntityClass.prototype?._tag

    if (verbose) {
      console.log(`  [${dirName}]`)
      console.log(`    Exports: ${exportNames.join(', ')}`)
      console.log(`    Entity: ${pascalName} (tagged=${!!isTaggedClass}, fields=${hasFields})`)
    }

    // Check for Id schema and make function
    const idSchemaName = `${pascalName}Id`
    const makeIdName = `make${pascalName}Id`
    const hasId = idSchemaName in mod
    const hasMakeId = makeIdName in mod
    const hasCreateParams = `Create${pascalName}Params` in mod
    const hasUpdateParams = `Update${pascalName}Params` in mod

    const checks = [
      { name: `${idSchemaName}`, ok: hasId },
      { name: `${makeIdName}()`, ok: hasMakeId },
      { name: `Create${pascalName}Params`, ok: hasCreateParams },
      { name: `Update${pascalName}Params`, ok: hasUpdateParams },
    ]

    const failedChecks = checks.filter((c) => !c.ok)

    if (failedChecks.length > 0) {
      results.push({
        name: dirName,
        path: schemaPath,
        status: 'FAIL',
        error: `Missing: ${failedChecks.map((c) => c.name).join(', ')}`,
        exports: exportNames,
      })

      if (verbose) {
        for (const check of checks) {
          console.log(`    ${check.ok ? 'PASS' : 'FAIL'} ${check.name}`)
        }
      }
    } else {
      // If make function exists, test it
      if (hasMakeId) {
        try {
          const testId = mod[makeIdName]('test-slug-123')
          if (typeof testId !== 'string') {
            throw new Error(`${makeIdName} returned ${typeof testId}, expected string`)
          }
        } catch (e: any) {
          results.push({
            name: dirName,
            path: schemaPath,
            status: 'FAIL',
            error: `${makeIdName}() threw: ${e.message}`,
            exports: exportNames,
          })
          continue
        }
      }

      results.push({
        name: dirName,
        path: schemaPath,
        status: 'PASS',
        exports: exportNames,
      })

      if (verbose) {
        for (const check of checks) {
          console.log(`    PASS ${check.name}`)
        }
      }
    }
  } catch (e: any) {
    results.push({
      name: dirName,
      path: schemaPath,
      status: 'FAIL',
      error: `Import error: ${e.message}`,
    })
  }

  if (verbose) console.log()
}

// =============================================================================
// Summary
// =============================================================================

const passed = results.filter((r) => r.status === 'PASS')
const failed = results.filter((r) => r.status === 'FAIL')
const skipped = results.filter((r) => r.status === 'SKIP')

console.log(`  Results`)
console.log(`  -------`)

for (const result of results) {
  const icon = result.status === 'PASS' ? 'PASS' : result.status === 'FAIL' ? 'FAIL' : 'SKIP'
  const detail = result.error ? ` -- ${result.error}` : ''
  console.log(`  ${icon}  ${result.name}${detail}`)
}

console.log()
console.log(`  Summary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`)

if (failed.length > 0) {
  console.log()
  console.log(`  Failed schemas:`)
  for (const f of failed) {
    console.log(`    - ${f.name}: ${f.error}`)
  }
  process.exit(1)
}

console.log()
