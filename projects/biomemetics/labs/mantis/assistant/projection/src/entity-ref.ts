export const ENTITY_REF_PATTERN =
  /^gbg:([a-z][a-z0-9-]*):([A-Za-z0-9._:-]+)(?:@([A-Za-z0-9._-]+))?$/;

export type EntityRef = string & { readonly __brand: 'EntityRef' };

export type HonestyClass = 'projected';

export type MintedEntity = {
  readonly ref: EntityRef;
  readonly kind: 'preview' | 'receipt';
  readonly honestyClass: HonestyClass;
};

const brandRef = (value: string): EntityRef => {
  if (!ENTITY_REF_PATTERN.test(value)) {
    throw new TypeError(`entity ref must match ${ENTITY_REF_PATTERN.source}`);
  }
  return value as EntityRef;
};

export function mintPreviewRef(input: {
  readonly evidenceId: string;
  readonly targetId: string;
  readonly payloadDigest: string;
}): MintedEntity {
  return {
    ref: brandRef(
      `gbg:preview:${input.evidenceId}:${input.targetId}@${input.payloadDigest}`,
    ),
    kind: 'preview',
    honestyClass: 'projected',
  };
}

export function mintReceiptRef(input: {
  readonly evidenceId: string;
  readonly targetId: string;
  readonly payloadDigest: string;
}): MintedEntity {
  return {
    ref: brandRef(
      `gbg:receipt:${input.evidenceId}:${input.targetId}@${input.payloadDigest}`,
    ),
    kind: 'receipt',
    honestyClass: 'projected',
  };
}

export function parseEntityRef(
  ref: string,
): { readonly kind: string; readonly local: string; readonly rev: string | undefined } | undefined {
  const match = ENTITY_REF_PATTERN.exec(ref);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return undefined;
  }
  return { kind: match[1], local: match[2], rev: match[3] };
}
