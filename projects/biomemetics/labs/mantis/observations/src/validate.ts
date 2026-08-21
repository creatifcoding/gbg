import {
  FORBIDDEN_CALLER_PROSE_KEYS,
  FORBIDDEN_LOCALITY_KEYS,
  LAB_AS_SPECIMEN_IDS,
  SCHEMA_VERSION,
  WORKSPACE_REF,
  type AnalogLink,
  type BiologicalFunction,
  type Measurement,
  type Mechanism,
  type Observation,
  type ObservationCatalog,
  type RefusalReason,
  type Review,
  type Structure,
  type Taxon,
} from './types.ts';

export type JsonObject = Record<string, unknown>;

const ID = /^[a-z][a-z0-9.-]*$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;
const DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const RELATIVE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/;
const MEDIA_TYPE = /^(image|video|audio)\/.+/;

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const hasOnlyKeys = (value: JsonObject, allowed: ReadonlySet<string>): boolean =>
  Object.keys(value).every((key) => allowed.has(key));

export const collectForbiddenReasons = (value: unknown): RefusalReason[] => {
  const reasons = new Set<RefusalReason>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isObject(node)) return;
    for (const key of Object.keys(node)) {
      if ((FORBIDDEN_LOCALITY_KEYS as readonly string[]).includes(key)) {
        reasons.add('invented-locality');
      }
      if ((FORBIDDEN_CALLER_PROSE_KEYS as readonly string[]).includes(key)) {
        reasons.add('caller-component-prose');
      }
      if (key === 'taxon' && typeof node[key] === 'string') {
        reasons.add('invented-taxon');
      }
      walk(node[key]);
    }
  };
  walk(value);
  return [...reasons];
};

export const refuseLabAsSpecimen = (id: string | undefined): RefusalReason[] => {
  if (id === undefined) return [];
  return LAB_AS_SPECIMEN_IDS.includes(id.trim()) ? ['lab-as-specimen'] : [];
};

const dateOk = (value: unknown): boolean =>
  isNonBlank(value) && DATETIME.test(value) && Number.isFinite(Date.parse(value));

const uniqueNonBlank = (value: unknown, minItems: number): value is string[] =>
  Array.isArray(value) &&
  value.length >= minItems &&
  value.every(isNonBlank) &&
  new Set(value).size === value.length;

export const validateReview = (value: unknown, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push('/review must be an object');
    return;
  }
  if (!hasOnlyKeys(value, new Set(['status', 'reviewer', 'reviewedAt', 'notes']))) {
    errors.push('/review contains an unknown property');
  }
  const status = String(value.status);
  if (!['pending', 'accepted', 'rejected', 'superseded'].includes(status)) {
    errors.push('/review/status is invalid');
  }
  if (status === 'accepted' || status === 'rejected') {
    if (!isNonBlank(value.reviewer)) errors.push('/review/reviewer is required');
    if (!dateOk(value.reviewedAt)) errors.push('/review/reviewedAt is required');
  }
  if (value.reviewer !== undefined && !isNonBlank(value.reviewer)) {
    errors.push('/review/reviewer is invalid');
  }
  if (value.reviewedAt !== undefined && !dateOk(value.reviewedAt)) {
    errors.push('/review/reviewedAt is invalid');
  }
  if (value.notes !== undefined && !isNonBlank(value.notes)) {
    errors.push('/review/notes is invalid');
  }
};

export const reviewIsAccepted = (review: Review): boolean =>
  review.status === 'accepted' &&
  isNonBlank(review.reviewer) &&
  dateOk(review.reviewedAt);

