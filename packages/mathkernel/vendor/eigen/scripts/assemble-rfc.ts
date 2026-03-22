#!/usr/bin/env bun
/**
 * TMNL-RFC-002 Assembly Script
 *
 * Concatenates, normalizes, and validates 43 source files into a single
 * TMNL-RFC-002-assembled.md document. Source files are NOT modified.
 *
 * Usage: bun run scripts/assemble-rfc.ts
 */

import { existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dir, "../docs/tsingou");
const RFC_DIR = path.join(ROOT, "rfc");
const ADR_DIR = path.join(ROOT, "adr");
const OUTPUT = path.join(RFC_DIR, "TMNL-RFC-002-assembled.md");

// ---------------------------------------------------------------------------
// Canonical manifest — order matches the assembly manifest exactly
// ---------------------------------------------------------------------------

interface SectionEntry {
  id: string;                 // "TSG.1" | "Appendix A" etc.
  title: string;              // Canonical title
  file: string;               // Relative to RFC_DIR (or ADR_DIR for appendix A)
  dir?: string;               // Override base dir (for ADR index)
  part?: string;              // Part divider to insert BEFORE this section
}

const SECTIONS: SectionEntry[] = [
  // --- PART I: DOMAIN & CONTEXT (Informative) ---
  { id: "TSG.1",  title: "Introduction & Vision",         file: "rfc-section-introduction.md",          part: "PART I: DOMAIN & CONTEXT (Informative)" },
  { id: "TSG.2",  title: "SIGINT/OSINT Domain Reference", file: "rfc-section-sigint-domain.md" },
  { id: "TSG.3",  title: "Intelligence Cycle",            file: "rfc-section-intelligence-cycle.md" },
  { id: "TSG.4",  title: "Data Fusion Mathematics",       file: "rfc-section-data-fusion-mathematics.md" },
  { id: "TSG.5",  title: "Competitive Analysis",          file: "rfc-section-competitive-analysis.md" },

  // --- PART II: ARCHITECTURE (Normative) ---
  { id: "TSG.6",  title: "Architecture Overview",                file: "rfc-section-architecture-overview.md", part: "PART II: ARCHITECTURE (Normative)" },
  { id: "TSG.7",  title: "Signal Pipeline & d2ts",               file: "rfc-section-signal-pipeline.md" },
  { id: "TSG.8",  title: "BaseSignal Schema",                    file: "rfc-section-base-signal-schema.md" },
  { id: "TSG.9",  title: "Source Adapter Contract",              file: "rfc-section-source-adapters.md" },
  { id: "TSG.10", title: "State Management (Atom-as-State)",     file: "rfc-section-state-management.md" },
  { id: "TSG.11", title: "NATS Messaging Fabric",                file: "rfc-section-nats-fabric.md" },

  // --- PART III: INTEROPERABILITY (Normative) ---
  { id: "TSG.12", title: "STIX 2.1 Data Model",          file: "rfc-section-stix-data-model.md",       part: "PART III: INTEROPERABILITY (Normative)" },
  { id: "TSG.13", title: "BaseSignal \u2194 STIX Codec",  file: "rfc-section-stix-codec.md" },
  { id: "TSG.14", title: "TAXII 2.1 Transport",           file: "rfc-section-taxii-transport.md" },
  { id: "TSG.15", title: "CTI Platform Interop",          file: "rfc-section-cti-platform-interop.md" },

  // --- PART IV: SDR & RF INTEGRATION (Normative) ---
  { id: "TSG.16", title: "SDR Hardware Landscape",        file: "rfc-section-sdr-hardware.md",          part: "PART IV: SDR & RF INTEGRATION (Normative)" },
  { id: "TSG.17", title: "GNU Radio Bridge",              file: "rfc-section-gnu-radio-bridge.md" },
  { id: "TSG.18", title: "SigMF Codec",                   file: "rfc-section-sigmf-codec.md" },
  { id: "TSG.19", title: "Spectrum Visualization",        file: "rfc-section-spectrum-visualization.md" },

  // --- PART V: RENDERING & VISUALIZATION (Normative) ---
  { id: "TSG.20", title: "4-Layer Rendering Surface",     file: "rfc-section-rendering-surface.md",     part: "PART V: RENDERING & VISUALIZATION (Normative)" },
  { id: "TSG.21", title: "R3F 3D Scene Layer",            file: "rfc-section-r3f-layer.md" },
  { id: "TSG.22", title: "visx Data Visualization Layer", file: "rfc-section-visx-layer.md" },
  { id: "TSG.23", title: "p5 Generative Layer",           file: "rfc-section-p5-layer.md" },
  { id: "TSG.24", title: "DOM Control Layer",             file: "rfc-section-dom-layer.md" },

  // --- PART VI: ANALYSIS & MATHEMATICS (Normative) ---
  { id: "TSG.25", title: "DSP Foundations",                         file: "rfc-section-dsp-foundations.md",      part: "PART VI: ANALYSIS & MATHEMATICS (Normative)" },
  { id: "TSG.26", title: "Differential Dataflow Theory",            file: "rfc-section-differential-dataflow.md" },
  { id: "TSG.27", title: "Statistical Analysis & Anomaly Detection", file: "rfc-section-statistical-analysis.md" },
  { id: "TSG.28", title: "Graph Theory & Link Analysis",            file: "rfc-section-graph-theory.md" },
  { id: "TSG.29", title: "Information Theory",                      file: "rfc-section-information-theory.md" },
  { id: "TSG.30", title: "Geospatial Mathematics",                  file: "rfc-section-geospatial-math.md" },
  { id: "TSG.31", title: "Analysis Techniques Catalog",             file: "rfc-section-analysis-techniques.md" },

  // --- PART VII: IMPLEMENTATION (Normative) ---
  { id: "TSG.32", title: "Effect-TS Implementation Architecture",   file: "rfc-section-effect-architecture.md",  part: "PART VII: IMPLEMENTATION (Normative)" },
  { id: "TSG.33", title: "Palantir Knowledge Graph Integration",    file: "rfc-section-palantir-integration.md" },
  { id: "TSG.34", title: "Deployment Topology (Tauri + Sidecars)",  file: "rfc-section-deployment-topology.md" },
  { id: "TSG.35", title: "Error Handling & Tagged Errors",          file: "rfc-section-error-handling.md" },

  // --- PART VII-B: DOCTRINE ALIGNMENT (Informative) ---
  { id: "TSG.36", title: "EW/SIGINT Doctrine Alignment",  file: "rfc-section-ew-doctrine.md",           part: "PART VII-B: DOCTRINE ALIGNMENT (Informative)" },

  // --- PART VIII: APPENDICES (Informative) ---
  { id: "Appendix A", title: "ADR Cross-Reference Index",  file: "INDEX.md", dir: ADR_DIR,              part: "PART VIII: APPENDICES (Informative)" },
  { id: "Appendix B", title: "Bibliography",               file: "rfc-appendix-bibliography.md" },
  { id: "Appendix C", title: "Signal Kind Catalog",        file: "rfc-appendix-signal-catalog.md" },
  { id: "Appendix D", title: "STIX Mapping Tables",        file: "rfc-appendix-stix-mappings.md" },
  { id: "Appendix E", title: "Research Document Index",    file: "rfc-appendix-research-index.md" },
  { id: "Appendix F", title: "Glossary & Acronyms",        file: "rfc-appendix-glossary.md" },
];

