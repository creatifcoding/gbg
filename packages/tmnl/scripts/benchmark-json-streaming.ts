#!/usr/bin/env bun
/**
 * JSON Streaming Benchmark
 *
 * Measures the performance of JSON parsing in the streaming pipeline.
 * Identifies bottlenecks in the GenerativeContainer flow.
 *
 * Run: bun scripts/benchmark-json-streaming.ts
 * Run with events: bun scripts/benchmark-json-streaming.ts --emit-events
 *
 * Event output format (JSONL) for floating panel consumption:
 * {"type":"benchmark:start","timestamp":...,"config":{...}}
 * {"type":"benchmark:result","timestamp":...,"name":"...","metrics":{...}}
 * {"type":"benchmark:complete","timestamp":...,"summary":{...}}
 */

// =============================================================================
// Event Emitter for Observable Output
// =============================================================================

interface BenchmarkEvent {
  type: 'benchmark:start' | 'benchmark:result' | 'benchmark:progress' | 'benchmark:complete' | 'benchmark:error';
  timestamp: number;
  [key: string]: unknown;
}

const EMIT_EVENTS = process.argv.includes('--emit-events');

function emit(event: BenchmarkEvent): void {
  if (EMIT_EVENTS) {
    console.log(JSON.stringify(event));
  }
}

function emitStart(config: { elementCounts: number[]; iterations: number }): void {
  emit({
    type: 'benchmark:start',
    timestamp: Date.now(),
    config,
  });
}

function emitResult(
  name: string,
  elementCount: number,
  metrics: { avgMs: number; opsPerSec: number; sizeKB: number }
): void {
  emit({
    type: 'benchmark:result',
    timestamp: Date.now(),
    name,
    elementCount,
    metrics,
  });
}

function emitProgress(elementCount: number, completed: number, total: number): void {
  emit({
    type: 'benchmark:progress',
    timestamp: Date.now(),
    elementCount,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  });
}

function emitComplete(summary: {
  totalTests: number;
  bottleneck: string;
  recommendations: string[];
  speedupFactor: number;
}): void {
  emit({
    type: 'benchmark:complete',
    timestamp: Date.now(),
    summary,
  });
}

// =============================================================================
// Test Data Generation
// =============================================================================

interface UIElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

interface JSONLPatch {
  op: 'set' | 'add';
  path: string;
  value: unknown;
}

function generateTestElement(index: number): UIElement {
  return {
    key: `element-${index}`,
    type: ['VStack', 'HStack', 'Text', 'Card', 'Button'][index % 5],
    props: {
      className: `class-${index}`,
      style: { padding: index * 2, margin: index },
      data: { index, timestamp: Date.now(), nested: { deep: { value: index } } },
    },
    children: index % 3 === 0 ? [`element-${index + 1}`, `element-${index + 2}`] : undefined,
  };
}

function generateJSONLStream(elementCount: number): string {
  const lines: string[] = [];

  // Root operation
  lines.push(JSON.stringify({ op: 'set', path: '/root', value: 'element-0' }));

  // Element operations
  for (let i = 0; i < elementCount; i++) {
    const element = generateTestElement(i);
    lines.push(JSON.stringify({ op: 'add', path: `/elements/${element.key}`, value: element }));
  }

  return lines.join('\n');
}

// =============================================================================
// Benchmark: Raw JSON.parse
// =============================================================================

function benchmarkRawJSONParse(jsonl: string, iterations: number): { avgMs: number; opsPerSec: number } {
  const lines = jsonl.split('\n');
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    for (const line of lines) {
      JSON.parse(line);
    }
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * lines.length;

  return {
    avgMs: elapsed / iterations,
    opsPerSec: (totalOps / elapsed) * 1000,
  };
}

// =============================================================================
// Benchmark: Current GenerativeContainer Pattern (Object Spread)
// =============================================================================

function benchmarkCurrentPattern(jsonl: string, iterations: number): { avgMs: number; opsPerSec: number } {
  const lines = jsonl.split('\n');
  const start = performance.now();

  for (let iter = 0; iter < iterations; iter++) {
    let root: string | null = null;
    let elements: Record<string, unknown> = {};

    for (const line of lines) {
      if (!line.trim()) continue;
      const op = JSON.parse(line) as JSONLPatch;

      if (op.op === 'set' && op.path === '/root') {
        root = op.value as string;
      } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
        const key = op.path.replace('/elements/', '');
        elements = { ...elements, [key]: op.value };  // ← O(n) copy every time!
      }
    }
    // Use variables to prevent optimization
    void root;
    void elements;
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * lines.length;

  return {
    avgMs: elapsed / iterations,
    opsPerSec: (totalOps / elapsed) * 1000,
  };
}

