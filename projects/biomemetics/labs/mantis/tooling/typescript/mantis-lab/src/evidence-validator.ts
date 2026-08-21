import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { ValidatedEvidenceRecord } from './domain.ts';

export const EVIDENCE_SCHEMA_PATH = 'contracts/evidence.schema.json' as const;
export const EVIDENCE_SCHEMA_SHA256 =
  'bf38331eb8f66d1152e0ef16ab003ebc6fb4c5d9ec9b06cf395860e2f3485cf1' as const;

export interface EvidenceValidationSuccess {
  readonly valid: true;
  readonly value: ValidatedEvidenceRecord;
}

export interface EvidenceValidationFailure {
  readonly valid: false;
  readonly errors: readonly string[];
}

/**
 * Runtime gate created only by `loadEvidenceRuntimeValidator`. The WeakSet
 * check in the bridge rejects structurally similar caller objects.
 */
export interface EvidenceRuntimeValidator {
  readonly schemaPath: typeof EVIDENCE_SCHEMA_PATH;
  readonly schemaSha256: typeof EVIDENCE_SCHEMA_SHA256;
  readonly validate: (
    input: unknown,
  ) => EvidenceValidationSuccess | EvidenceValidationFailure;
}

const validators = new WeakSet<object>();
const schemaUrl = new URL(
  '../../../../contracts/evidence.schema.json',
  import.meta.url,
);

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonBlank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const hasOnlyKeys = (value: JsonObject, allowed: ReadonlySet<string>): boolean =>
  Object.keys(value).every((key) => allowed.has(key));

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);

const isDateTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value,
  ) &&
  Number.isFinite(Date.parse(value));

const uniqueNonBlankStrings = (value: unknown, minItems = 0): value is string[] =>
  Array.isArray(value) &&
  value.length >= minItems &&
  value.every(isNonBlank) &&
  new Set(value).size === value.length;

const push = (errors: string[], condition: boolean, path: string): void => {
  if (!condition) errors.push(path);
};

const validateProducer = (value: unknown, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push('/producer must be an object');
    return;
  }
  push(
    errors,
    hasOnlyKeys(value, new Set(['kind', 'name', 'version', 'model'])),
    '/producer contains an unknown property',
  );
  push(
    errors,
    ['human', 'agent', 'tool', 'instrument'].includes(String(value.kind)),
    '/producer/kind is invalid',
  );
  push(errors, isNonBlank(value.name), '/producer/name is required');
  if (value.version !== undefined) {
    push(errors, isNonBlank(value.version), '/producer/version is invalid');
  }
  if (value.model !== undefined) {
    push(errors, isNonBlank(value.model), '/producer/model is invalid');
  }
};

const validateEnvironment = (value: unknown, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push('/environment must be an object');
    return;
  }
  push(
    errors,
    hasOnlyKeys(
      value,
      new Set(['description', 'nixDerivation', 'gitCommit', 'hardware']),
    ),
    '/environment contains an unknown property',
  );
  push(errors, isNonBlank(value.description), '/environment/description is required');
  if (value.nixDerivation !== undefined) {
    push(
      errors,
      isNonBlank(value.nixDerivation),
      '/environment/nixDerivation is invalid',
    );
  }
  if (value.gitCommit !== undefined) {
    push(
      errors,
      typeof value.gitCommit === 'string' && /^[a-fA-F0-9]{7,64}$/.test(value.gitCommit),
      '/environment/gitCommit is invalid',
    );
  }
  if (value.hardware !== undefined) {
    push(
      errors,
      uniqueNonBlankStrings(value.hardware),
      '/environment/hardware is invalid',
    );
  }
};

const validateMethod = (value: unknown, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push('/method must be an object');
    return;
  }
  push(
    errors,
    hasOnlyKeys(value, new Set(['protocol', 'acceptance', 'deviations'])),
    '/method contains an unknown property',
  );
  push(errors, isNonBlank(value.protocol), '/method/protocol is required');
  push(errors, isNonBlank(value.acceptance), '/method/acceptance is required');
  if (value.deviations !== undefined) {
    push(errors, uniqueNonBlankStrings(value.deviations), '/method/deviations is invalid');
  }
};

const validateInputs = (value: unknown, errors: string[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('/inputs must be an array');
    return;
  }
  value.forEach((input, index) => {
    if (!isObject(input)) {
      errors.push(`/inputs/${index} must be an object`);
      return;
    }
    push(
      errors,
      hasOnlyKeys(input, new Set(['ref', 'role', 'sha256'])),
      `/inputs/${index} contains an unknown property`,
    );
    push(errors, isNonBlank(input.ref), `/inputs/${index}/ref is required`);
    push(errors, isNonBlank(input.role), `/inputs/${index}/role is required`);
    if (input.sha256 !== undefined) {
      push(errors, isSha256(input.sha256), `/inputs/${index}/sha256 is invalid`);
    }
  });
};

