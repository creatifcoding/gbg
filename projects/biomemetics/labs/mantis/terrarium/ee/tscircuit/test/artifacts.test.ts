import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

const read = (rel: string): Buffer => readFileSync(join(packageRoot, rel));

test('native tsci outputs are tool files, not leftover S08', () => {
  const circuit = read('dist/index/circuit.json').toString('utf8');
  assert.equal(circuit.startsWith('['), true);
  assert.equal(circuit.includes('S08'), false);
  assert.equal(circuit.includes('C492423'), false);
  assert.ok(circuit.includes('B27'));
  assert.ok(circuit.includes('B50'));

  const schematic = read('__snapshots__/index.circuit-schematic.snap.svg').toString('utf8');
  assert.ok(schematic.includes('<svg'));
  assert.ok(schematic.includes('tscircuit-schematic'));

  const pcb = read('__snapshots__/index.circuit-pcb.snap.svg').toString('utf8');
  assert.ok(pcb.includes('<svg'));
  assert.ok(pcb.includes('tscircuit-pcb') || pcb.includes('pcb'));

  const netlist = read('dist/readable-netlist.txt').toString('utf8');
  assert.ok(netlist.includes('B27'));
  assert.ok(netlist.includes('P01') || netlist.includes('VIN_A'));
  assert.ok(netlist.includes('NOT_CONNECTED'));

  const check = read('dist/check-netlist.txt').toString('utf8');
  assert.ok(check.includes('S1'));
  assert.ok(check.includes('NOT_CONNECTED'));

  const png = read('__snapshots__/index.circuit-3d.snap.png');
  assert.deepEqual(png.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const gltf = read('dist/coupon.gltf').toString('utf8');
  assert.ok(gltf.includes('"asset"'));
  assert.ok(gltf.includes('2.0'));

  const glb = read('dist/coupon.glb');
  assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF');
});