// Subsection renumbering map: old prefix -> new prefix
// These 4 files were written with wrong TSG numbering
const RENUMBER_MAP: Record<string, { from: string; to: string }> = {
  "rfc-section-architecture-overview.md": { from: "TSG.1.",  to: "TSG.6." },
  "rfc-section-signal-pipeline.md":       { from: "TSG.2.",  to: "TSG.7." },
  "rfc-section-state-management.md":      { from: "TSG.4.",  to: "TSG.10." },
  "rfc-section-rendering-surface.md":     { from: "TSG.3.",  to: "TSG.20." },
};

// ---------------------------------------------------------------------------
// Phase 1: Load & Validate
// ---------------------------------------------------------------------------

console.log("=== Phase 1: Load & Validate ===\n");

const loaded: Map<string, string> = new Map();
let errors = 0;

for (const entry of SECTIONS) {
  const dir = entry.dir ?? RFC_DIR;
  const filepath = path.join(dir, entry.file);

  if (!existsSync(filepath)) {
    console.error(`  MISSING: ${entry.id} -> ${filepath}`);
    errors++;
    continue;
  }

  const content = await Bun.file(filepath).text();
  if (content.trim().length === 0) {
    console.error(`  EMPTY: ${entry.id} -> ${filepath}`);
    errors++;
    continue;
  }

  loaded.set(entry.file, content);
  console.log(`  OK: ${entry.id} (${entry.file}, ${content.split("\n").length} lines)`);
}

