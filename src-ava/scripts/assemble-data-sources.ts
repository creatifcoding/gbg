#!/usr/bin/env bun
/**
 * AVA Data Source Catalog Assembly Script
 *
 * Concatenates, normalizes, and validates data source catalog section files
 * into a single AVA-DS-CATALOG-assembled.md document. Source files are NOT modified.
 *
 * Usage: bun run scripts/assemble-data-sources.ts
 *
 * Pattern: Identical to AVA-RFC-001 assembly (scripts/assemble-rfc.ts)
 */

import { existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dir, "../docs/research/data-sources");
const OUTPUT = path.join(ROOT, "AVA-DS-CATALOG-assembled.md");

// ---------------------------------------------------------------------------
// Canonical manifest — order matches RFC-SECTION-FORMAT.md exactly
// ---------------------------------------------------------------------------

interface SectionEntry {
  id: string;
  title: string;
  file: string;
  part?: string;
}

const SECTIONS: SectionEntry[] = [
  // PART I: DATA SOURCE CATALOG
  {
    id: "AVA.DS.1",
    title: "Kinetic Domain Data Sources",
    file: "rfc-section-ds-kinetic.md",
    part: "PART I: DATA SOURCE CATALOG",
  },
  {
    id: "AVA.DS.2",
    title: "RF/Signals Domain Data Sources",
    file: "rfc-section-ds-rf-signals.md",
  },
  {
    id: "AVA.DS.3",
    title: "Cyber/Network Domain Data Sources",
    file: "rfc-section-ds-cyber-network.md",
  },
  {
    id: "AVA.DS.4",
    title: "OSINT/Social/Financial Domain Data Sources",
    file: "rfc-section-ds-osint-social-financial.md",
  },
  {
    id: "AVA.DS.5",
    title: "GEOINT/HUMINT/MASINT Domain Data Sources",
    file: "rfc-section-ds-geoint-humint-masint.md",
  },

  // PART II: INTEGRATION SPECIFICATION (Normative)
  {
    id: "AVA.DS.6",
    title: "NATS Subject Taxonomy",
    file: "rfc-section-ds-nats-taxonomy.md",
    part: "PART II: INTEGRATION SPECIFICATION (Normative)",
  },
  {
    id: "AVA.DS.7",
    title: "Cross-Domain Correlation Matrix",
    file: "rfc-section-ds-cross-correlation.md",
  },
  {
    id: "AVA.DS.8",
    title: "E2E Test Harness Specification",
    file: "rfc-section-ds-test-harness.md",
  },
];

// ---------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------

const FRONT_MATTER = `\
# AVA Data Source Integration Catalog

\`\`\`
Document:      AVA-DS-CATALOG
Title:         Ava Fusion Pipeline — Data Source Integration Catalog
Status:        DRAFT
Authors:       Val (Vigilant Architecture Layer)
Created:       2026-02-20
Revision:      0.1.0
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)

SignalKinds:   20 (AdsB, Ais, Radar, Satellite, RfBearing, Sdr, Sigint,
               Elint, Comint, Http, Dns, Cyber, Osint, Social, Financial,
               Travel, Geoint, Humint, Masint, Custom)
EntityClasses: 10 (Aircraft, Vessel, GroundVehicle, RfEmitter, NetworkHost,
               Domain, Person, Organization, Campaign, Facility)
\`\`\`

> This catalog specifies the concrete data sources, API endpoints, payload
> schemas, NATS subject taxonomy, cross-domain correlation matrix, and E2E
> test harness for the ava-fusion sensor fusion pipeline. Each of the 20
> SignalKind variants maps to one or more real-world data sources with
> documented API access, authentication requirements, rate limits, and
> payload schemas. Where no free API exists, synthetic data generation
> strategies are specified.

---

## Metrics Summary

| Metric | Count |
|--------|-------|
| Total sections | ${SECTIONS.length} |
| Domain catalogs | ${SECTIONS.filter((s) => !s.id.includes("6") && !s.id.includes("7") && !s.id.includes("8")).length} |
| Integration specs | ${SECTIONS.filter((s) => s.id.includes("6") || s.id.includes("7") || s.id.includes("8")).length} |
| Total section lines | 0 |
| SignalKind variants | 20 |
| EntityClass variants | 10 |
| Viable cross-correlation pairs | 84 |

---

## Table of Contents

${SECTIONS.map((s) => {
  const partMarker = s.part ? `\n**${s.part}**\n\n` : "";
  return `${partMarker}- **${s.id}**: ${s.title}`;
}).join("\n")}

---

`;

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  AVA Data Source Catalog Assembly\n");
  console.log(`  SOURCE_DIR: ${ROOT}`);
  console.log(`  OUTPUT:     ${OUTPUT}\n`);

  // Check which files exist
  let missingCount = 0;
  const available: Map<string, string> = new Map();

  for (const section of SECTIONS) {
    const filePath = path.join(ROOT, section.file);
    if (existsSync(filePath)) {
      const content = await Bun.file(filePath).text();
      available.set(section.id, content);
      console.log(
        `  OK   ${section.id}: ${section.file} (${content.split("\n").length} lines)`,
      );
    } else {
      missingCount++;
      console.log(
        `  SKIP ${section.id}: ${section.file} (not yet written)`,
      );
    }
  }

  console.log(
    `\n  ${available.size}/${SECTIONS.length} sections available, ${missingCount} planned.\n`,
  );

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
      parts.push(
        `# ${section.id}: ${section.title}\n\n> *This section is planned but not yet written.*\n\n`,
      );
      parts.push("---\n\n");
    }
  }

  let assembled = parts.join("");

  // Clean up excessive newlines
  assembled = assembled.replace(/\n{4,}/g, "\n\n\n");

  // Update metrics
  const totalLines = assembled.split("\n").length;
  assembled = assembled.replace(
    /\| Total section lines \| \d+ \|/,
    `| Total section lines | ${totalLines.toLocaleString()} |`,
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
