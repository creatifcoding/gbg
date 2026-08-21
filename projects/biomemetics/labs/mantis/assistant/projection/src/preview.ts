import { createHash } from 'node:crypto';

import type {
  AcceptedPacket,
  EvidenceQueue,
  PacketId,
  PreviewRefusal,
  PreviewRefusalReason,
} from '../../evidence/src/index.ts';
import type { EvidenceAdmission } from '../../evidence/src/schema-gate.ts';
import {
  mintPreviewRef,
  mintReceiptRef,
  type EntityRef,
  type MintedEntity,
} from './entity-ref.ts';
import { probeAttachWell, type AttachWell } from './well.ts';

export type ExistingSpecimenId = string & { readonly __brand: 'ExistingSpecimenId' };

export type ExistingCatalogTarget = {
  readonly specimenId: ExistingSpecimenId;
  readonly ref: EntityRef;
};

export type ProjectionComponent =
  | { readonly _tag: 'Observation'; readonly text: string }
  | { readonly _tag: 'Structure'; readonly text: string }
  | { readonly _tag: 'Mechanism'; readonly text: string }
  | { readonly _tag: 'Function'; readonly text: string }
  | { readonly _tag: 'AnalogLink'; readonly target: string; readonly note: string };

export type ProjectionPayload = {
  readonly components: readonly ProjectionComponent[];
  readonly digest: string;
};

export type ProjectionPreview = {
  readonly ok: true;
  readonly packetId: PacketId;
  readonly evidenceId: string;
  readonly target: ExistingCatalogTarget;
  readonly payload: ProjectionPayload;
  readonly previewEntity: MintedEntity;
  readonly receiptEntity: MintedEntity;
  readonly well: AttachWell;
  readonly executable: false;
  readonly storeWrite: false;
  readonly localityMutated: false;
  readonly taxonMutated: false;
  readonly specimenMinted: false;
  readonly blocker: 'specimendb-attach-unavailable' | 'attach-not-live-in-a5';
};

const LAB_AS_SPECIMEN = new Set([
  'biomemetics.mantis',
  'mantis-lab',
  'projects/biomemetics/labs/mantis',
]);

const PROSE_KEYS = new Set(['component', 'components', 'analogTarget']);
const LOCALITY_KEYS = new Set([
  'locality',
  'gps',
  'geo',
  'latitude',
  'longitude',
  'altitudeMeters',
]);
const TAXON_KEYS = new Set(['taxon']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const previewRefuse = (reasons: readonly PreviewRefusalReason[]): PreviewRefusal => ({
  ok: false,
  reasons,
});

export const isTargetRefusal = (
  value: ExistingCatalogTarget | PreviewRefusal,
): value is PreviewRefusal => 'ok' in value;

const forbiddenKeys = (value: object): PreviewRefusalReason | undefined => {
  for (const key of Object.keys(value)) {
    if (PROSE_KEYS.has(key)) return 'caller-component-prose';
    if (LOCALITY_KEYS.has(key)) return 'invented-locality';
    if (TAXON_KEYS.has(key)) return 'invented-taxon';
  }
  return undefined;
};

export function parseExistingTarget(
  id: string,
): ExistingCatalogTarget | PreviewRefusal {
  const trimmed = id.trim();
  if (trimmed === '') return previewRefuse(['invented-target']);
  if (LAB_AS_SPECIMEN.has(trimmed)) return previewRefuse(['lab-as-specimen']);
  if (trimmed.startsWith('gbg:preview:') || trimmed.startsWith('gbg:receipt:')) {
    return previewRefuse(['invented-target']);
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) {
    return previewRefuse(['invented-target']);
  }
  return {
    specimenId: trimmed as ExistingSpecimenId,
    ref: `gbg:specimen:${trimmed}` as EntityRef,
  };
}

const componentFromAdmission = (
  admission: EvidenceAdmission,
): ProjectionComponent | undefined => {
  switch (admission.kind) {
    case 'observation':
      return { _tag: 'Observation', text: admission.text };
    case 'structure':
      return { _tag: 'Structure', text: admission.text };
    case 'mechanism':
      return { _tag: 'Mechanism', text: admission.text };
    case 'function':
      return { _tag: 'Function', text: admission.text };
    case 'analog':
      if (admission.target === undefined) return undefined;
      return { _tag: 'AnalogLink', target: admission.target, note: admission.text };
    default: {
      const _exhaustive: never = admission.kind;
      return _exhaustive;
    }
  }
};

export function payloadFromAccepted(
  packet: AcceptedPacket,
): ProjectionPayload | PreviewRefusal {
  const sourceClass = packet.record.sourceClass;
  if (sourceClass !== 'observed' && sourceClass !== 'measured') {
    return previewRefuse(['source-class-not-projectable']);
  }
  if (packet.record.result.disposition !== 'supports') {
    return previewRefuse(['result-does-not-support']);
  }
  const admissions = packet.record.admissions ?? [];
  if (admissions.length === 0) {
    return previewRefuse(['admission-text-missing']);
  }
  const byClaim = new Map<string, EvidenceAdmission[]>();
  for (const admission of admissions) {
    const list = byClaim.get(admission.claimRef) ?? [];
    list.push(admission);
    byClaim.set(admission.claimRef, list);
  }
  for (const list of byClaim.values()) {
    if (list.length !== 1) return previewRefuse(['admission-text-missing']);
  }
  for (const claimRef of packet.record.claimRefs) {
    if (!byClaim.has(claimRef)) return previewRefuse(['claim-unbound']);
  }
  const components: ProjectionComponent[] = [];
  for (const admission of admissions) {
    const component = componentFromAdmission(admission);
    if (component === undefined) {
      return previewRefuse(['admission-text-missing']);
    }
    components.push(component);
  }
  return {
    components,
    digest: createHash('sha256').update(JSON.stringify(components)).digest('hex'),
  };
}

export function projectAccepted(
  packet: AcceptedPacket,
  target: ExistingCatalogTarget,
  well: AttachWell,
): ProjectionPreview | PreviewRefusal {
  if (isObject(target)) {
    const smuggled = forbiddenKeys(target);
    if (smuggled !== undefined) return previewRefuse([smuggled]);
  }
  const payload = payloadFromAccepted(packet);
  if ('ok' in payload) return payload;
  const mintInput = {
    evidenceId: packet.evidenceId,
    targetId: target.specimenId,
    payloadDigest: payload.digest,
  };
  return {
    ok: true,
    packetId: packet.packetId,
    evidenceId: packet.evidenceId,
    target,
    payload,
    previewEntity: mintPreviewRef(mintInput),
    receiptEntity: mintReceiptRef(mintInput),
    well,
    executable: false,
    storeWrite: false,
    localityMutated: false,
    taxonMutated: false,
    specimenMinted: false,
    blocker: well.reason,
  };
}

export function previewAccepted(
  queue: Pick<EvidenceQueue, 'requireAccepted'>,
  packetId: PacketId,
  target: ExistingCatalogTarget,
  well: AttachWell,
): ProjectionPreview | PreviewRefusal {
  const accepted = queue.requireAccepted(packetId);
  if (accepted.ok === false) return accepted;
  return projectAccepted(accepted.packet, target, well);
}

export function planAttach(
  queue: Pick<EvidenceQueue, 'requireAccepted'>,
  packetId: PacketId,
  target: ExistingCatalogTarget,
  port: unknown,
): ProjectionPreview | PreviewRefusal {
  return previewAccepted(queue, packetId, target, probeAttachWell(port));
}
