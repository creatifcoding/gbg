import { canIssuePurchaseOrder, parsePartClass, type GateResult } from './gate';
import type { PGlite } from '@electric-sql/pglite';

export type PartRow = {
  balloon_id: string;
  name: string;
  qty_text: string;
  class: string | null;
  notes: string;
};

export type SkuWell = {
  balloon_id: string;
  sku_id: string | null;
  manufacturer: string | null;
  mpn: string | null;
  revision: string | null;
};

export type SupplierRow = {
  id: string;
  name: string;
};

export type QuoteRow = {
  quote_id: string;
  supplier_party_id: string | null;
};

export type PurchaseOrderRow = {
  po_id: string;
  supplier_party_id: string | null;
  quote_id: string | null;
  status: string;
};

export type ReceiptRow = {
  receipt_id: string;
  po_id: string | null;
  received_at: string | null;
};

export type LotRow = {
  lot_id: string;
  receipt_id: string | null;
  part_id: string;
  qty: string | null;
};

export type NeedRow = {
  balloon_id: string;
  name: string;
  qty_text: string;
  class: string | null;
  on_hand: string | null;
};

export type AlternateRow = {
  id: string;
  part_id: string;
  name: string;
  status: string;
  manufacturer: string | null;
  mpn: string | null;
  notes: string;
};

export type WhereUsedRow = {
  parent_id: string;
  child_id: string;
  relation: string;
};

const rowsOf = <T>(result: { rows: T[] }): T[] => result.rows;

export const listParts = async (db: PGlite): Promise<PartRow[]> =>
  rowsOf(
    await db.query<PartRow>(
      'SELECT balloon_id, name, qty_text, class, notes FROM part ORDER BY balloon_id',
    ),
  );

export const listSkuWells = async (db: PGlite): Promise<SkuWell[]> =>
  rowsOf(
    await db.query<SkuWell>(`
      SELECT
        p.balloon_id,
        s.id AS sku_id,
        s.manufacturer,
        s.mpn,
        s.revision
      FROM part p
      LEFT JOIN manufacturer_sku s ON s.part_id = p.balloon_id
      ORDER BY p.balloon_id
    `),
  );

export const listSuppliers = async (db: PGlite): Promise<SupplierRow[]> =>
  rowsOf(
    await db.query<SupplierRow>(
      'SELECT id, name FROM supplier_party ORDER BY name',
    ),
  );

export const listQuotes = async (db: PGlite): Promise<QuoteRow[]> =>
  rowsOf(
    await db.query<QuoteRow>(
      'SELECT quote_id, supplier_party_id FROM quote ORDER BY quote_id',
    ),
  );

export const listPurchaseOrders = async (
  db: PGlite,
): Promise<PurchaseOrderRow[]> =>
  rowsOf(
    await db.query<PurchaseOrderRow>(
      'SELECT po_id, supplier_party_id, quote_id, status FROM purchase_order ORDER BY po_id',
    ),
  );

export const countPurchaseOrders = async (db: PGlite): Promise<number> => {
  const rows = rowsOf(
    await db.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM purchase_order',
    ),
  );
  const n = rows[0]?.n;
  return n === undefined ? 0 : Number(n);
};

export const listReceipts = async (db: PGlite): Promise<ReceiptRow[]> =>
  rowsOf(
    await db.query<ReceiptRow>(
      'SELECT receipt_id, po_id, received_at FROM receipt ORDER BY receipt_id',
    ),
  );

export const listLots = async (db: PGlite): Promise<LotRow[]> =>
  rowsOf(
    await db.query<LotRow>(
      'SELECT lot_id, receipt_id, part_id, qty::text AS qty FROM lot ORDER BY lot_id',
    ),
  );

export const listNeed = async (db: PGlite): Promise<NeedRow[]> =>
  rowsOf(
    await db.query<NeedRow>(`
      SELECT
        p.balloon_id,
        p.name,
        k.qty_text,
        p.class,
        CASE
          WHEN SUM(l.qty) IS NULL THEN NULL
          ELSE SUM(l.qty)::text
        END AS on_hand
      FROM kit_line k
      JOIN part p ON p.balloon_id = k.part_id
      LEFT JOIN lot l ON l.part_id = p.balloon_id
      WHERE k.kit_id = 'first-tower'
      GROUP BY p.balloon_id, p.name, k.qty_text, p.class
      ORDER BY p.balloon_id
    `),
  );

export const listAlternates = async (db: PGlite): Promise<AlternateRow[]> =>
  rowsOf(
    await db.query<AlternateRow>(
      'SELECT id, part_id, name, status, manufacturer, mpn, notes FROM alternate ORDER BY id',
    ),
  );

export const listWhereUsed = async (db: PGlite): Promise<WhereUsedRow[]> =>
  rowsOf(
    await db.query<WhereUsedRow>(
      'SELECT parent_id, child_id, relation FROM where_used ORDER BY parent_id, child_id',
    ),
  );

export const countTable = async (db: PGlite, table: string): Promise<number> => {
  const result = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  const n = result.rows[0]?.n ?? '0';
  return Number(n);
};

export const issuePurchaseOrder = async (
  db: PGlite,
  input: {
    poId: string;
    lineId: string;
    partId: string;
    qty: number;
    skuId: string | null;
    vendorId: string | null;
    quoteId: string | null;
  },
): Promise<GateResult> => {
  const part = await db.query<PartRow>(
    'SELECT balloon_id, name, qty_text, class, notes FROM part WHERE balloon_id = $1',
    [input.partId],
  );
  const row = part.rows[0];
  if (!row) {
    return { ok: false, reason: 'class_null' };
  }
  const preview = canIssuePurchaseOrder({
    class: parsePartClass(row.class),
    skuId: input.skuId,
    vendorId: input.vendorId,
    quoteId: input.quoteId,
  });
  if (!preview.ok) {
    return preview;
  }

  try {
    await db.query(
      `INSERT INTO purchase_order (po_id, supplier_party_id, quote_id, status)
       VALUES ($1, $2, $3, 'issued')`,
      [input.poId, input.vendorId, input.quoteId],
    );
    await db.query(
      `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.lineId, input.poId, input.partId, input.skuId, input.qty],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('class_null')) {
      return { ok: false, reason: 'class_null' };
    }
    if (message.includes('class_unverified')) {
      return { ok: false, reason: 'class_unverified' };
    }
    if (message.includes('class_draft')) {
      return { ok: false, reason: 'class_draft' };
    }
    if (message.includes('class_not_orderable')) {
      return { ok: false, reason: 'class_not_orderable' };
    }
    if (message.includes('missing_sku')) {
      return { ok: false, reason: 'missing_sku' };
    }
    if (message.includes('missing_vendor')) {
      return { ok: false, reason: 'missing_vendor' };
    }
    if (message.includes('missing_quote')) {
      return { ok: false, reason: 'missing_quote' };
    }
    throw error;
  }

  return { ok: true };
};
