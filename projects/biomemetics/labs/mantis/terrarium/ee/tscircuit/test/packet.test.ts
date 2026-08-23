import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packetRoot = dirname(fileURLToPath(new URL('../packet/MANIFEST.md', import.meta.url)));

const read = (name: string): Buffer => readFileSync(join(packetRoot, name));

test('packet files are tool output, not leftover S08', () => {
  const circuit = read('circuit.json').toString('utf8');
  assert.equal(circuit.startsWith('['), true);
  assert.equal(circuit.includes('S08'), false);
  assert.equal(circuit.includes('C492423'), false);
  assert.ok(circuit.includes('B27'));
  assert.ok(circuit.includes('B50'));

  const schematic = read('schematic.svg').toString('utf8');
  assert.ok(schematic.includes('<svg'));
  assert.ok(schematic.includes('tscircuit-schematic'));

  const pcb = read('pcb.svg').toString('utf8');
  assert.ok(pcb.includes('<svg'));
  assert.ok(pcb.includes('tscircuit-pcb') || pcb.includes('pcb'));

  const netlist = read('readable-netlist.txt').toString('utf8');
  assert.ok(netlist.includes('B27'));
  assert.ok(netlist.includes('P01') || netlist.includes('VIN_A'));

  const png = read('snapshots/index.circuit-3d.snap.png');
  assert.deepEqual(png.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const gltf = read('coupon.gltf').toString('utf8');
  assert.ok(gltf.includes('"asset"'));
  assert.ok(gltf.includes('2.0'));

  const glb = read('coupon.glb');
  assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF');
});
