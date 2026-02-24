#!/usr/bin/env bun
/**
 * AVA-RFC-001 Assembly Script
 *
 * Concatenates, normalizes, and validates RFC section files into a single
 * AVA-RFC-001-assembled.md document. Source files are NOT modified.
 *
 * Usage: bun run scripts/assemble-rfc.ts
 *
 * Pattern: Identical to TMNL-RFC-002 assembly (packages/tmnl/scripts/assemble-rfc.ts)
 */

import { existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dir, "../docs/specifications");
const RFC_DIR = path.join(ROOT, "rfc");
const OUTPUT = path.join(RFC_DIR, "AVA-RFC-001-assembled.md");

// ---------------------------------------------------------------------------
// Canonical manifest — order matches the assembly manifest exactly
// ---------------------------------------------------------------------------

interface SectionEntry {
  id: string;                 // "AVA.1" | "Appendix A" etc.
  title: string;              // Canonical title
  file: string;               // Relative to RFC_DIR
  part?: string;              // Part divider to insert BEFORE this section
}

const SECTIONS: SectionEntry[] = [
  // PART I: DATA INGEST
  { id: "AVA.1",  title: "Pipeline Architecture",      file: "rfc-section-pipeline-architecture.md",   part: "PART I: DATA INGEST (Normative)" },
  { id: "AVA.2",  title: "Signal Schema",              file: "rfc-section-signal-schema.md" },
  { id: "AVA.3",  title: "NATS Subject Taxonomy",      file: "rfc-section-nats-subject-taxonomy.md" },
  { id: "AVA.4",  title: "Source Adapters",             file: "rfc-section-source-adapters.md" },
  { id: "AVA.5",  title: "JetStream Persistence",      file: "rfc-section-jetstream-persistence.md" },

  // PART II: PROCESSING
  { id: "AVA.6",  title: "Actor Model (asupersync)",    file: "rfc-section-actor-model.md",             part: "PART II: PROCESSING (Normative)" },
  { id: "AVA.7",  title: "Supervision Tree",            file: "rfc-section-supervision-tree.md" },
  { id: "AVA.8",  title: "Differential Dataflow Engine", file: "rfc-section-dd-engine.md" },
  { id: "AVA.9",  title: "Fusion Tiers & Join Paths",   file: "rfc-section-fusion-tiers.md" },

  // PART III: ALGORITHMS
  { id: "AVA.10", title: "Evidence Theory (DS/PCR5)",   file: "rfc-section-evidence-theory.md",         part: "PART III: ALGORITHMS (Normative)" },
  { id: "AVA.11", title: "Tracking & State Estimation", file: "rfc-section-tracking.md" },
  { id: "AVA.12", title: "Complex Event Processing",    file: "rfc-section-cep.md" },

  // PART IV: OUTPUT
  { id: "AVA.13", title: "Output & Alarm Pipeline",     file: "rfc-section-output-pipeline.md",         part: "PART IV: OUTPUT (Normative)" },
  { id: "AVA.14", title: "Deployment Topology",         file: "rfc-section-deployment.md" },

  // PART V: VALIDATION
  { id: "AVA.15", title: "E2E Testing Strategy",        file: "rfc-section-e2e-testing.md",             part: "PART V: VALIDATION (Informative)" },

  // APPENDICES
  { id: "Appendix A", title: "SignalKind Catalog",      file: "rfc-appendix-signal-catalog.md" },
  { id: "Appendix B", title: "EntityClass Catalog",     file: "rfc-appendix-entity-catalog.md" },
  { id: "Appendix C", title: "Data Source Catalog",     file: "rfc-appendix-data-sources.md" },
  { id: "Appendix D", title: "Bibliography",            file: "rfc-appendix-bibliography.md" },
];

// ---------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------