const validateObservations = (value: unknown, errors: string[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('/observations must be an array');
    return;
  }
  value.forEach((observation, index) => {
    if (!isObject(observation)) {
      errors.push(`/observations/${index} must be an object`);
      return;
    }
    push(
      errors,
      hasOnlyKeys(observation, new Set(['statement', 'status', 'sourceRef'])),
      `/observations/${index} contains an unknown property`,
    );
    push(
      errors,
      isNonBlank(observation.statement),
      `/observations/${index}/statement is required`,
    );
    push(
      errors,
      ['observed', 'interpreted', 'unverified'].includes(String(observation.status)),
      `/observations/${index}/status is invalid`,
    );
    if (observation.sourceRef !== undefined) {
      push(
        errors,
        isNonBlank(observation.sourceRef),
        `/observations/${index}/sourceRef is invalid`,
      );
    }
  });
};

const validateMeasurements = (value: unknown, errors: string[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('/measurements must be an array');
    return;
  }
  value.forEach((measurement, index) => {
    if (!isObject(measurement)) {
      errors.push(`/measurements/${index} must be an object`);
      return;
    }
    push(
      errors,
      hasOnlyKeys(
        measurement,
        new Set(['parameterRef', 'value', 'unit', 'uncertainty', 'sampleCount']),
      ),
      `/measurements/${index} contains an unknown property`,
    );
    push(
      errors,
      isNonBlank(measurement.parameterRef),
      `/measurements/${index}/parameterRef is required`,
    );
    push(
      errors,
      typeof measurement.value === 'number' && Number.isFinite(measurement.value),
      `/measurements/${index}/value is invalid`,
    );
    push(errors, isNonBlank(measurement.unit), `/measurements/${index}/unit is required`);
    push(
      errors,
      typeof measurement.uncertainty === 'number' &&
        Number.isFinite(measurement.uncertainty) &&
        measurement.uncertainty >= 0,
      `/measurements/${index}/uncertainty is invalid`,
    );
    if (measurement.sampleCount !== undefined) {
      push(
        errors,
        Number.isInteger(measurement.sampleCount) && Number(measurement.sampleCount) >= 1,
        `/measurements/${index}/sampleCount is invalid`,
      );
    }
  });
};

const validateArtifacts = (value: unknown, errors: string[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('/artifacts must be an array');
    return;
  }
  value.forEach((artifact, index) => {
    if (!isObject(artifact)) {
      errors.push(`/artifacts/${index} must be an object`);
      return;
    }
    push(
      errors,
      hasOnlyKeys(
        artifact,
        new Set(['path', 'uri', 'sha256', 'mediaType', 'description']),
      ),
      `/artifacts/${index} contains an unknown property`,
    );
    push(
      errors,
      isNonBlank(artifact.mediaType),
      `/artifacts/${index}/mediaType is required`,
    );
    const path = isNonBlank(artifact.path) ? artifact.path : undefined;
    const uri = isNonBlank(artifact.uri) ? artifact.uri : undefined;
    push(
      errors,
      (path !== undefined) !== (uri !== undefined),
      `/artifacts/${index} requires path xor uri`,
    );
    push(
      errors,
      isSha256(artifact.sha256),
      `/artifacts/${index}/sha256 is required for path and uri artifacts`,
    );
    if (path !== undefined) {
      push(
        errors,
        !path.startsWith('/') && !path.split('/').includes('..'),
        `/artifacts/${index}/path is invalid`,
      );
    }
    if (uri !== undefined) {
      try {
        new URL(uri);
      } catch {
        errors.push(`/artifacts/${index}/uri is invalid`);
      }
    }
    if (artifact.description !== undefined) {
      push(
        errors,
        isNonBlank(artifact.description),
        `/artifacts/${index}/description is invalid`,
      );
    }
  });
};

