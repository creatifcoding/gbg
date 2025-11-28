/**
 * Example Runner
 *
 * Demonstration script that shows the complete flow:
 * 1. Create RawTableDTO with sample data
 * 2. Convert to RawTableBinary (extract numeric columns to ArrayBuffers)
 * 3. Dispatch to processor pool
 * 4. Receive and display ChartDTO result
 *
 * Run with: npx tsx packages/tmnl/src/lib/example-runner.ts
 */

import * as Effect from 'effect/Effect';
import type { RawTableDTO } from './worker-protocol';
import { rawTableToBinary, calculateTransferSize } from './rawToBinary';
import { ProcessorPoolTag, makeProcessorPoolLayer, type ProcessorPool } from './poolLayer';
import type { ProcessorConfig, ChartDTO } from './worker-protocol';

// ============================================================================
// Sample Data Generation
// ============================================================================

/**
 * Generate sample RawTableDTO with realistic HMI data.
 *
 * Simulates a time-series of sensor readings from multiple equipment.
 *
 * @param rowCount - Number of rows to generate
 * @returns RawTableDTO with sample data
 */
function generateSampleData(rowCount: number): RawTableDTO {
  const categories = ['Pump-A', 'Pump-B', 'Compressor-1', 'Valve-X', 'Sensor-T1'];
  const rows: Record<string, string | number | boolean | null>[] = [];

  for (let i = 0; i < rowCount; i++) {
    const category = categories[i % categories.length];
    const timestamp = Date.now() - (rowCount - i) * 1000; // 1 second intervals
    const value = Math.random() * 100 + (category.includes('Pump') ? 50 : 20);
    const status = Math.random() > 0.1; // 10% chance of false

    rows.push({
      equipment: category,
      timestamp: timestamp,
      reading: value,
      healthy: status,
    });
  }

  return {
    columns: ['equipment', 'timestamp', 'reading', 'healthy'],
    rows,
  };
}

// ============================================================================
// Main Example Program
// ============================================================================

/**
 * Main example program demonstrating the Effect-TS worker pool integration.
 */
function runExample(): Effect.Effect<unknown, unknown, ProcessorPool> {
  return Effect.flatMap(ProcessorPoolTag, (pool) => {
    console.log('=== Effect-TS Worker Pool Example ===\n');

    // Step 1: Generate sample data
    const ROW_COUNT = 10000;
    console.log(`1. Generating ${ROW_COUNT} rows of sample data...`);
    const rawTable = generateSampleData(ROW_COUNT);
    console.log(`   Columns: ${rawTable.columns.join(', ')}`);
    console.log(`   Sample row: ${JSON.stringify(rawTable.rows[0])}\n`);

    // Step 2: Convert to binary format
    console.log('2. Converting to binary format (extracting numeric columns to ArrayBuffers)...');
    const startConvert = Date.now();
    const binaryTable = rawTableToBinary(rawTable);
    const convertTime = Date.now() - startConvert;

    console.log(`   Row count: ${binaryTable.rowCount}`);
    console.log(`   Column types: ${JSON.stringify(binaryTable.columnTypes)}`);
    console.log(`   Numeric buffers: ${Object.keys(binaryTable.numericBuffers).join(', ')}`);
    console.log(`   Transfer size: ${calculateTransferSize(binaryTable)} bytes`);
    console.log(`   Conversion time: ${convertTime}ms\n`);

    // Step 3: Configure processing
    const config: ProcessorConfig = {
      groupByColumn: 'equipment',
      aggregateColumn: 'reading',
      aggregationFn: 'avg',
      chartTitle: 'Average Sensor Readings by Equipment',
      chunkSize: 1000, // Check for cancellation every 1000 rows
    };
    console.log('3. Processing configuration:');
    console.log(`   Group by: ${config.groupByColumn}`);
    console.log(`   Aggregate: ${config.aggregationFn}(${config.aggregateColumn})\n`);

    // Step 4: Execute on pool
    console.log('4. Dispatching to worker pool...');
    const startProcess = Date.now();

    return Effect.map(
      pool.executeEffect({
        _tag: 'Process',
        payload: {
          raw: binaryTable,
          config,
        },
      }),
      (response) => {
        const processTime = Date.now() - startProcess;

        // Step 5: Display results
        console.log(`   Response received in ${processTime}ms\n`);

        if (response._tag === 'ProcessResult') {
          const chart: ChartDTO = response.payload.chart;
          console.log('5. Chart result:');
          console.log(`   Title: ${chart.title}`);
          console.log(`   X-Axis: ${chart.xAxis.title}`);
          console.log(`   Categories: ${chart.xAxis.categories?.join(', ')}`);
          console.log(`   Y-Axis: ${chart.yAxis.title}`);
          console.log('   Series data:');
          for (const series of chart.series) {
            console.log(`     ${series.name}: [${series.data.map((v) => v.toFixed(2)).join(', ')}]`);
          }
          console.log(`   Processing time (worker): ${response.payload.processingTimeMs}ms`);
        } else if (response._tag === 'Error') {
          console.error(`   ERROR: ${response.payload.message} (${response.payload.code})`);
        }

        console.log('\n=== Example Complete ===');

        return response;
      },
    );
  });
}

// ============================================================================
// Run Example
// ============================================================================

/**
 * Create pool layer and run the example.
 */
async function main() {
  // Create pool layer with mock implementation
  // In production, provide actual worker module path
  const poolConfig = {
    workerModulePath: './processor-worker.ts',
    poolSize: 4,
  };

  const PoolLayer = makeProcessorPoolLayer(ProcessorPoolTag, poolConfig);

  // Run the program with the pool layer
  const result = await Effect.runPromise(
    Effect.provide(runExample(), PoolLayer),
  );

  // Verify result
  if (result && typeof result === 'object' && '_tag' in result && result._tag === 'ProcessResult') {
    console.log('\n✅ Integration test passed: ChartDTO received');
    process.exit(0);
  } else {
    console.error('\n❌ Integration test failed:', result);
    process.exit(1);
  }
}

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