const FRONT_MATTER = `\
# AVA-RFC-001: Ava Fusion Pipeline — Sensor Fusion Runtime

\`\`\`
Document:      AVA-RFC-001
Title:         Ava Fusion Pipeline — Sensor Fusion Runtime
Status:        DRAFT
Authors:       Val (Vigilant Architecture Layer)
Created:       2026-02-20
Revision:      0.1.0

Crates:        ava-fusion (types), ava-fusion-runtime (actors + dataflow)
Runtime:       asupersync v0.2.5
Transport:     NATS JetStream
Compute:       differential-dataflow v0.18 + timely v0.25
\`\`\`

> This RFC specifies the architecture, algorithms, data model, and deployment
> topology for the ava-fusion sensor fusion pipeline. The pipeline ingests
> signals from 20 sensor categories, correlates observations across 3 fusion
> tiers using differential-dataflow's incremental computation model, and
> produces entity tracks, alarm notifications, and fusion results. The runtime
> uses asupersync's GenServer actor model with structured supervision, cancel
> propagation, and budget enforcement.

---

## Metrics Summary

| Metric | Count |
|--------|-------|
| Total sections | ${SECTIONS.filter(s => s.id.startsWith("AVA")).length} |
| Total appendices | ${SECTIONS.filter(s => s.id.startsWith("Appendix")).length} |
| Total parts | ${new Set(SECTIONS.filter(s => s.part).map(s => s.part)).size} |
| Total section lines | 0 |
| SignalKind variants | 20 |
| EntityClass variants | 10 |
| Fusion tiers | 3 |

---

## Table of Contents

${SECTIONS.map((s) => {
  const indent = s.id.startsWith("Appendix") ? "" : "";
  const partMarker = s.part ? `\n**${s.part}**\n\n` : "";
  return `${partMarker}${indent}- **${s.id}**: ${s.title}`;
}).join("\n")}

---

`;

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  AVA-RFC-001 Assembly\n");
  console.log(`  RFC_DIR: ${RFC_DIR}`);
  console.log(`  OUTPUT:  ${OUTPUT}\n`);

  // Check which files exist
  let missingCount = 0;
  const available: Map<string, string> = new Map();

  for (const section of SECTIONS) {
    const filePath = path.join(RFC_DIR, section.file);
    if (existsSync(filePath)) {
      const content = await Bun.file(filePath).text();
      available.set(section.id, content);
      console.log(`  OK   ${section.id}: ${section.file} (${content.split("\n").length} lines)`);
    } else {
      missingCount++;
      console.log(`  SKIP ${section.id}: ${section.file} (not yet written)`);
    }
  }

  console.log(`\n  ${available.size}/${SECTIONS.length} sections available, ${missingCount} planned.\n`);

  // Assemble
  const parts: string[] = [FRONT_MATTER];

  for (const section of SECTIONS) {
    // Part divider
    if (section.part) {
      parts.push(`\n\n---\n\n# ${section.part}\n\n---\n\n`);
    }

    const content = available.get(section.id);
    if (content) {
      parts.push(content);
      parts.push("\n\n---\n\n");
    } else {
      // Placeholder for planned sections
      parts.push(`# ${section.id}: ${section.title}\n\n> *This section is planned but not yet written.*\n\n`);
      parts.push("---\n\n");
    }
  }

  let assembled = parts.join("");

  // Clean up excessive newlines
  assembled = assembled.replace(/\n{4,}/g, "\n\n\n");

  // Update metrics
  const assembledLines = assembled.split("\n");
  const totalLines = assembledLines.length;

  assembled = assembled.replace(
    /\| Total section lines \| \d+ \|/,
    `| Total section lines | ${totalLines.toLocaleString()} |`
  );

  // Write output
  await Bun.write(OUTPUT, assembled);

  const finalLines = assembled.split("\n").length;
  console.log(`  Written: ${OUTPUT}`);
  console.log(`  Lines:   ${finalLines.toLocaleString()}`);
  console.log(`  Bytes:   ${assembled.length.toLocaleString()}`);
  console.log("\n  Assembly complete.\n");
}

main().catch(console.error);
