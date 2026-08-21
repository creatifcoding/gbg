export type AdmissibleOrigin = 'canonical-record' | 'lab-artifact';

export type InadmissibleOrigin =
  | 'observational-memory'
  | 'chat'
  | 'recommendation'
  | 'raw-telemetry'
  | 'taxon-hypothesis'
  | 'photo-only-taxon'
  | 'photo-only-location';

export type IntakeOrigin = AdmissibleOrigin | InadmissibleOrigin;

export type IntakeRequest = {
  readonly ok: true;
  readonly origin: AdmissibleOrigin;
  readonly record: unknown;
};

export type IntakeRefusalReason =
  | `origin-inadmissible:${InadmissibleOrigin}`
  | 'origin-missing'
  | 'origin-unknown'
  | 'taxon-or-locality-keys-present'
  | 'evidence-id-missing';

export type IntakeRefusal = {
  readonly ok: false;
  readonly reasons: readonly IntakeRefusalReason[];
};

const ADMISSIBLE = new Set<AdmissibleOrigin>(['canonical-record', 'lab-artifact']);

const INADMISSIBLE = new Set<InadmissibleOrigin>([
  'observational-memory',
  'chat',
  'recommendation',
  'raw-telemetry',
  'taxon-hypothesis',
  'photo-only-taxon',
  'photo-only-location',
]);

const TAXON_OR_LOCALITY_KEYS = new Set([
  'taxon',
  'photoTaxon',
  'locality',
  'gps',
  'geo',
  'latitude',
  'longitude',
  'altitudeMeters',
  'GPSLatitude',
  'GPSLongitude',
  'gpsLatitude',
  'gpsLongitude',
  'exifGps',
]);

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const collectKeys = (value: unknown, depth: number, acc: Set<string>): void => {
  if (depth < 0) return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, depth - 1, acc);
    return;
  }
  if (!isObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    acc.add(key);
    collectKeys(nested, depth - 1, acc);
  }
};

const hasTaxonOrLocalityKeys = (value: unknown): boolean => {
  const keys = new Set<string>();
  collectKeys(value, 4, keys);
  for (const key of keys) {
    if (TAXON_OR_LOCALITY_KEYS.has(key)) return true;
  }
  if (keys.has('exif') && isObject(value) && isObject(value.exif)) {
    return true;
  }
  return false;
};

export function parseIntake(input: unknown): IntakeRequest | IntakeRefusal {
  if (!isObject(input)) {
    return { ok: false, reasons: ['origin-missing'] };
  }
  if (!('origin' in input)) {
    return { ok: false, reasons: ['origin-missing'] };
  }
  const origin = input.origin;
  if (typeof origin !== 'string') {
    return { ok: false, reasons: ['origin-missing'] };
  }
  if (INADMISSIBLE.has(origin as InadmissibleOrigin)) {
    return { ok: false, reasons: [`origin-inadmissible:${origin as InadmissibleOrigin}`] };
  }
  if (!ADMISSIBLE.has(origin as AdmissibleOrigin)) {
    return { ok: false, reasons: ['origin-unknown'] };
  }
  const record = 'record' in input ? input.record : undefined;
  if (hasTaxonOrLocalityKeys(input) || hasTaxonOrLocalityKeys(record)) {
    return { ok: false, reasons: ['taxon-or-locality-keys-present'] };
  }
  return { ok: true, origin: origin as AdmissibleOrigin, record };
}
