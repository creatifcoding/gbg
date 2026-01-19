#!/usr/bin/env bun
/**
 * Spike: Chart Streaming Tool → Render Pipeline
 *
 * Tests the full flow from AI SDK streaming tool to ASCII visualization.
 *
 * H1: streamChartStyle yields progressive patches
 * H2: Patches contain valid palette/typography/animations
 * H3: Final patch has complete styling ready for render
 * H4: Tool integrates with AI SDK streamText
 */

import { streamChartStyle, createChartStylerStreamingTool } from '../src/lib/charts/styler/ai-tool';

// =============================================================================
// ASCII Visualization Helpers
// =============================================================================

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function renderProgressBar(confidence: number, width = 40): string {
  const filled = Math.round(confidence * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = (confidence * 100).toFixed(0).padStart(3);
  return `[${bar}] ${percent}%`;
}

function renderPalette(colors: string[] | undefined): string {
  if (!colors?.length) return '  (no palette)';
  return colors.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
}

function renderTypography(typo: { family: string; size: number; weight?: number } | undefined): string {
  if (!typo) return '  (no typography)';
  return `  Font: ${typo.family}\n  Size: ${typo.size}px\n  Weight: ${typo.weight ?? 'default'}`;
}

function renderAnimations(anims: Record<string, unknown> | undefined): string {
  if (!anims || Object.keys(anims).length === 0) return '  (no animations)';
  return Object.entries(anims)
    .map(([key, val]) => `  ${key}: ${JSON.stringify(val)}`)
    .join('\n');
}

function asciiChart(palette: string[]): string {
  // Simple ASCII bar chart using palette colors (conceptual)
  const bars = [
    '    ▂▂▂',
    '  ▄▄███',
    '▆▆█████▆▆',
    '████████████',
  ];
  return bars.join('\n');
}

// =============================================================================
// H1: Basic Streaming Test
// =============================================================================

async function testH1_BasicStreaming(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  H1: streamChartStyle yields progressive patches${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  const patches: Array<{ status: string; confidence: number }> = [];

  console.log(`${COLORS.dim}Streaming style for: Line chart with 'cyberpunk' intent...${COLORS.reset}\n`);

  for await (const patch of streamChartStyle({ chartType: 'Line', intent: 'cyberpunk' })) {
    patches.push(patch);

    const statusColor = patch.status === 'complete' ? COLORS.green :
                        patch.status === 'error' ? COLORS.red : COLORS.yellow;

    console.log(`${statusColor}[${patch.status.toUpperCase()}]${COLORS.reset} ${renderProgressBar(patch.confidence)}`);
  }

  const passed = patches.length >= 3 && patches[patches.length - 1].status === 'complete';

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H1 ${passed ? 'PASSED' : 'FAILED'}: Received ${patches.length} patches${COLORS.reset}`);

  return passed;
}

// =============================================================================
// H2: Patch Content Validation
// =============================================================================

async function testH2_PatchContent(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  H2: Patches contain valid palette/typography/animations${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  let hasPalette = false;
  let hasTypography = false;
  let hasAnimations = false;

  for await (const patch of streamChartStyle({ chartType: 'Bar', intent: 'minimal' })) {
    if (patch.palette && patch.palette.length > 0) hasPalette = true;
    if (patch.typography) hasTypography = true;
    if (patch.animations && Object.keys(patch.animations).length > 0) hasAnimations = true;

    console.log(`${COLORS.dim}─────────────────────────────────────────${COLORS.reset}`);
    console.log(`Status: ${patch.status} | Confidence: ${(patch.confidence * 100).toFixed(0)}%`);
    console.log(`${COLORS.magenta}Palette:${COLORS.reset}`);
    console.log(renderPalette(patch.palette));
    console.log(`${COLORS.blue}Typography:${COLORS.reset}`);
    console.log(renderTypography(patch.typography));
    console.log(`${COLORS.yellow}Animations:${COLORS.reset}`);
    console.log(renderAnimations(patch.animations));
  }

  const passed = hasPalette && hasTypography && hasAnimations;

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H2 ${passed ? 'PASSED' : 'FAILED'}:`);
  console.log(`  Palette: ${hasPalette ? '✓' : '✗'}`);
  console.log(`  Typography: ${hasTypography ? '✓' : '✗'}`);
  console.log(`  Animations: ${hasAnimations ? '✓' : '✗'}${COLORS.reset}`);

  return passed;
}

// =============================================================================
// H3: Final Patch Completeness
// =============================================================================

async function testH3_FinalPatch(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  H3: Final patch has complete styling ready for render${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  let finalPatch: any = null;

  for await (const patch of streamChartStyle({ chartType: 'Pie', intent: 'emphasize-trend' })) {
    finalPatch = patch;
  }

  console.log(`${COLORS.green}Final Patch Analysis:${COLORS.reset}`);
  console.log(`${COLORS.dim}─────────────────────────────────────────${COLORS.reset}`);

  const checks = {
    status: finalPatch?.status === 'complete',
    confidence: (finalPatch?.confidence ?? 0) >= 0.8,
    palette: (finalPatch?.palette?.length ?? 0) >= 3,
    typography: !!finalPatch?.typography?.family,
    rationale: !!finalPatch?.rationale,
  };

  console.log(`  Status: ${checks.status ? COLORS.green + '✓ complete' : COLORS.red + '✗ ' + finalPatch?.status}${COLORS.reset}`);
  console.log(`  Confidence: ${checks.confidence ? COLORS.green + '✓' : COLORS.red + '✗'} ${((finalPatch?.confidence ?? 0) * 100).toFixed(0)}% (need ≥80%)${COLORS.reset}`);
  console.log(`  Palette: ${checks.palette ? COLORS.green + '✓' : COLORS.red + '✗'} ${finalPatch?.palette?.length ?? 0} colors (need ≥3)${COLORS.reset}`);
  console.log(`  Typography: ${checks.typography ? COLORS.green + '✓' : COLORS.red + '✗'} ${finalPatch?.typography?.family ?? 'missing'}${COLORS.reset}`);
  console.log(`  Rationale: ${checks.rationale ? COLORS.green + '✓' : COLORS.red + '✗'} ${finalPatch?.rationale ? 'present' : 'missing'}${COLORS.reset}`);

  if (finalPatch?.palette) {
    console.log(`\n${COLORS.magenta}ASCII Chart Preview:${COLORS.reset}`);
    console.log(asciiChart(finalPatch.palette));
    console.log(`\n${COLORS.dim}Palette colors: ${finalPatch.palette.join(', ')}${COLORS.reset}`);
  }

  const passed = Object.values(checks).every(Boolean);

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H3 ${passed ? 'PASSED' : 'FAILED'}: Final patch is render-ready${COLORS.reset}`);

  return passed;
}

// =============================================================================
// H4: Tool Factory Test
// =============================================================================

async function testH4_ToolFactory(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  H4: Tool integrates with AI SDK${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  const tool = createChartStylerStreamingTool();

  console.log(`${COLORS.dim}Tool created successfully${COLORS.reset}`);
  console.log(`  Description: ${tool.description?.slice(0, 60)}...`);
  console.log(`  Has inputSchema: ${!!tool.inputSchema}`);
  console.log(`  Has execute: ${typeof tool.execute === 'function'}`);

  // Test the tool's execute directly (if defined)
  console.log(`\n${COLORS.dim}Testing tool.execute() directly...${COLORS.reset}`);

  const patches: any[] = [];
  if (tool.execute) {
    const result = tool.execute({ chartType: 'Line', intent: 'cyberpunk' }, {} as any);

    // Handle async generator result
    if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      for await (const patch of result as AsyncIterable<any>) {
        patches.push(patch);
        console.log(`  → ${patch.status}: confidence ${(patch.confidence * 100).toFixed(0)}%`);
      }
    }
  }

  const passed = patches.length >= 3 && typeof tool.execute === 'function';

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H4 ${passed ? 'PASSED' : 'FAILED'}: Tool factory works${COLORS.reset}`);

  return passed;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗
║     SPIKE: Chart Streaming Tool → Render Pipeline              ║
╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}
`);

  const results: Record<string, boolean> = {};

  results.H1 = await testH1_BasicStreaming();
  results.H2 = await testH2_PatchContent();
  results.H3 = await testH3_FinalPatch();
  results.H4 = await testH4_ToolFactory();

  // Summary
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  SUMMARY${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  const allPassed = Object.values(results).every(Boolean);

  for (const [name, passed] of Object.entries(results)) {
    console.log(`  ${passed ? COLORS.green + '✓' : COLORS.red + '✗'} ${name}${COLORS.reset}`);
  }

  console.log(`\n${allPassed ? COLORS.green + '✓ ALL HYPOTHESES VERIFIED' : COLORS.red + '✗ SOME HYPOTHESES FAILED'}${COLORS.reset}\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`${COLORS.red}Spike failed with error:${COLORS.reset}`, err);
  process.exit(1);
});
