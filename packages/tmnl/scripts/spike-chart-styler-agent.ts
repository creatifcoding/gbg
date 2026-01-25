#!/usr/bin/env bun
/**
 * Spike: Chart Styler Agent
 *
 * Tests the LLM-powered chart styling agent.
 * The agent outputs JSONL patches directly - no simulation.
 *
 * H1: streamChartStyleAgent yields progressive patches from LLM
 * H2: Patches contain valid palette/typography/animations
 * H3: Final patch has complete styling with rationale
 * H4: Effect Stream bridge works correctly
 */

import { Effect, Stream } from 'effect';
import {
  streamChartStyleAgent,
  streamChartStyleAgentEffect,
  type AgentStylePatch,
  type ChartStylerAgentInput,
} from '../src/lib/charts/styler/agent';

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

function renderAnimations(anims: AgentStylePatch['animations']): string {
  if (!anims) return '  (no animations)';
  const lines: string[] = [];
  if (anims.appear) {
    lines.push(`  appear: ${anims.appear.animation} (${anims.appear.duration}ms)`);
  }
  if (anims.update) {
    lines.push(`  update: ${anims.update.animation} (${anims.update.duration}ms)`);
  }
  return lines.length ? lines.join('\n') : '  (no animations)';
}

// =============================================================================
// H1: Basic Streaming Test
// =============================================================================

