#!/usr/bin/env bun
/**
 * Profile the actual streaming pipeline
 * Measures where time is spent during generative streaming
 */

const API_URL = process.env.API_URL || 'http://localhost:7682/ui-generate';

interface Timings {
  networkChunks: number[];
  parseTime: number[];
  accumulateTime: number[];
  stateUpdateTime: number[];
  totalElements: number;
  totalBytes: number;
}

async function profileStream(prompt: string): Promise<Timings> {
  const timings: Timings = {
    networkChunks: [],
    parseTime: [],
    accumulateTime: [],
    stateUpdateTime: [],
    totalElements: 0,
    totalBytes: 0,
  };

  let lastChunkTime = performance.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context: {} }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    const elements: Record<string, unknown> = {};

    while (true) {
      const chunkStart = performance.now();
      const { done, value } = await reader.read();

      if (done) break;

      // Network chunk timing
      const networkTime = chunkStart - lastChunkTime;
      timings.networkChunks.push(networkTime);
      lastChunkTime = performance.now();

      const chunk = decoder.decode(value, { stream: true });
      timings.totalBytes += value.byteLength;

      // Parse timing
      const parseStart = performance.now();
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const op = JSON.parse(line);
          const parseTime = performance.now() - parseStart;
          timings.parseTime.push(parseTime);

          // Accumulate timing
          const accStart = performance.now();
          if (op.op === 'add' && op.path?.startsWith('/elements/')) {
            const key = op.path.replace('/elements/', '');
            elements[key] = op.value;
            timings.totalElements++;
          }
          timings.accumulateTime.push(performance.now() - accStart);

          // Simulate state update (spread for snapshot)
          const stateStart = performance.now();
          const snapshot = { elements: { ...elements } };
          void snapshot;
          timings.stateUpdateTime.push(performance.now() - stateStart);
        } catch {
          // Skip malformed
        }
      }
    }
  } catch (err) {
    console.error('Profile error:', err);
  }

  return timings;
}

function analyzeTimings(timings: Timings): void {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length ? sum(arr) / arr.length : 0;
  const p99 = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.99)];
  };

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('              STREAMING PIPELINE PROFILE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total elements: ${timings.totalElements}`);
  console.log(`Total bytes: ${(timings.totalBytes / 1024).toFixed(2)} KB`);
  console.log(`Network chunks: ${timings.networkChunks.length}\n`);

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  TIMING BREAKDOWN (ms)                                      │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Network wait:     avg ${avg(timings.networkChunks).toFixed(3).padStart(8)} | p99 ${p99(timings.networkChunks).toFixed(3).padStart(8)} │`);
  console.log(`│  JSON parse:       avg ${avg(timings.parseTime).toFixed(3).padStart(8)} | p99 ${p99(timings.parseTime).toFixed(3).padStart(8)} │`);
  console.log(`│  Accumulate:       avg ${avg(timings.accumulateTime).toFixed(3).padStart(8)} | p99 ${p99(timings.accumulateTime).toFixed(3).padStart(8)} │`);
  console.log(`│  State snapshot:   avg ${avg(timings.stateUpdateTime).toFixed(3).padStart(8)} | p99 ${p99(timings.stateUpdateTime).toFixed(3).padStart(8)} │`);
  console.log('├─────────────────────────────────────────────────────────────┤');

  const totalNetworkWait = sum(timings.networkChunks);
  const totalParse = sum(timings.parseTime);
  const totalAccumulate = sum(timings.accumulateTime);
  const totalSnapshot = sum(timings.stateUpdateTime);
  const totalCpu = totalParse + totalAccumulate + totalSnapshot;
  const total = totalNetworkWait + totalCpu;

  console.log(`│  TOTALS:                                                    │`);
  console.log(`│    Network wait:   ${totalNetworkWait.toFixed(1).padStart(8)} ms  (${((totalNetworkWait/total)*100).toFixed(0).padStart(3)}%)                    │`);
  console.log(`│    CPU work:       ${totalCpu.toFixed(1).padStart(8)} ms  (${((totalCpu/total)*100).toFixed(0).padStart(3)}%)                    │`);
  console.log(`│      - Parse:      ${totalParse.toFixed(1).padStart(8)} ms                           │`);
  console.log(`│      - Accumulate: ${totalAccumulate.toFixed(1).padStart(8)} ms                           │`);
  console.log(`│      - Snapshot:   ${totalSnapshot.toFixed(1).padStart(8)} ms                           │`);
  console.log('└─────────────────────────────────────────────────────────────┘');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      BOTTLENECK ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  if (totalNetworkWait > totalCpu * 2) {
    console.log('\n🌐 NETWORK BOUND - Server response time is the bottleneck');
    console.log('   → Optimize server-side generation');
    console.log('   → Consider smaller, more frequent chunks');
  } else if (totalSnapshot > totalParse) {
    console.log('\n📸 SNAPSHOT BOUND - Object spreading is expensive');
    console.log('   → Reduce snapshot frequency');
    console.log('   → Use structural sharing (immer)');
  } else {
    console.log('\n⚡ CPU BOUND - Parsing/accumulation is the bottleneck');
    console.log('   → Move parsing to Web Worker');
    console.log('   → Use streaming JSON parser');
  }

  console.log('\n🖥️  NOTE: React rendering cost not measured here');
  console.log('   → Use React DevTools Profiler for render timing');
  console.log('   → Check if components are memoized');
}

async function main() {
  const prompt = process.argv[2] || 'Generate a dashboard with 10 cards';

  console.log('Profiling streaming pipeline...');
  console.log(`Prompt: "${prompt}"`);
  console.log(`API: ${API_URL}\n`);

  const timings = await profileStream(prompt);

  if (timings.totalElements === 0) {
    console.log('\n❌ No data received. Is the API running?');
    console.log(`   curl -X POST ${API_URL} -H "Content-Type: application/json" -d '{"prompt":"test"}'`);
    return;
  }

  analyzeTimings(timings);
}

main().catch(console.error);
