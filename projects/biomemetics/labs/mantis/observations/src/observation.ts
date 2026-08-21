import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

import {
  PipelineRefused as Refused,
  SCHEMA_VERSION,
  WORKSPACE_REF,
  type MediaProvenance,
  type Observation,
  type RefusalReason,
  type Review,
  type Taxon,
} from './types.ts';
import {
  collectForbiddenReasons,
  isNonBlank,
  isObject,
  validateObservation,
} from './validate.ts';

const MEDIA_EXT = /\.(avif|gif|heic|heif|jpe?g|mp4|png|tif|tiff|webm|webp)$/i;

export const isRealMediaFile = (name: string): boolean =>
  MEDIA_EXT.test(name) && !name.startsWith('.');

export interface MediaAdmission {
  readonly lanesRelativePath: string;
  readonly absolutePath: string;
  readonly observationId: string;
  readonly recordedAt: string;
  readonly license: string;
  readonly consent: string;
  readonly mediaType: string;
  readonly statements: Observation['statements'];
  readonly measurements?: Observation['measurements'];
  readonly taxon?: Taxon;
  readonly review: Review;
  readonly caller?: unknown;
}

const digestFile = (absolutePath: string): string => {
  const bytes = readFileSync(absolutePath);
  return createHash('sha256').update(bytes).digest('hex');
};

export const admitObservation = (admission: MediaAdmission): Observation => {
  const reasons: RefusalReason[] = [
    ...collectForbiddenReasons(admission),
    ...collectForbiddenReasons(admission.caller),
  ];
  try {
    const stats = statSync(admission.absolutePath);
    if (!stats.isFile()) reasons.push('no-real-media');
  } catch {
    reasons.push('no-real-media');
  }
  if (!isRealMediaFile(basename(admission.absolutePath))) {
    reasons.push('no-real-media');
  }
  if (!isNonBlank(admission.license)) reasons.push('missing-license');
  if (!isNonBlank(admission.consent)) reasons.push('missing-consent');

  let sha256 = '';
  if (!reasons.includes('no-real-media')) {
    sha256 = digestFile(admission.absolutePath);
  } else {
    reasons.push('missing-digest');
  }

  const media: MediaProvenance = {
    path: admission.lanesRelativePath.replaceAll('\\', '/'),
    sha256,
    mediaType: admission.mediaType,
    license: admission.license,
    consent: admission.consent,
  };

  const taxon: Taxon =
    admission.taxon ??
    ({ status: 'unknown', reason: 'media-without-citation' } as const);

  const record = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Observation' as const,
    observationId: admission.observationId,
    workspaceRef: WORKSPACE_REF,
    recordedAt: admission.recordedAt,
    media,
    statements: admission.statements,
    ...(admission.measurements === undefined
      ? {}
      : { measurements: admission.measurements }),
    taxon,
    review: admission.review,
  };

  const validated = validateObservation(record);
  if (!validated.valid || validated.value === undefined) {
    throw new Refused([...new Set([...reasons, ...validated.reasons])]);
  }
  if (reasons.length > 0) throw new Refused([...new Set(reasons)]);
  return validated.value;
};

export const loadProvenanceSidecar = (mediaAbsolutePath: string): JsonSidecar => {
  const sidecarPath = `${mediaAbsolutePath}.provenance.json`;
  const raw = JSON.parse(readFileSync(sidecarPath, 'utf8')) as unknown;
  const reasons = collectForbiddenReasons(raw);
  if (reasons.length > 0) throw new Refused(reasons);
  if (!isObject(raw)) throw new Refused(['contract-invalid']);
  return raw;
};

type JsonSidecar = Record<string, unknown>;