export const validateTaxon = (value: unknown, errors: string[]): RefusalReason[] => {
  const reasons: RefusalReason[] = [];
  if (!isObject(value)) {
    errors.push('/taxon must be an object');
    reasons.push('invented-taxon');
    return reasons;
  }
  if (
    !hasOnlyKeys(
      value,
      new Set(['status', 'reason', 'rank', 'name', 'confidence', 'citation']),
    )
  ) {
    errors.push('/taxon contains an unknown property');
    reasons.push('invented-taxon');
  }
  if (value.status === 'unknown') {
    if (
      value.reason !== 'no-real-media' &&
      value.reason !== 'media-without-citation'
    ) {
      errors.push('/taxon/reason is invalid');
      reasons.push('invented-taxon');
    }
    if (
      value.rank !== undefined ||
      value.name !== undefined ||
      value.confidence !== undefined ||
      value.citation !== undefined
    ) {
      errors.push('/taxon unknown cannot carry a name');
      reasons.push('invented-taxon');
    }
    return reasons;
  }
  if (value.status === 'cited-guess') {
    if (!isNonBlank(value.name)) {
      errors.push('/taxon/name is required');
      reasons.push('invented-taxon');
    }
    if (!isNonBlank(value.citation)) {
      errors.push('/taxon/citation is required');
      reasons.push('invented-taxon');
    }
    if (
      typeof value.confidence !== 'number' ||
      !(value.confidence > 0) ||
      value.confidence > 1
    ) {
      errors.push('/taxon/confidence is invalid');
      reasons.push('invented-taxon');
    }
    if (value.rank !== undefined && !isNonBlank(value.rank)) {
      errors.push('/taxon/rank is invalid');
    }
    if (value.reason !== undefined) {
      errors.push('/taxon cited-guess cannot carry a missing-media reason');
      reasons.push('invented-taxon');
    }
    return reasons;
  }
  errors.push('/taxon/status is invalid');
  reasons.push('invented-taxon');
  return reasons;
};

const validateMeasurement = (
  value: unknown,
  index: number,
  errors: string[],
): RefusalReason[] => {
  const reasons: RefusalReason[] = [];
  if (!isObject(value)) {
    errors.push(`/measurements/${index} must be an object`);
    return ['measurement-incomplete'];
  }
  const allowed = new Set([
    'parameterRef',
    'value',
    'unit',
    'uncertainty',
    'method',
    'scaleEvidence',
    'sampleCount',
  ]);
  if (!hasOnlyKeys(value, allowed)) {
    errors.push(`/measurements/${index} contains an unknown property`);
  }
  const complete =
    isNonBlank(value.parameterRef) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    isNonBlank(value.unit) &&
    typeof value.uncertainty === 'number' &&
    Number.isFinite(value.uncertainty) &&
    value.uncertainty >= 0 &&
    isNonBlank(value.method) &&
    isNonBlank(value.scaleEvidence);
  if (!complete) {
    errors.push(`/measurements/${index} is incomplete`);
    reasons.push('measurement-incomplete');
  }
  if (
    value.sampleCount !== undefined &&
    !(Number.isInteger(value.sampleCount) && Number(value.sampleCount) >= 1)
  ) {
    errors.push(`/measurements/${index}/sampleCount is invalid`);
    reasons.push('measurement-incomplete');
  }
  return reasons;
};

export interface Validation<T> {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly reasons: readonly RefusalReason[];
  readonly value?: T;
}

const fail = (errors: string[], reasons: RefusalReason[]): Validation<never> => ({
  valid: false,
  errors,
  reasons: [...new Set(reasons.length > 0 ? reasons : ['contract-invalid'])],
});

