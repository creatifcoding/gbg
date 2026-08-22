export const PART_CLASSES = [
  'REF',
  'UNVERIFIED',
  'LOCK',
  'DRAFT',
  'orderable',
] as const;

export type PartClass = (typeof PART_CLASSES)[number];

export type GateReason =
  | 'class_null'
  | 'class_unverified'
  | 'class_draft'
  | 'class_not_orderable'
  | 'missing_sku'
  | 'missing_vendor'
  | 'missing_quote';

export type GateResult = { ok: true } | { ok: false; reason: GateReason };

export type IssueCandidate = {
  class: PartClass | null;
  skuId: string | null;
  vendorId: string | null;
  quoteId: string | null;
};

const isPartClass = (value: string): value is PartClass =>
  (PART_CLASSES as readonly string[]).includes(value);

export const parsePartClass = (value: string | null): PartClass | null => {
  if (value === null) {
    return null;
  }
  if (!isPartClass(value)) {
    return null;
  }
  return value;
};

export const canIssuePurchaseOrder = (
  candidate: IssueCandidate,
): GateResult => {
  if (candidate.class === null) {
    return { ok: false, reason: 'class_null' };
  }
  if (candidate.class === 'UNVERIFIED') {
    return { ok: false, reason: 'class_unverified' };
  }
  if (candidate.class === 'DRAFT') {
    return { ok: false, reason: 'class_draft' };
  }
  if (candidate.class !== 'orderable') {
    return { ok: false, reason: 'class_not_orderable' };
  }
  if (candidate.skuId === null || candidate.skuId === '') {
    return { ok: false, reason: 'missing_sku' };
  }
  if (candidate.vendorId === null || candidate.vendorId === '') {
    return { ok: false, reason: 'missing_vendor' };
  }
  if (candidate.quoteId === null || candidate.quoteId === '') {
    return { ok: false, reason: 'missing_quote' };
  }
  return { ok: true };
};

export const gateCopy: Record<GateReason, string> = {
  class_null: 'No class token. Fail closed. Not an order.',
  class_unverified: 'UNVERIFIED cannot become an order.',
  class_draft: 'DRAFT cannot become an order.',
  class_not_orderable:
    'REF and LOCK are design confidence, not a buy. orderable is its own class.',
  missing_sku: 'No manufacturer SKU. A blank socket is not a part number.',
  missing_vendor: 'No supplier party. A name in a sentence is not a vendor row.',
  missing_quote: 'No quote. Cannot issue a purchase order.',
};
