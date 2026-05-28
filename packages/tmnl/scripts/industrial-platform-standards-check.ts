#!/usr/bin/env bun
/**
 * Lightweight standards traceability gate for the industrial platform RFC pack.
 *
 * This does not certify standards compliance. It verifies that every declared
 * design decision is tied to researched standards sources and proof obligations.
 */

import { existsSync, readFileSync } from 'node:fs'

const ledgerPath = 'src/lib/iiot/docs/industrial-platform/standards-conformance.json'
const matrixPath = 'src/lib/iiot/docs/industrial-platform/STANDARDS-CONFORMANCE-MATRIX.md'
const researchPath = 'src/lib/iiot/docs/industrial-platform/STANDARDS-RESEARCH-LEDGER.md'

type Source = {
  readonly id: string
  readonly standard: string
  readonly evidenceLevel: string
  readonly urls: ReadonlyArray<string>
  readonly summary: string
}

type Decision = {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly sourceIds: ReadonlyArray<string>
  readonly artifacts: ReadonlyArray<string>
  readonly proofObligations: ReadonlyArray<string>
}

type ProofObligation = {
  readonly id: string
  readonly owner: string
  readonly status: string
  readonly kind: string
}

type Ledger = {
  readonly evidenceLevels: ReadonlyArray<string>
  readonly statuses: ReadonlyArray<string>
  readonly sources: ReadonlyArray<Source>
  readonly decisions: ReadonlyArray<Decision>
  readonly proofObligations: ReadonlyArray<ProofObligation>
}

const fail = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const assert = (condition: unknown, message: string): void => {
  if (!condition) fail(message)
}

const unique = (values: ReadonlyArray<string>, label: string): void => {
  const seen = new Set<string>()
  for (const value of values) {
    assert(value.trim().length > 0, `${label} contains blank ID`)
    assert(!seen.has(value), `${label} duplicate ID: ${value}`)
    seen.add(value)
  }
}

assert(existsSync(ledgerPath), `missing ledger: ${ledgerPath}`)
assert(existsSync(matrixPath), `missing matrix: ${matrixPath}`)
assert(existsSync(researchPath), `missing research ledger: ${researchPath}`)

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger
const matrix = readFileSync(matrixPath, 'utf8')
const research = readFileSync(researchPath, 'utf8')

unique(ledger.sources.map((source) => source.id), 'sources')
unique(ledger.decisions.map((decision) => decision.id), 'decisions')
unique(ledger.proofObligations.map((proof) => proof.id), 'proof obligations')

const sourceIds = new Set(ledger.sources.map((source) => source.id))
const proofIds = new Set(ledger.proofObligations.map((proof) => proof.id))
const statuses = new Set(ledger.statuses)
const evidenceLevels = new Set(ledger.evidenceLevels)

for (const source of ledger.sources) {
  assert(source.standard.trim().length > 0, `${source.id} missing standard name`)
  assert(evidenceLevels.has(source.evidenceLevel), `${source.id} has invalid evidence level ${source.evidenceLevel}`)
  assert(source.urls.length > 0, `${source.id} has no source URLs`)
  for (const url of source.urls) assert(/^https?:\/\//.test(url), `${source.id} invalid URL: ${url}`)
  assert(source.summary.trim().length >= 24, `${source.id} summary too thin`)
  assert(research.includes(source.id), `${source.id} missing from research ledger`)
  assert(matrix.includes(source.id), `${source.id} missing from conformance matrix`)
}

for (const decision of ledger.decisions) {
  assert(statuses.has(decision.status), `${decision.id} has invalid status ${decision.status}`)
  assert(decision.sourceIds.length > 0, `${decision.id} cites no standards sources`)
  assert(decision.proofObligations.length > 0, `${decision.id} has no proof obligations`)
  for (const sourceId of decision.sourceIds) assert(sourceIds.has(sourceId), `${decision.id} cites unknown source ${sourceId}`)
  for (const proofId of decision.proofObligations) assert(proofIds.has(proofId), `${decision.id} cites unknown proof obligation ${proofId}`)
  for (const artifact of decision.artifacts) assert(existsSync(artifact), `${decision.id} artifact missing: ${artifact}`)
  assert(matrix.includes(decision.id), `${decision.id} missing from conformance matrix`)
}

for (const proof of ledger.proofObligations) {
  assert(proof.owner.trim().length > 0, `${proof.id} missing owner`)
  assert(proof.status.trim().length > 0, `${proof.id} missing status`)
  assert(proof.kind.trim().length > 0, `${proof.id} missing kind`)
  assert(matrix.includes(proof.id), `${proof.id} missing from conformance matrix`)
}

console.log(`✓ Standards traceability: ${ledger.sources.length} sources, ${ledger.decisions.length} decisions, ${ledger.proofObligations.length} proof obligations`)