export const validateObservation = (input: unknown): Validation<Observation> => {
  const errors: string[] = [];
  const reasons: RefusalReason[] = collectForbiddenReasons(input);
  if (!isObject(input)) return fail(['/ must be an object'], reasons);
  const allowed = new Set([
    'schemaVersion',
    'kind',
    'observationId',
    'workspaceRef',
    'recordedAt',
    'media',
    'statements',
    'measurements',
    'taxon',
    'review',
  ]);
  if (!hasOnlyKeys(input, allowed)) errors.push('/ contains an unknown property');
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push('/schemaVersion is invalid');
  if (input.kind !== 'Observation') errors.push('/kind must equal Observation');
  if (!isNonBlank(input.observationId) || !ID.test(input.observationId)) {
    errors.push('/observationId is invalid');
  }
  if (input.workspaceRef !== WORKSPACE_REF) errors.push('/workspaceRef is invalid');
  if (!dateOk(input.recordedAt)) errors.push('/recordedAt is invalid');
  if (!isObject(input.media)) {
    errors.push('/media must be an object');
    reasons.push('no-real-media');
  } else {
    if (
      !hasOnlyKeys(
        input.media,
        new Set(['path', 'sha256', 'mediaType', 'license', 'consent']),
      )
    ) {
      errors.push('/media contains an unknown property');
    }
    if (!isNonBlank(input.media.path) || !RELATIVE.test(input.media.path)) {
      errors.push('/media/path is invalid');
    }
    if (!isNonBlank(input.media.sha256) || !SHA256.test(input.media.sha256)) {
      errors.push('/media/sha256 is invalid');
      reasons.push('missing-digest');
    }
    if (!isNonBlank(input.media.mediaType) || !MEDIA_TYPE.test(input.media.mediaType)) {
      errors.push('/media/mediaType is invalid');
    }
    if (!isNonBlank(input.media.license)) {
      errors.push('/media/license is required');
      reasons.push('missing-license');
    }
    if (!isNonBlank(input.media.consent)) {
      errors.push('/media/consent is required');
      reasons.push('missing-consent');
    }
  }
  if (!Array.isArray(input.statements) || input.statements.length < 1) {
    errors.push('/statements requires at least one item');
    reasons.push('unobserved-statement');
  } else {
    let observed = 0;
    input.statements.forEach((statement, index) => {
      if (!isObject(statement)) {
        errors.push(`/statements/${index} must be an object`);
        return;
      }
      if (!hasOnlyKeys(statement, new Set(['text', 'status', 'sourceRef']))) {
        errors.push(`/statements/${index} contains an unknown property`);
      }
      if (!isNonBlank(statement.text)) errors.push(`/statements/${index}/text is required`);
      if (!['observed', 'interpreted', 'unverified'].includes(String(statement.status))) {
        errors.push(`/statements/${index}/status is invalid`);
      }
      if (statement.status === 'observed') observed += 1;
      if (statement.sourceRef !== undefined && !isNonBlank(statement.sourceRef)) {
        errors.push(`/statements/${index}/sourceRef is invalid`);
      }
    });
    if (observed < 1) {
      errors.push('/statements requires an observed item');
      reasons.push('unobserved-statement');
    }
  }
  if (input.measurements !== undefined) {
    if (!Array.isArray(input.measurements)) {
      errors.push('/measurements must be an array');
    } else {
      input.measurements.forEach((measurement, index) => {
        reasons.push(...validateMeasurement(measurement, index, errors));
      });
    }
  }
  reasons.push(...validateTaxon(input.taxon, errors));
  validateReview(input.review, errors);
  if (errors.length > 0 || reasons.length > 0) return fail(errors, reasons);
  return { valid: true, errors: [], reasons: [], value: input as Observation };
};

export const validateStructure = (
  input: unknown,
  observation?: Observation,
): Validation<Structure> => {
  const errors: string[] = [];
  const reasons: RefusalReason[] = collectForbiddenReasons(input);
  if (!isObject(input)) return fail(['/ must be an object'], reasons);
  if (observation === undefined) reasons.push('missing-observation');
  const allowed = new Set([
    'schemaVersion',
    'kind',
    'structureId',
    'observationRef',
    'workspaceRef',
    'basis',
    'description',
    'review',
  ]);
  if (!hasOnlyKeys(input, allowed)) errors.push('/ contains an unknown property');
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push('/schemaVersion is invalid');
  if (input.kind !== 'Structure') errors.push('/kind must equal Structure');
  if (!isNonBlank(input.structureId) || !ID.test(input.structureId)) {
    errors.push('/structureId is invalid');
  }
  if (!isNonBlank(input.observationRef) || !ID.test(input.observationRef)) {
    errors.push('/observationRef is invalid');
    reasons.push('missing-observation');
  }
  if (
    observation !== undefined &&
    input.observationRef !== observation.observationId
  ) {
    errors.push('/observationRef does not match the supplied observation');
    reasons.push('missing-observation');
  }
  if (input.workspaceRef !== WORKSPACE_REF) errors.push('/workspaceRef is invalid');
  const basis = String(input.basis);
  if (
    ![
      'observed',
      'measured',
      'calculated',
      'simulated',
      'ref',
      'target',
      'typ',
      'unverified',
    ].includes(basis)
  ) {
    errors.push('/basis is invalid');
  }
  if (basis === 'observed' && observation !== undefined) {
    const visible = observation.statements.some(
      (statement) => statement.status === 'observed',
    );
    if (!visible) reasons.push('unobserved-statement');
  }
  if (
    basis === 'measured' &&
    (observation === undefined || (observation.measurements?.length ?? 0) < 1)
  ) {
    reasons.push('measurement-incomplete');
  }
  if (!isNonBlank(input.description)) errors.push('/description is required');
  validateReview(input.review, errors);
  if (errors.length > 0 || reasons.length > 0) return fail(errors, reasons);
  return { valid: true, errors: [], reasons: [], value: input as Structure };
};

