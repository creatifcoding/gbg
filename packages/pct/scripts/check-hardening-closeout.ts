#!/usr/bin/env bun
/**
 * Hardening docs closeout gate.
 *
 * Checks the PCT hardening docs spine, validates relative links, and verifies
 * lane closeout documents include the required closeout sections.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

interface CheckResult {
  readonly ok: boolean
  readonly label: string
  readonly detail?: string
}

interface Args {
  readonly files: ReadonlyArray<string>
  readonly json: boolean
  readonly help: boolean
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pctRoot = resolve(scriptDir, "..")
const hardeningDir = resolve(pctRoot, "docs/hardening")

const requiredDocs = [
  "docs/hardening/README.md",
  "docs/hardening/closeout-template.md",
  "docs/hardening/validation-ledger.md",
  "docs/hardening/boundary-contracts.md",
  "docs/hardening/staging-hygiene.md",
  "docs/hardening/docs-closeout-gate.md",
] as const

const closeoutSections = [
  "## 1. Verdict",
  "## 2. Scope and non-goals",
  "## 3. Boundary review",
  "## 4. Implementation map",
  "## 5. Public API and compatibility notes",
  "## 6. Validation commands",
  "## 7. Operational evidence",
  "## 8. Failure modes and recovery",
  "## 9. Known gaps and follow-ups",
  "## 10. Workspace hygiene proof",
  "## 11. Final operator notes",
] as const

const usage = `Usage:
  bun scripts/check-hardening-closeout.ts [--file <path>] [--json]

Defaults:
  - validates the hardening docs spine under docs/hardening
  - validates all docs/hardening/*-closeout.md files except closeout-template.md

Examples:
  bun run hardening:docs:check
  bun scripts/check-hardening-closeout.ts --file docs/hardening/diagnostics-closeout.md
`

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const files: string[] = []
  let json = false
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }
    if (arg === "--json") {
      json = true
      continue
    }
    if (arg === "--file") {
      const file = argv[index + 1]
      if (file === undefined) throw new Error("--file requires a path")
      files.push(file)
      index += 1
      continue
    }
    throw new Error(`unknown argument: ${arg}`)
  }

  return { files, json, help }
}

const toPctRelative = (absolutePath: string): string => relative(pctRoot, absolutePath).replaceAll("\\", "/")

const read = (path: string): string => readFileSync(path, "utf8")

const pass = (label: string, detail?: string): CheckResult => ({ ok: true, label, detail })
const fail = (label: string, detail?: string): CheckResult => ({ ok: false, label, detail })

const isExternalLink = (href: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")

const splitHref = (href: string): string => href.split("#")[0]?.split("?")[0] ?? ""

const extractMarkdownLinks = (text: string): ReadonlyArray<string> => {
  const links: string[] = []
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawHref = match[1]?.trim()
    if (!rawHref) continue
    const href = rawHref.replace(/^<|>$/g, "").split(/\s+["']/)[0] ?? ""
    if (href.length > 0) links.push(href)
  }
  return links
}

const checkRequiredDocs = (): ReadonlyArray<CheckResult> =>
  requiredDocs.map((doc) => {
    const absolutePath = resolve(pctRoot, doc)
    return existsSync(absolutePath)
      ? pass(`required doc exists: ${doc}`)
      : fail(`required doc missing: ${doc}`)
  })

const checkRelativeLinks = (file: string): CheckResult => {
  const absolutePath = resolve(pctRoot, file)
  if (!existsSync(absolutePath)) return fail(`links: ${file}`, "file does not exist")

  const base = dirname(absolutePath)
  const links = extractMarkdownLinks(read(absolutePath))
  const missing = links
    .filter((href) => !href.startsWith("#") && !isExternalLink(href))
    .map(splitHref)
    .filter((href) => href.length > 0)
    .filter((href) => !existsSync(resolve(base, href)))

  return missing.length === 0
    ? pass(`links: ${file}`, `${links.length} checked`)
    : fail(`links: ${file}`, `missing: ${missing.join(", ")}`)
}

const checkCloseoutSections = (file: string): CheckResult => {
  const absolutePath = resolve(pctRoot, file)
  if (!existsSync(absolutePath)) return fail(`closeout sections: ${file}`, "file does not exist")

  const text = read(absolutePath)
  const missing = closeoutSections.filter((section) => !text.includes(section))
  return missing.length === 0
    ? pass(`closeout sections: ${file}`, `${closeoutSections.length} required sections present`)
    : fail(`closeout sections: ${file}`, `missing: ${missing.join(", ")}`)
}

const checkDocsSpineContent = (): ReadonlyArray<CheckResult> => {
  const readme = read(resolve(hardeningDir, "README.md"))
  const template = read(resolve(hardeningDir, "closeout-template.md"))
  const staging = read(resolve(hardeningDir, "staging-hygiene.md"))
  const ledger = read(resolve(hardeningDir, "validation-ledger.md"))

  return [
    readme.includes("[staging-hygiene.md](./staging-hygiene.md)")
      ? pass("portfolio links staging hygiene runbook")
      : fail("portfolio links staging hygiene runbook"),
    template.includes("[staging-hygiene.md](./staging-hygiene.md)")
      ? pass("template links staging hygiene runbook")
      : fail("template links staging hygiene runbook"),
    template.includes("## 10. Workspace hygiene proof")
      ? pass("template includes workspace hygiene proof section")
      : fail("template includes workspace hygiene proof section"),
    staging.includes("Never broad-stage") && staging.includes("git add -A") && staging.includes("git add .")
      ? pass("staging runbook forbids broad staging")
      : fail("staging runbook forbids broad staging"),
    staging.includes("git diff --cached --name-status") && staging.includes("git status --short -- package.json bun.lock .gitmodules")
      ? pass("staging runbook records required hygiene commands")
      : fail("staging runbook records required hygiene commands"),
    ledger.includes("[staging-hygiene.md](./staging-hygiene.md)")
      ? pass("validation ledger records staging hygiene artifact")
      : fail("validation ledger records staging hygiene artifact"),
  ]
}

const hardeningMarkdownFiles = (): ReadonlyArray<string> =>
  readdirSync(hardeningDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => `docs/hardening/${entry}`)
    .sort()

const defaultCloseoutFiles = (): ReadonlyArray<string> =>
  hardeningMarkdownFiles()
    .filter((file) => file.endsWith("-closeout.md"))
    .filter((file) => !file.endsWith("closeout-template.md"))

const run = (args: Args): ReadonlyArray<CheckResult> => {
  const explicitFiles = args.files.map((file) => toPctRelative(resolve(pctRoot, file)))
  const closeoutFiles = explicitFiles.length > 0 ? explicitFiles : defaultCloseoutFiles()
  const linkFiles = explicitFiles.length > 0 ? explicitFiles : hardeningMarkdownFiles()

  return [
    ...checkRequiredDocs(),
    ...checkDocsSpineContent(),
    ...linkFiles.map(checkRelativeLinks),
    ...closeoutFiles.map(checkCloseoutSections),
  ]
}

try {
  const args = parseArgs(Bun.argv.slice(2))
  if (args.help) {
    console.log(usage)
    process.exit(0)
  }

  const results = run(args)
  const failed = results.filter((result) => !result.ok)

  if (args.json) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2))
  } else {
    for (const result of results) {
      const marker = result.ok ? "✓" : "✗"
      const detail = result.detail ? ` — ${result.detail}` : ""
      console.log(`${marker} ${result.label}${detail}`)
    }
    console.log(`\n${failed.length === 0 ? "PASS" : "FAIL"}: ${results.length - failed.length}/${results.length} checks passed`)
  }

  if (failed.length > 0) process.exit(1)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