// =============================================================================
// Benchmark: Optimized Pattern (Direct Mutation)
// =============================================================================

function benchmarkOptimizedPattern(jsonl: string, iterations: number): { avgMs: number; opsPerSec: number } {
  const lines = jsonl.split('\n');
  const start = performance.now();

  for (let iter = 0; iter < iterations; iter++) {
    let root: string | null = null;
    const elements: Record<string, unknown> = {};  // ← Mutate directly

    for (const line of lines) {
      if (!line.trim()) continue;
      const op = JSON.parse(line) as JSONLPatch;

      if (op.op === 'set' && op.path === '/root') {
        root = op.value as string;
      } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
        const key = op.path.replace('/elements/', '');
        elements[key] = op.value;  // ← O(1) instead of O(n)
      }
    }
    // Use variables to prevent optimization
    void root;
    void elements;
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * lines.length;

  return {
    avgMs: elapsed / iterations,
    opsPerSec: (totalOps / elapsed) * 1000,
  };
}

// =============================================================================
// Benchmark: Batched Updates (Update Every N ops)
// =============================================================================

function benchmarkBatchedPattern(jsonl: string, iterations: number, batchSize: number): { avgMs: number; opsPerSec: number } {
  const lines = jsonl.split('\n');
  const start = performance.now();

  for (let iter = 0; iter < iterations; iter++) {
    let root: string | null = null;
    const elements: Record<string, unknown> = {};
    let pendingUpdates = 0;

    const flushUpdate = () => {
      // Simulate atom update (would be registry.set in real code)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const snapshot = { root, elements: { ...elements } };
      void snapshot; // Prevent dead code elimination
      pendingUpdates = 0;
    };

    for (const line of lines) {
      if (!line.trim()) continue;
      const op = JSON.parse(line) as JSONLPatch;

      if (op.op === 'set' && op.path === '/root') {
        root = op.value as string;
      } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
        const key = op.path.replace('/elements/', '');
        elements[key] = op.value;
      }

      pendingUpdates++;
      if (pendingUpdates >= batchSize) {
        flushUpdate();
      }
    }

    // Final flush
    if (pendingUpdates > 0) {
      flushUpdate();
    }
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * lines.length;

  return {
    avgMs: elapsed / iterations,
    opsPerSec: (totalOps / elapsed) * 1000,
  };
}

// =============================================================================
// Benchmark: Worker Simulation (MessagePort overhead)
// =============================================================================