// Load front matter
const frontMatterPath = path.join(RFC_DIR, "RFC-002-tsingou-platform.md");
if (!existsSync(frontMatterPath)) {
  console.error("  MISSING: Front matter -> RFC-002-tsingou-platform.md");
  errors++;
}
const frontMatterRaw = await Bun.file(frontMatterPath).text();
console.log(`  OK: Front matter (RFC-002-tsingou-platform.md, ${frontMatterRaw.split("\n").length} lines)`);

if (errors > 0) {
  console.error(`\nFATAL: ${errors} file(s) missing or empty. Aborting.`);
  process.exit(1);
}

console.log(`\n  All ${SECTIONS.length} section files + front matter loaded.\n`);

// ---------------------------------------------------------------------------
// Phase 2: Normalize (in-memory only)
// ---------------------------------------------------------------------------

console.log("=== Phase 2: Normalize ===\n");

function normalizeSection(entry: SectionEntry, raw: string): string {
  let lines = raw.split("\n");

  // --- H1 normalization ---
  // Replace whatever the first line is with canonical `# TSG.N: Title` or `# Appendix X: Title`
  const canonicalH1 = `# ${entry.id}: ${entry.title}`;
  if (lines[0].startsWith("# ")) {
    console.log(`  H1: "${lines[0]}" -> "${canonicalH1}"`);
    lines[0] = canonicalH1;
  }

  // --- Frontmatter stripping ---
  // Remove the fenced code block immediately after H1 (``` ... ```)
  // Pattern: blank line, ```, metadata lines, ```, blank line
  let fmStart = -1;
  let fmEnd = -1;

  for (let i = 1; i < Math.min(lines.length, 30); i++) {
    if (lines[i].trim() === "```" && fmStart === -1) {
      fmStart = i;
    } else if (lines[i].trim() === "```" && fmStart !== -1) {
      fmEnd = i;
      break;
    }
  }

  if (fmStart !== -1 && fmEnd !== -1) {
    // Check that this looks like metadata (contains Section/Title/Status/Author keywords)
    const fmBlock = lines.slice(fmStart + 1, fmEnd).join("\n");
    if (/(?:Section|Title|Status|Author|Parent|Created|Document|Appendix|Identifier)/i.test(fmBlock)) {
      console.log(`  Stripped frontmatter block (lines ${fmStart + 1}-${fmEnd + 1})`);
      lines.splice(fmStart, fmEnd - fmStart + 1);
    }
  }

  // --- Subsection renumbering ---
  const renumber = RENUMBER_MAP[entry.file];
  if (renumber) {
    let count = 0;
    lines = lines.map((line) => {
      // Match TSG.X. prefix in headers, anchor links, and body text
      const pattern = new RegExp(escapeRegex(renumber.from), "g");
      if (pattern.test(line)) {
        count++;
        return line.replace(pattern, renumber.to);
      }
      return line;
    });
    console.log(`  Renumbered: ${renumber.from}* -> ${renumber.to}* (${count} replacements)`);
  }

  // --- HTML comment stripping (trailing authoring metadata) ---
  // Find and remove trailing <!-- ... --> blocks
  let text = lines.join("\n");
  // Strip trailing HTML comment block (possibly preceded by blank lines/---)
  text = text.replace(/\n---\n\n<!--[\s\S]*?-->\s*$/, "\n");
  text = text.replace(/\n\n<!--[\s\S]*?-->\s*$/, "\n");

  // --- Ensure consistent ending ---
  text = text.trimEnd();

  // Add end-of-section marker if not present
  const endMarkerPattern = entry.id.startsWith("Appendix")
    ? `*End of ${entry.id}*`
    : `*End of Section ${entry.id}*`;

  if (!text.includes("*End of")) {
    text += `\n\n---\n\n${endMarkerPattern}\n`;
  }

  return text;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const normalized: Map<string, string> = new Map();

for (const entry of SECTIONS) {
  const raw = loaded.get(entry.file)!;
  normalized.set(entry.file, normalizeSection(entry, raw));
}

console.log(`\n  Normalized ${normalized.size} sections.\n`);

// ---------------------------------------------------------------------------
// Phase 3: Assemble
// ---------------------------------------------------------------------------

console.log("=== Phase 3: Assemble ===\n");

const parts: string[] = [];

// --- Front matter ---
// We reuse the existing front matter but will patch it in Phase 4
parts.push(frontMatterRaw.trimEnd());
parts.push("\n\n");

// --- Sections with Part dividers ---
for (const entry of SECTIONS) {
  if (entry.part) {
    parts.push(`---\n\n# ${entry.part}\n\n---\n\n`);
    console.log(`  Part divider: ${entry.part}`);
  }

  const content = normalized.get(entry.file)!;
  parts.push(content);
  parts.push("\n\n");
}

let assembled = parts.join("");

// Collapse excessive blank lines (3+ -> 2)
assembled = assembled.replace(/\n{4,}/g, "\n\n\n");

console.log(`  Assembly complete.\n`);

// ---------------------------------------------------------------------------
// Phase 4: Front matter TOC update
// ---------------------------------------------------------------------------

console.log("=== Phase 4: Front Matter TOC ===\n");

// The front matter already has a TOC structure. We'll regenerate line offsets.
// For now, the existing TOC structure is preserved (it already has the correct
// section listing). We update the metrics section.

const assembledLines = assembled.split("\n");
const totalLines = assembledLines.length;

// Count actual sections, appendices, parts in assembled output
let tsgCount = 0;
let partCount = 0;
let appendixCount = 0;

for (const line of assembledLines) {
  if (/^# TSG\.\d+:/.test(line)) tsgCount++;
  if (/^# PART /.test(line)) partCount++;
  if (/^# Appendix [A-F]:/.test(line)) appendixCount++;
}

// Update metrics in front matter portion
// Find the "## Metrics Summary" or similar section and update counts
assembled = assembled.replace(
  /\| Sections complete \| \d+ \|/,
  `| Sections complete | ${tsgCount} |`
);
assembled = assembled.replace(
  /\| Sections pending \| \d+.*\|/,
  "| Sections pending | 0 |"
);
assembled = assembled.replace(
  /\| Total section lines \| [\d,]+ \|/,
  `| Total section lines | ${totalLines.toLocaleString()} |`
);

// Update status line in front matter
assembled = assembled.replace(
  /^Status:\s+DRAFT$/m,
  "Status:        ASSEMBLED"
);

console.log(`  Metrics updated: ${tsgCount} sections, ${appendixCount} appendices, ${partCount} parts\n`);

// ---------------------------------------------------------------------------
// Phase 5: Write
// ---------------------------------------------------------------------------

console.log("=== Phase 5: Write ===\n");

await Bun.write(OUTPUT, assembled);

const finalLines = assembled.split("\n").length;
console.log(`  Written: ${OUTPUT}`);
console.log(`  Total lines: ${finalLines.toLocaleString()}\n`);

// ---------------------------------------------------------------------------
// Phase 6: Validate
// ---------------------------------------------------------------------------

console.log("=== Phase 6: Validate ===\n");

const output = await Bun.file(OUTPUT).text();
const outputLines = output.split("\n");

let valid = true;

function check(label: string, actual: number, expected: number) {
  const ok = actual === expected;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label} — got ${actual}, expected ${expected}`);
  if (!ok) valid = false;
}

// Count TSG headers
const tsgHeaders = outputLines.filter((l) => /^# TSG\.\d+:/.test(l));
check("TSG section headers", tsgHeaders.length, 36);

// Count PART dividers
const partDividers = outputLines.filter((l) => /^# PART /.test(l));
check("PART dividers", partDividers.length, 9);

// Count Appendix headers
const appendixHeaders = outputLines.filter((l) => /^# Appendix [A-F]:/.test(l));
check("Appendix headers", appendixHeaders.length, 6);

// Check no orphan frontmatter code blocks (``` followed by Section/Title/Status)
let orphanFm = 0;
for (let i = 0; i < outputLines.length; i++) {
  if (outputLines[i].trim() === "```" && i + 1 < outputLines.length) {
    const next = outputLines[i + 1];
    if (/^(?:Section|Title|Status|Author|Parent|Document|Appendix|Identifier)\s*:/i.test(next.trim())) {
      orphanFm++;
      console.log(`  WARN: Orphan frontmatter at line ${i + 1}: ${next.trim().slice(0, 60)}`);
    }
  }
}
check("Orphan frontmatter blocks", orphanFm, 0);

// Check renumbered sections: no stale TSG.1. refs in TSG.6 content
function checkNoStaleRefs(sectionId: string, stalePrefix: string) {
  // Find section boundaries
  const startIdx = outputLines.findIndex((l) => l === `# ${sectionId}:`  || l.startsWith(`# ${sectionId}: `));
  if (startIdx === -1) {
    console.log(`  WARN: Could not locate ${sectionId} for stale ref check`);
    return;
  }

  // Find next H1
  let endIdx = outputLines.length;
  for (let i = startIdx + 1; i < outputLines.length; i++) {
    if (/^# (?:TSG\.|PART |Appendix )/.test(outputLines[i])) {
      endIdx = i;
      break;
    }
  }

  const sectionContent = outputLines.slice(startIdx, endIdx).join("\n");
  const stalePattern = new RegExp(escapeRegex(stalePrefix), "g");
  const matches = sectionContent.match(stalePattern);
  if (matches && matches.length > 0) {
    console.log(`  FAIL: ${sectionId} still has ${matches.length} stale "${stalePrefix}" references`);
    valid = false;
  } else {
    console.log(`  PASS: ${sectionId} — no stale "${stalePrefix}" refs`);
  }
}

checkNoStaleRefs("TSG.6", "TSG.1.");
checkNoStaleRefs("TSG.7", "TSG.2.");
checkNoStaleRefs("TSG.10", "TSG.4.");
checkNoStaleRefs("TSG.20", "TSG.3.");

// Summary
console.log("\n" + "=".repeat(60));
console.log("ASSEMBLY SUMMARY");
console.log("=".repeat(60));
console.log(`  Sections:     ${tsgHeaders.length}/36`);
console.log(`  Appendices:   ${appendixHeaders.length}/6`);
console.log(`  Part dividers: ${partDividers.length}/9`);
console.log(`  Total lines:  ${finalLines.toLocaleString()}`);
console.log(`  Output:       ${OUTPUT}`);
console.log(`  Status:       ${valid ? "ALL CHECKS PASSED" : "VALIDATION FAILED"}`);
console.log("=".repeat(60));

if (!valid) {
  process.exit(1);
}
