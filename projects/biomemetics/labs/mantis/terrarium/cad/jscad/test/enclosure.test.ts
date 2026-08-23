import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildEnclosure, measureEnclosureBox } from '../src/enclosure.ts';
import { emitStep, emitStl } from '../src/emit.ts';
import { ENCLOSURE_PARAMS } from '../src/params.ts';

const packageRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const paramsPath = join(packageRoot, '../../params.json');

type QuantityRecord = {
  readonly value: number;
  readonly unit: string;
  readonly status: string;
};

type ParamsFile = {
  readonly parameters: {
    readonly 'frame.exterior.width': QuantityRecord;
    readonly 'frame.exterior.depth': QuantityRecord;
    readonly 'frame.exterior.height': QuantityRecord;
    readonly 'frame.band': QuantityRecord;
    readonly 'panel.stock_thickness': QuantityRecord;
    readonly 'animal.clear.width': QuantityRecord;
    readonly 'animal.clear.depth': QuantityRecord;
    readonly 'animal.clear.height': QuantityRecord;
    readonly 'animal_volume.metal_allowed': {
      readonly value: boolean;
      readonly status: string;
    };
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isQuantityRecord = (value: unknown): value is QuantityRecord => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.value === 'number' &&
    typeof value.unit === 'string' &&
    typeof value.status === 'string'
  );
};

const readQuantity = (parameters: Record<string, unknown>, key: string): QuantityRecord => {
  const quantity = parameters[key];
  if (!isQuantityRecord(quantity)) {
    throw new Error(`params.json missing quantity ${key}`);
  }
  return quantity;
};

const parseParamsFile = (value: unknown): ParamsFile => {
  if (!isRecord(value) || !isRecord(value.parameters)) {
    throw new Error(`unreadable params.json: ${paramsPath}`);
  }
  const { parameters } = value;
  const metal = parameters['animal_volume.metal_allowed'];
  if (!isRecord(metal) || typeof metal.value !== 'boolean' || typeof metal.status !== 'string') {
    throw new Error('params.json missing animal_volume.metal_allowed');
  }
  return {
    parameters: {
      'frame.exterior.width': readQuantity(parameters, 'frame.exterior.width'),
      'frame.exterior.depth': readQuantity(parameters, 'frame.exterior.depth'),
      'frame.exterior.height': readQuantity(parameters, 'frame.exterior.height'),
      'frame.band': readQuantity(parameters, 'frame.band'),
      'panel.stock_thickness': readQuantity(parameters, 'panel.stock_thickness'),
      'animal.clear.width': readQuantity(parameters, 'animal.clear.width'),
      'animal.clear.depth': readQuantity(parameters, 'animal.clear.depth'),
      'animal.clear.height': readQuantity(parameters, 'animal.clear.height'),
      'animal_volume.metal_allowed': { value: metal.value, status: metal.status },
    },
  };
};

const terrariumParams = parseParamsFile(JSON.parse(readFileSync(paramsPath, 'utf8')));

test('typed enclosure table matches terrarium/params.json', () => {
  const { parameters } = terrariumParams;
  assert.equal(ENCLOSURE_PARAMS.exterior.width.value, parameters['frame.exterior.width'].value);
  assert.equal(ENCLOSURE_PARAMS.exterior.width.unit, parameters['frame.exterior.width'].unit);
  assert.equal(ENCLOSURE_PARAMS.exterior.width.status, parameters['frame.exterior.width'].status);
  assert.equal(ENCLOSURE_PARAMS.exterior.depth.value, parameters['frame.exterior.depth'].value);
  assert.equal(ENCLOSURE_PARAMS.exterior.depth.status, parameters['frame.exterior.depth'].status);
  assert.equal(ENCLOSURE_PARAMS.exterior.height.value, parameters['frame.exterior.height'].value);
  assert.equal(ENCLOSURE_PARAMS.exterior.height.status, parameters['frame.exterior.height'].status);
  assert.equal(ENCLOSURE_PARAMS.band.value, parameters['frame.band'].value);
  assert.equal(ENCLOSURE_PARAMS.band.status, parameters['frame.band'].status);
  assert.equal(ENCLOSURE_PARAMS.stock.value, parameters['panel.stock_thickness'].value);
  assert.equal(ENCLOSURE_PARAMS.stock.status, parameters['panel.stock_thickness'].status);
  assert.equal(ENCLOSURE_PARAMS.clear.width.value, parameters['animal.clear.width'].value);
  assert.equal(ENCLOSURE_PARAMS.clear.width.status, parameters['animal.clear.width'].status);
  assert.equal(ENCLOSURE_PARAMS.clear.depth.value, parameters['animal.clear.depth'].value);
  assert.equal(ENCLOSURE_PARAMS.clear.height.value, parameters['animal.clear.height'].value);
  assert.equal(ENCLOSURE_PARAMS.clear.height.status, parameters['animal.clear.height'].status);
});

test('metalAllowed is locked false', () => {
  assert.equal(ENCLOSURE_PARAMS.metalAllowed.value, false);
  assert.equal(ENCLOSURE_PARAMS.metalAllowed.status, 'locked');
  assert.equal(terrariumParams.parameters['animal_volume.metal_allowed'].value, false);
});

test('envelope is one 250 x 250 x 500 mm cuboid at front-left-bottom origin', () => {
  const model = buildEnclosure();
  assert.equal(model.kind, 'enclosure-envelope');
  assert.equal(model.maturity, 'draft');
  const [min, max] = measureEnclosureBox(model.solid);
  assert.deepEqual(min, [0, 0, 0]);
  assert.deepEqual(max, [250, 250, 500]);
  assert.ok(model.solid.polygons.length > 0);
});

test('animal-clear keep-out is recorded and not subtracted', () => {
  const model = buildEnclosure();
  assert.equal(model.keepOut.kind, 'animal-clear');
  assert.deepEqual(model.keepOut.sizeMm, [202, 202, 427]);
  assert.equal(model.keepOut.status, 'calculated');
  assert.equal(model.keepOut.subtracted, false);
  assert.equal(model.keepOut.reason, 'z-origin unverified before gasket closure');
});

test('STL and STEP emit throw', () => {
  assert.throws(() => emitStl(), { message: 'not implemented' });
  assert.throws(() => emitStep(), { message: 'not implemented' });
});