export const validateMechanism = (
  input: unknown,
  structure?: Structure,
): Validation<Mechanism> => {
  const errors: string[] = [];
  const reasons: RefusalReason[] = collectForbiddenReasons(input);
  if (!isObject(input)) return fail(['/ must be an object'], reasons);
  if (structure === undefined) reasons.push('missing-structure');
  const allowed = new Set([
    'schemaVersion',
    'kind',
    'mechanismId',
    'structureRef',
    'workspaceRef',
    'hypothesis',
    'falsifier',
    'status',
    'states',
    'members',
    'failureModes',
    'verificationPlan',
    'review',
  ]);
  if (!hasOnlyKeys(input, allowed)) errors.push('/ contains an unknown property');
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push('/schemaVersion is invalid');
  if (input.kind !== 'Mechanism') errors.push('/kind must equal Mechanism');
  if (!isNonBlank(input.mechanismId) || !ID.test(input.mechanismId)) {
    errors.push('/mechanismId is invalid');
  }
  if (!isNonBlank(input.structureRef) || !ID.test(input.structureRef)) {
    errors.push('/structureRef is invalid');
    reasons.push('missing-structure');
  }
  if (structure !== undefined && input.structureRef !== structure.structureId) {
    reasons.push('missing-structure');
  }
  if (input.workspaceRef !== WORKSPACE_REF) errors.push('/workspaceRef is invalid');
  if (!isNonBlank(input.hypothesis)) errors.push('/hypothesis is required');
  if (!isNonBlank(input.falsifier)) errors.push('/falsifier is required');
  if (input.status === 'observed') reasons.push('source-class-relabeled');
  if (input.status !== 'interpreted' && input.status !== 'unverified') {
    errors.push('/status is invalid');
  }
  if (!uniqueNonBlank(input.states, 1)) errors.push('/states is invalid');
  if (!isObject(input.members)) {
    errors.push('/members must be an object');
  } else {
    if (!hasOnlyKeys(input.members, new Set(['moving', 'grounded']))) {
      errors.push('/members contains an unknown property');
    }
    if (!Array.isArray(input.members.moving) || !input.members.moving.every(isNonBlank)) {
      errors.push('/members/moving is invalid');
    }
    if (
      !Array.isArray(input.members.grounded) ||
      !input.members.grounded.every(isNonBlank)
    ) {
      errors.push('/members/grounded is invalid');
    }
  }
  if (!Array.isArray(input.failureModes) || input.failureModes.length < 1) {
    errors.push('/failureModes requires at least one item');
  }
  if (!isNonBlank(input.verificationPlan)) errors.push('/verificationPlan is required');
  validateReview(input.review, errors);
  if (errors.length > 0 || reasons.length > 0) return fail(errors, reasons);
  return { valid: true, errors: [], reasons: [], value: input as Mechanism };
};

export const validateFunction = (
  input: unknown,
  mechanism?: Mechanism,
): Validation<BiologicalFunction> => {
  const errors: string[] = [];
  const reasons: RefusalReason[] = collectForbiddenReasons(input);
  if (!isObject(input)) return fail(['/ must be an object'], reasons);
  if (mechanism === undefined) reasons.push('missing-mechanism');
  const allowed = new Set([
    'schemaVersion',
    'kind',
    'functionId',
    'mechanismRef',
    'workspaceRef',
    'statement',
    'status',
    'limits',
    'review',
  ]);
  if (!hasOnlyKeys(input, allowed)) errors.push('/ contains an unknown property');
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push('/schemaVersion is invalid');
  if (input.kind !== 'Function') errors.push('/kind must equal Function');
  if (!isNonBlank(input.functionId) || !ID.test(input.functionId)) {
    errors.push('/functionId is invalid');
  }
  if (!isNonBlank(input.mechanismRef) || !ID.test(input.mechanismRef)) {
    errors.push('/mechanismRef is invalid');
    reasons.push('missing-mechanism');
  }
  if (mechanism !== undefined && input.mechanismRef !== mechanism.mechanismId) {
    reasons.push('missing-mechanism');
  }
  if (input.workspaceRef !== WORKSPACE_REF) errors.push('/workspaceRef is invalid');
  if (!isNonBlank(input.statement)) errors.push('/statement is required');
  if (input.status === 'observed') reasons.push('source-class-relabeled');
  if (input.status !== 'interpreted' && input.status !== 'unverified') {
    errors.push('/status is invalid');
  }
  if (!Array.isArray(input.limits) || input.limits.length < 1 || !input.limits.every(isNonBlank)) {
    errors.push('/limits requires at least one item');
  }
  validateReview(input.review, errors);
  if (errors.length > 0 || reasons.length > 0) return fail(errors, reasons);
  return { valid: true, errors: [], reasons: [], value: input as BiologicalFunction };
};

