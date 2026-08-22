import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { BOM_MD, DEFAULT_DATA_DIR, PROCUREMENT_ROOT } from '../src/store/paths';
import { expectedBalloonIds, parseBomTable } from '../src/store/parse-bom';
import { canIssuePurchaseOrder } from '../src/store/gate';
import { openStore } from '../src/store/open';
import {
  countTable,
  issuePurchaseOrder,
  listAlternates,
  listNeed,
  listParts,
  listSkuWells,
} from '../src/store/queries';

const load = async () => {
  const db = await openStore({ memory: true });
  return db;
};

describe('seed from BOM.md', () => {
  it('loads B01–B52 with qty as text and empty SKU wells', async () => {
    const markdown = await readFile(BOM_MD, 'utf8');
    const parsed = parseBomTable(markdown);
    expect(parsed.map((row) => row.balloonId)).toEqual(expectedBalloonIds());

    const db = await load();
    const parts = await listParts(db);
    const skus = await listSkuWells(db);
    expect(parts).toHaveLength(52);
    expect(parts.map((row) => row.balloon_id)).toEqual(expectedBalloonIds());
    expect(skus.every((row) => row.sku_id === null && row.mpn === null)).toBe(
      true,
    );
    expect(await countTable(db, 'manufacturer_sku')).toBe(0);
    expect(await countTable(db, 'supplier_party')).toBe(0);
    expect(await countTable(db, 'quote')).toBe(0);
    expect(await countTable(db, 'purchase_order')).toBe(0);
    expect(await countTable(db, 'purchase_order_line')).toBe(0);
    expect(await countTable(db, 'receipt')).toBe(0);
    expect(await countTable(db, 'lot')).toBe(0);
    expect(await countTable(db, 'cost_history')).toBe(0);
    expect(await countTable(db, 'lead_time')).toBe(0);
    expect(await countTable(db, 'contract')).toBe(0);
    expect(await countTable(db, 'sourcing_event')).toBe(0);
    expect(await countTable(db, 'supplier_capacity')).toBe(0);
    expect(await countTable(db, 'allocation_notice')).toBe(0);
    expect(await countTable(db, 'expedite')).toBe(0);

    for (const row of parsed) {
      const part = parts.find((item) => item.balloon_id === row.balloonId);
      expect(part?.name).toBe(row.name);
      expect(part?.qty_text).toBe(row.qtyText);
      expect(part?.class).toBe(row.class);
      expect(part?.notes).toBe(row.notes);
    }

    await db.close();
  });

  it('keeps the locked honesty rows', async () => {
    const db = await load();
    const parts = await listParts(db);
    const byId = Object.fromEntries(parts.map((row) => [row.balloon_id, row]));

    expect(byId.B01?.class).toBe('REF');
    expect(byId.B01?.qty_text).toBe('8');

    expect(byId.B09?.class).toBe('REF');
    expect(byId.B09?.notes).toContain('LOCK count');
    expect(byId.B09?.notes).toContain('REF design');

    expect(byId.B36?.class).toBe('UNVERIFIED');
    expect(byId.B36?.name).toContain('IMX519');
    expect(byId.B36?.name).toContain('Particle-supported');

    expect(byId.B42?.class).toBeNull();
    expect(byId.B42?.name).toBe('Particle Tachyon');
    expect(byId.B42?.notes).toMatch(/85\s*x\s*56\s*x\s*18\.5/i);

    expect(byId.B43?.class).toBeNull();
    expect(byId.B43?.notes).toContain('M1ENCLEA');

    expect(byId.B04?.qty_text).toBe('set');
    expect(byId.B22?.qty_text).toBe('1+');
    expect(byId.B43?.qty_text).toBe('0-1');
    expect(byId.B23?.qty_text).toBe('2/carriage');

    const alternates = await listAlternates(db);
    expect(alternates).toHaveLength(1);
    expect(alternates[0]?.name).toBe('B0371');
    expect(alternates[0]?.part_id).toBe('B36');
    expect(alternates[0]?.status).toBe('rejected');
    expect(alternates[0]?.mpn).toBeNull();
    expect(alternates[0]?.manufacturer).toBeNull();

    const need = await listNeed(db);
    const setLine = need.find((row) => row.balloon_id === 'B04');
    expect(setLine?.qty_text).toBe('set');
    expect(setLine?.on_hand).toBeNull();

    expect(DEFAULT_DATA_DIR.startsWith(PROCUREMENT_ROOT)).toBe(true);
    expect(PROCUREMENT_ROOT.endsWith('procurement')).toBe(true);

    await db.close();
  });
});

describe('purchase order class gate', () => {
  it('refuses B36 UNVERIFIED and B42 NULL class before a PO line exists', async () => {
    expect(
      canIssuePurchaseOrder({
        class: 'UNVERIFIED',
        skuId: null,
        vendorId: null,
        quoteId: null,
      }),
    ).toEqual({ ok: false, reason: 'class_unverified' });

    expect(
      canIssuePurchaseOrder({
        class: null,
        skuId: null,
        vendorId: null,
        quoteId: null,
      }),
    ).toEqual({ ok: false, reason: 'class_null' });

    const db = await load();

    const b36 = await issuePurchaseOrder(db, {
      poId: 'po-b36',
      lineId: 'po-b36-1',
      partId: 'B36',
      qty: 1,
      skuId: null,
      vendorId: null,
      quoteId: null,
    });
    expect(b36).toEqual({ ok: false, reason: 'class_unverified' });

    const b42 = await issuePurchaseOrder(db, {
      poId: 'po-b42',
      lineId: 'po-b42-1',
      partId: 'B42',
      qty: 1,
      skuId: null,
      vendorId: null,
      quoteId: null,
    });
    expect(b42).toEqual({ ok: false, reason: 'class_null' });

    expect(await countTable(db, 'purchase_order')).toBe(0);
    expect(await countTable(db, 'purchase_order_line')).toBe(0);

    await db.close();
  });

  it('SQL trigger still refuses B36 and B42 if a header is forced in', async () => {
    const db = await load();

    await db.query(
      `INSERT INTO purchase_order (po_id, status) VALUES ('forced-b36', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, qty)
         VALUES ('forced-b36-1', 'forced-b36', 'B36', 1)`,
      ),
    ).rejects.toThrow(/class_unverified/);

    await db.query(
      `INSERT INTO purchase_order (po_id, status) VALUES ('forced-b42', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, qty)
         VALUES ('forced-b42-1', 'forced-b42', 'B42', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    expect(await countTable(db, 'purchase_order_line')).toBe(0);
    await db.close();
  });
});