function benchmarkWorkerOverhead(jsonl: string, iterations: number): { avgMs: number; opsPerSec: number } {
  const lines = jsonl.split('\n');
  const start = performance.now();

  for (let iter = 0; iter < iterations; iter++) {
    const elements: Record<string, unknown> = {};

    for (const line of lines) {
      if (!line.trim()) continue;

      // Simulate structured clone (what postMessage does)
      const cloned = structuredClone(line);
      const op = JSON.parse(cloned) as JSONLPatch;

      if (op.op === 'add' && op.path.startsWith('/elements/')) {
        const key = op.path.replace('/elements/', '');
        // Simulate structured clone back
        elements[key] = structuredClone(op.value);
      }
    }
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * lines.length;

  return {
    avgMs: elapsed / iterations,
    opsPerSec: (totalOps / elapsed) * 1000,
  };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const elementCounts = [10, 50, 100, 500];
  const iterations = 100;
  let maxSpeedup = 0;

  emitStart({ elementCounts, iterations });

  if (!EMIT_EVENTS) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           JSON STREAMING BENCHMARK - TMNL');
    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  for (const count of elementCounts) {
    const jsonl = generateJSONLStream(count);
    const sizeKB = parseFloat((jsonl.length / 1024).toFixed(2));

    if (!EMIT_EVENTS) {
      console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
      console.log(`│  Elements: ${count.toString().padEnd(6)} | Size: ${sizeKB.toFixed(2).padStart(7)} KB | Iterations: ${iterations}`);
      console.log(`├─────────────────────────────────────────────────────────────┤`);
    }

    emitProgress(count, 0, 6);

    // Warmup
    benchmarkRawJSONParse(jsonl, 10);
    benchmarkCurrentPattern(jsonl, 10);
    benchmarkOptimizedPattern(jsonl, 10);

    // Actual benchmarks
    const rawParse = benchmarkRawJSONParse(jsonl, iterations);
    emitResult('Raw JSON.parse', count, { ...rawParse, sizeKB });
    emitProgress(count, 1, 6);

    const current = benchmarkCurrentPattern(jsonl, iterations);
    emitResult('Current (spread)', count, { ...current, sizeKB });
    emitProgress(count, 2, 6);

    const optimized = benchmarkOptimizedPattern(jsonl, iterations);
    emitResult('Optimized (mutate)', count, { ...optimized, sizeKB });
    emitProgress(count, 3, 6);

    const batched10 = benchmarkBatchedPattern(jsonl, iterations, 10);
    emitResult('Batched (10)', count, { ...batched10, sizeKB });
    emitProgress(count, 4, 6);

    const batched50 = benchmarkBatchedPattern(jsonl, iterations, 50);
    emitResult('Batched (50)', count, { ...batched50, sizeKB });
    emitProgress(count, 5, 6);

    const workerSim = benchmarkWorkerOverhead(jsonl, iterations);
    emitResult('Worker (clone)', count, { ...workerSim, sizeKB });
    emitProgress(count, 6, 6);

    const speedup = current.avgMs / optimized.avgMs;
    maxSpeedup = Math.max(maxSpeedup, speedup);

    if (!EMIT_EVENTS) {
      console.log(`│  Raw JSON.parse:      ${rawParse.avgMs.toFixed(3).padStart(8)} ms | ${Math.round(rawParse.opsPerSec).toLocaleString().padStart(10)} ops/s`);
      console.log(`│  Current (spread):    ${current.avgMs.toFixed(3).padStart(8)} ms | ${Math.round(current.opsPerSec).toLocaleString().padStart(10)} ops/s`);
      console.log(`│  Optimized (mutate):  ${optimized.avgMs.toFixed(3).padStart(8)} ms | ${Math.round(optimized.opsPerSec).toLocaleString().padStart(10)} ops/s`);
      console.log(`│  Batched (10):        ${batched10.avgMs.toFixed(3).padStart(8)} ms | ${Math.round(batched10.opsPerSec).toLocaleString().padStart(10)} ops/s`);
      console.log(`│  Batched (50):        ${batched50.avgMs.toFixed(3).padStart(8)} ms | ${Math.round(batched50.opsPerSec).toLocaleString().padStart(10)} ops/s`);
      console.log(`│  Worker (clone):      ${workerSim.avgMs.toFixed(3).padStart(8)} ms | ${Math.round(workerSim.opsPerSec).toLocaleString().padStart(10)} ops/s`);
      console.log(`├─────────────────────────────────────────────────────────────┤`);
      console.log(`│  ⚡ Optimized is ${speedup.toFixed(1)}x faster than current pattern`);
      console.log(`└─────────────────────────────────────────────────────────────┘`);
    }
  }

  // Emit completion event
  emitComplete({
    totalTests: elementCounts.length * 6,
    bottleneck: 'Object spread pattern (O(n²))',
    recommendations: [
      'Replace spread pattern with direct mutation + final snapshot',
      'Batch state updates using requestAnimationFrame',
      'Consider Web Worker for JSON parsing',
    ],
    speedupFactor: maxSpeedup,
  });

  if (!EMIT_EVENTS) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                      ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`
BOTTLENECKS IDENTIFIED:

1. **Object Spread Pattern** (elements = { ...elements, [key]: value })
   - Current code copies entire elements object on EVERY add operation
   - Complexity: O(n²) for n elements
   - Fix: Mutate directly, then snapshot when needed

2. **Per-Chunk State Updates** (registry.set on every reader.read())
   - Triggers React reconciliation on every network chunk
   - Fix: Batch updates - only flush every N operations or on animation frame

3. **String Operations** (path.replace, path.startsWith)
   - Minor but repeated on every operation
   - Could use pre-compiled regex or simple substring

RECOMMENDATIONS:

1. Replace spread pattern with direct mutation + final snapshot
2. Batch state updates using requestAnimationFrame or fixed intervals
3. Consider Web Worker for JSON parsing (offload from main thread)
4. Profile actual React rendering cost separately
`);
  }
}

main().catch(console.error);