export const validateAnalog = (
  input: unknown,
  fn?: BiologicalFunction,
): Validation<AnalogLink> => {
  const errors: string[] = [];
  const reasons: RefusalReason[] = collectForbiddenReasons(input);
  if (!isObject(input)) return fail(['/ must be an object'], reasons);
  if (fn === undefined) reasons.push('missing-function');
  const allowed = new Set([
    'schemaVersion',
    'kind',
    'analogId',
    'functionRef',
    'workspaceRef',
    'target',
    'direction',
    'equivalent',
    'limit',
    'nonEquivalence',
    'note',
    'review',
  ]);
  if (!hasOnlyKeys(input, allowed)) errors.push('/ contains an unknown property');
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push('/schemaVersion is invalid');
  if (input.kind !== 'AnalogLink') errors.push('/kind must equal AnalogLink');
  if (!isNonBlank(input.analogId) || !ID.test(input.analogId)) {
    errors.push('/analogId is invalid');
  }
  if (!isNonBlank(input.functionRef) || !ID.test(input.functionRef)) {
    errors.push('/functionRef is invalid');
    reasons.push('missing-function');
  }
  if (fn !== undefined && input.functionRef !== fn.functionId) {
    reasons.push('missing-function');
  }
  if (input.workspaceRef !== WORKSPACE_REF) errors.push('/workspaceRef is invalid');
  if (!isNonBlank(input.target)) errors.push('/target is required');
  if (isNonBlank(input.target)) {
    reasons.push(...refuseLabAsSpecimen(input.target));
  }
  if (input.direction !== 'biology-to-engineering' || input.equivalent !== false) {
    errors.push('/direction and equivalent must remain biology-to-engineering / false');
    reasons.push('engineering-as-biology');
  }
  if (!isNonBlank(input.limit)) errors.push('/limit is required');
  if (!isNonBlank(input.nonEquivalence)) errors.push('/nonEquivalence is required');
  if (input.note !== undefined && !isNonBlank(input.note)) errors.push('/note is invalid');
  validateReview(input.review, errors);
  if (errors.length > 0 || reasons.length > 0) return fail(errors, reasons);
  return { valid: true, errors: [], reasons: [], value: input as AnalogLink };
};

export const validateObservationCatalog = (
  input: unknown,
): Validation<ObservationCatalog> => {
  const errors: string[] = [];
  const reasons: RefusalReason[] = collectForbiddenReasons(input);
  if (!isObject(input)) return fail(['/ must be an object'], reasons);
  if (input.kind !== 'ObservationCatalog') errors.push('/kind is invalid');
  if (input.workspaceRef !== WORKSPACE_REF) errors.push('/workspaceRef is invalid');
  if (input.catalogSpecimen !== false) reasons.push('lab-as-specimen');
  reasons.push(...validateTaxon(input.taxon, errors));
  if (!Array.isArray(input.records)) {
    errors.push('/records must be an array');
  } else {
    input.records.forEach((record) => {
      const inner = validateObservation(record);
      if (!inner.valid) {
        errors.push(...inner.errors);
        reasons.push(...inner.reasons);
      }
    });
  }
  if (errors.length > 0 || reasons.length > 0) return fail(errors, reasons);
  return { valid: true, errors: [], reasons: [], value: input as ObservationCatalog };
};

export const asReview = (value: Review): Review => value;

export type { Measurement };