async function testH1_BasicStreaming(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  H1: streamChartStyleAgent yields progressive patches from LLM${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  const patches: AgentStylePatch[] = [];

  const input: ChartStylerAgentInput = {
    chartId: 'test-chart-1',
    prompt: 'Style this line chart with a cyberpunk neon theme',
    chartType: 'Line',
    intent: 'cyberpunk',
  };

  console.log(`${COLORS.dim}Streaming style from LLM for: ${input.chartType} chart with '${input.intent}' intent...${COLORS.reset}\n`);

  try {
    for await (const patch of streamChartStyleAgent(input)) {
      patches.push(patch);

      const statusColor = patch.type === 'complete' ? COLORS.green :
                          patch.type === 'palette' ? COLORS.yellow :
                          patch.type === 'typography' ? COLORS.blue : COLORS.magenta;

      console.log(`${statusColor}[${patch.type.toUpperCase()}]${COLORS.reset} ${renderProgressBar(patch.confidence)}`);
    }
  } catch (err) {
    console.log(`${COLORS.red}Error: ${err}${COLORS.reset}`);
    return false;
  }

  const passed = patches.length >= 1 && patches.some(p => p.type === 'complete' || p.confidence > 0);

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

  const input: ChartStylerAgentInput = {
    chartId: 'test-chart-2',
    prompt: 'Style this bar chart with a minimal clean theme',
    chartType: 'Bar',
    intent: 'minimal',
  };

  try {
    for await (const patch of streamChartStyleAgent(input)) {
      if (patch.palette && patch.palette.length > 0) hasPalette = true;
      if (patch.typography) hasTypography = true;
      if (patch.animations) hasAnimations = true;

      console.log(`${COLORS.dim}─────────────────────────────────────────${COLORS.reset}`);
      console.log(`Type: ${patch.type} | Confidence: ${(patch.confidence * 100).toFixed(0)}%`);
      console.log(`${COLORS.magenta}Palette:${COLORS.reset}`);
      console.log(renderPalette(patch.palette));
      console.log(`${COLORS.blue}Typography:${COLORS.reset}`);
      console.log(renderTypography(patch.typography));
      console.log(`${COLORS.yellow}Animations:${COLORS.reset}`);
      console.log(renderAnimations(patch.animations));
    }
  } catch (err) {
    console.log(`${COLORS.red}Error: ${err}${COLORS.reset}`);
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
  console.log(`${COLORS.cyan}  H3: Final patch has complete styling with rationale${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  let finalPatch: AgentStylePatch | null = null;

  const input: ChartStylerAgentInput = {
    chartId: 'test-chart-3',
    prompt: 'Style this pie chart to emphasize the largest segment',
    chartType: 'Pie',
    intent: 'highlight-outliers',
  };

  try {
    for await (const patch of streamChartStyleAgent(input)) {
      finalPatch = patch;
    }
  } catch (err) {
    console.log(`${COLORS.red}Error: ${err}${COLORS.reset}`);
  }

  console.log(`${COLORS.green}Final Patch Analysis:${COLORS.reset}`);
  console.log(`${COLORS.dim}─────────────────────────────────────────${COLORS.reset}`);

  const checks = {
    type: finalPatch?.type === 'complete',
    confidence: (finalPatch?.confidence ?? 0) >= 0.8,
    palette: (finalPatch?.palette?.length ?? 0) >= 3,
    typography: !!finalPatch?.typography?.family,
    rationale: !!finalPatch?.rationale,
  };

  console.log(`  Type: ${checks.type ? COLORS.green + '✓ complete' : COLORS.red + '✗ ' + finalPatch?.type}${COLORS.reset}`);
  console.log(`  Confidence: ${checks.confidence ? COLORS.green + '✓' : COLORS.red + '✗'} ${((finalPatch?.confidence ?? 0) * 100).toFixed(0)}% (need ≥80%)${COLORS.reset}`);
  console.log(`  Palette: ${checks.palette ? COLORS.green + '✓' : COLORS.red + '✗'} ${finalPatch?.palette?.length ?? 0} colors (need ≥3)${COLORS.reset}`);
  console.log(`  Typography: ${checks.typography ? COLORS.green + '✓' : COLORS.red + '✗'} ${finalPatch?.typography?.family ?? 'missing'}${COLORS.reset}`);
  console.log(`  Rationale: ${checks.rationale ? COLORS.green + '✓' : COLORS.red + '✗'} ${finalPatch?.rationale ? 'present' : 'missing'}${COLORS.reset}`);

  if (finalPatch?.rationale) {
    console.log(`\n${COLORS.cyan}Rationale:${COLORS.reset}`);
    console.log(`  ${finalPatch.rationale}`);
  }

  const passed = Object.values(checks).every(Boolean);

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H3 ${passed ? 'PASSED' : 'FAILED'}: Final patch is complete${COLORS.reset}`);

  return passed;
}

// =============================================================================
// H4: Effect Stream Bridge
// =============================================================================

async function testH4_EffectStream(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}  H4: Effect Stream bridge works correctly${COLORS.reset}`);
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  const input: ChartStylerAgentInput = {
    chartId: 'test-chart-4',
    prompt: 'Style this scatter plot for data distribution analysis',
    chartType: 'Scatter',
    intent: 'data-driven',
  };

  console.log(`${COLORS.dim}Testing streamChartStyleAgentEffect (Effect Stream)...${COLORS.reset}`);

  const patches: AgentStylePatch[] = [];

  const program = Stream.runForEach(
    streamChartStyleAgentEffect(input),
    (patch) => Effect.sync(() => {
      patches.push(patch);
      console.log(`  → ${patch.type}: confidence ${(patch.confidence * 100).toFixed(0)}%`);
    })
  );

  try {
    await Effect.runPromise(program);
  } catch (err) {
    console.log(`${COLORS.red}Error: ${err}${COLORS.reset}`);
    return false;
  }

  const passed = patches.length >= 1;

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H4 ${passed ? 'PASSED' : 'FAILED'}: Effect Stream bridge works (${patches.length} patches)${COLORS.reset}`);

  return passed;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗
║     SPIKE: Chart Styler Agent (LLM-Powered)                   ║
╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}
`);

  const results: Record<string, boolean> = {};

  results.H1 = await testH1_BasicStreaming();
  results.H2 = await testH2_PatchContent();
  results.H3 = await testH3_FinalPatch();
  results.H4 = await testH4_EffectStream();

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