const validateAdmissions = (value: unknown, errors: string[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('/admissions must be an array');
    return;
  }
  value.forEach((admission, index) => {
    if (!isObject(admission)) {
      errors.push(`/admissions/${index} must be an object`);
      return;
    }
    push(
      errors,
      hasOnlyKeys(
        admission,
        new Set(['claimRef', 'kind', 'text', 'target', 'projectionBinding']),
      ),
      `/admissions/${index} contains an unknown property`,
    );
    push(
      errors,
      isNonBlank(admission.claimRef),
      `/admissions/${index}/claimRef is required`,
    );
    const kind = String(admission.kind);
    push(
      errors,
      ['observation', 'structure', 'mechanism', 'function', 'analog'].includes(kind),
      `/admissions/${index}/kind is invalid`,
    );
    push(errors, isNonBlank(admission.text), `/admissions/${index}/text is required`);
    if (kind === 'analog') {
      push(errors, isNonBlank(admission.target), `/admissions/${index}/target is required`);
    } else {
      push(
        errors,
        admission.target === undefined,
        `/admissions/${index}/target is allowed only for analog`,
      );
    }
    if (admission.projectionBinding !== undefined) {
      if (!isObject(admission.projectionBinding)) {
        errors.push(`/admissions/${index}/projectionBinding must be an object`);
      } else {
        const binding = admission.projectionBinding;
        push(
          errors,
          hasOnlyKeys(
            binding,
            new Set(['evidenceId', 'claimRef', 'admissionText', 'reviewStatus']),
          ),
          `/admissions/${index}/projectionBinding contains an unknown property`,
        );
        push(
          errors,
          isNonBlank(binding.evidenceId),
          `/admissions/${index}/projectionBinding/evidenceId is required`,
        );
        push(
          errors,
          binding.claimRef === admission.claimRef,
          `/admissions/${index}/projectionBinding/claimRef must equal admission claimRef`,
        );
        push(
          errors,
          binding.admissionText === admission.text,
          `/admissions/${index}/projectionBinding/admissionText must equal admission text`,
        );
        push(
          errors,
          binding.reviewStatus === 'accepted',
          `/admissions/${index}/projectionBinding/reviewStatus must be accepted`,
        );
      }
    }
  });
};

const validateResult = (value: unknown, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push('/result must be an object');
    return;
  }
  push(
    errors,
    hasOnlyKeys(value, new Set(['disposition', 'summary', 'limitations'])),
    '/result contains an unknown property',
  );
  push(
    errors,
    ['supports', 'contradicts', 'inconclusive', 'not-run'].includes(
      String(value.disposition),
    ),
    '/result/disposition is invalid',
  );
  push(errors, isNonBlank(value.summary), '/result/summary is required');
  push(
    errors,
    uniqueNonBlankStrings(value.limitations, 1),
    '/result/limitations requires at least one item',
  );
};

const validateReview = (value: unknown, errors: string[]): void => {
  if (!isObject(value)) {
    errors.push('/review must be an object');
    return;
  }
  push(
    errors,
    hasOnlyKeys(value, new Set(['status', 'reviewer', 'reviewedAt', 'notes'])),
    '/review contains an unknown property',
  );
  const status = String(value.status);
  push(
    errors,
    ['pending', 'accepted', 'rejected', 'superseded'].includes(status),
    '/review/status is invalid',
  );
  if (status === 'accepted' || status === 'rejected') {
    push(errors, isNonBlank(value.reviewer), '/review/reviewer is required');
    push(errors, isDateTime(value.reviewedAt), '/review/reviewedAt is required');
  }
  if (value.reviewer !== undefined) {
    push(errors, isNonBlank(value.reviewer), '/review/reviewer is invalid');
  }
  if (value.reviewedAt !== undefined) {
    push(errors, isDateTime(value.reviewedAt), '/review/reviewedAt is invalid');
  }
  if (value.notes !== undefined) {
    push(errors, isNonBlank(value.notes), '/review/notes is invalid');
  }
};

const validateRecord = (
  input: unknown,
): EvidenceValidationSuccess | EvidenceValidationFailure => {
  const errors: string[] = [];
  if (!isObject(input)) {
    return { valid: false, errors: ['/ must be an object'] };
  }

  const allowed = new Set([
    '$schema',
    'schemaVersion',
    'kind',
    'evidenceId',
    'workspaceRef',
    'contextRef',
    'claimRefs',
    'parameterRefs',
    'sourceClass',
    'recordedAt',
    'producer',
    'environment',
    'method',
    'inputs',
    'observations',
    'measurements',
    'artifacts',
    'admissions',
    'result',
    'review',
  ]);
  push(errors, hasOnlyKeys(input, allowed), '/ contains an unknown property');
  if (input.$schema !== undefined) {
    push(errors, isNonBlank(input.$schema), '/$schema must be a string');
  }
  push(errors, input.schemaVersion === '1.0.0', '/schemaVersion must equal 1.0.0');
  push(errors, input.kind === 'EvidenceRecord', '/kind must equal EvidenceRecord');
  push(
    errors,
    typeof input.evidenceId === 'string' && /^[a-z][a-z0-9.-]*$/.test(input.evidenceId),
    '/evidenceId is invalid',
  );
  push(
    errors,
    input.workspaceRef === 'biomemetics.mantis',
    '/workspaceRef must equal biomemetics.mantis',
  );
  if (input.contextRef !== undefined) {
    push(errors, isNonBlank(input.contextRef), '/contextRef is invalid');
  }
  push(errors, uniqueNonBlankStrings(input.claimRefs, 1), '/claimRefs is invalid');
  if (input.parameterRefs !== undefined) {
    push(errors, uniqueNonBlankStrings(input.parameterRefs), '/parameterRefs is invalid');
  }
  const sourceClass = String(input.sourceClass);
  push(
    errors,
    ['measured', 'simulated', 'calculated', 'observed', 'external-source'].includes(
      sourceClass,
    ),
    '/sourceClass is invalid',
  );
  push(errors, isDateTime(input.recordedAt), '/recordedAt is invalid');
  validateProducer(input.producer, errors);
  validateEnvironment(input.environment, errors);
  validateMethod(input.method, errors);
  validateInputs(input.inputs, errors);
  validateObservations(input.observations, errors);
  validateMeasurements(input.measurements, errors);
  validateArtifacts(input.artifacts, errors);
  validateAdmissions(input.admissions, errors);
  validateResult(input.result, errors);
  validateReview(input.review, errors);

  const inputs = Array.isArray(input.inputs) ? input.inputs : [];
  const observations = Array.isArray(input.observations) ? input.observations : [];
  const measurements = Array.isArray(input.measurements) ? input.measurements : [];
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  const admissions = Array.isArray(input.admissions) ? input.admissions : [];
  const claimRefs = Array.isArray(input.claimRefs) ? input.claimRefs : [];
  const review = isObject(input.review) ? input.review : {};
  admissions.forEach((admission, index) => {
    if (isObject(admission)) {
      push(
        errors,
        claimRefs.includes(admission.claimRef),
        `/admissions/${index}/claimRef must occur in /claimRefs`,
      );
      if (admission.projectionBinding !== undefined) {
        push(
          errors,
          review.status === 'accepted',
          `/admissions/${index}/projectionBinding requires /review/status accepted`,
        );
        if (isObject(admission.projectionBinding)) {
          push(
            errors,
            admission.projectionBinding.evidenceId === input.evidenceId,
            `/admissions/${index}/projectionBinding/evidenceId must equal /evidenceId`,
          );
        }
      }
    }
  });
  if (sourceClass === 'measured') {
    push(errors, measurements.length >= 1, '/measurements is required for measured');
  } else if (sourceClass === 'observed') {
    push(
      errors,
      observations.some(
        (observation) => isObject(observation) && observation.status === 'observed',
      ),
      '/observations requires an observed item for observed',
    );
  } else if (sourceClass === 'simulated' || sourceClass === 'calculated') {
    push(errors, inputs.length >= 1, '/inputs is required for model evidence');
    push(errors, artifacts.length >= 1, '/artifacts is required for model evidence');
  } else if (sourceClass === 'external-source') {
    push(errors, inputs.length >= 1, '/inputs is required for external-source');
    push(
      errors,
      observations.length >= 1 || artifacts.length >= 1,
      '/observations or /artifacts is required for external-source',
    );
  }

  return errors.length === 0
    ? { valid: true, value: input as unknown as ValidatedEvidenceRecord }
    : { valid: false, errors };
};

export const loadEvidenceRuntimeValidator = (): EvidenceRuntimeValidator => {
  const rawSchema = readFileSync(schemaUrl, 'utf8');
  const digest = createHash('sha256').update(rawSchema).digest('hex');
  if (digest !== EVIDENCE_SCHEMA_SHA256) {
    throw new Error(
      `${EVIDENCE_SCHEMA_PATH} digest changed; review the contract and validator together`,
    );
  }
  const schema = JSON.parse(rawSchema) as JsonObject;
  if (
    schema.$id !== 'urn:specimendb:biomemetics:mantis:contracts:evidence:v1' ||
    !Array.isArray(schema.allOf)
  ) {
    throw new Error(`${EVIDENCE_SCHEMA_PATH} identity or source-class gates are invalid`);
  }
  const validator: EvidenceRuntimeValidator = Object.freeze({
    schemaPath: EVIDENCE_SCHEMA_PATH,
    schemaSha256: EVIDENCE_SCHEMA_SHA256,
    validate: validateRecord,
  });
  validators.add(validator);
  return validator;
};

export const isTrustedEvidenceRuntimeValidator = (
  validator: EvidenceRuntimeValidator,
): boolean => validators.has(validator);
