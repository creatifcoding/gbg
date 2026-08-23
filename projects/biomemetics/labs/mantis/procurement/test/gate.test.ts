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
  listManufacturerSkus,
  listNeed,
  listParts,
  listSkuWells,
  listSuppliers,
} from '../src/store/queries';

const CAD_NOTE_BALLOONS = new Set([
  'B01',
  'B02',
  'B03',
  'B04',
  'B05',
  'B06',
  'B07',
  'B11',
  'B18',
  'B42',
  'B43',
  'B45',
]);

const load = async () => {
  const db = await openStore({ memory: true });
  return db;
};

describe('seed from BOM.md', () => {
  it('loads B01–B52 with qty as text and empty selected SKU wells', async () => {
    const markdown = await readFile(BOM_MD, 'utf8');
    const parsed = parseBomTable(markdown);
    expect(parsed.map((row) => row.balloonId)).toEqual(expectedBalloonIds());

    const db = await load();
    const parts = await listParts(db);
    const wells = await listSkuWells(db);
    expect(parts).toHaveLength(52);
    expect(parts.map((row) => row.balloon_id)).toEqual(expectedBalloonIds());
    expect(wells).toHaveLength(52);
    expect(wells.every((row) => row.sku_id === null && row.mpn === null)).toBe(
      true,
    );
    expect(await countTable(db, 'manufacturer_sku')).toBe(5);
    expect(await countTable(db, 'supplier_party')).toBe(1);
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
      if (!CAD_NOTE_BALLOONS.has(row.balloonId)) {
        expect(part?.notes).toBe(row.notes);
      }
    }

    await db.close();
  });

  it('keeps the locked honesty rows', async () => {
    const db = await load();
    const parts = await listParts(db);
    const byId = Object.fromEntries(parts.map((row) => [row.balloon_id, row]));

    expect(byId.B01?.class).toBe('REF');
    expect(byId.B01?.qty_text).toBe('8');
    expect(byId.B01?.notes).toContain('in-house FDM/Bambu');
    expect(byId.B01?.notes).toContain('Printer model UNVERIFIED');

    expect(byId.B09?.class).toBe('REF');
    expect(byId.B09?.notes).toContain('LOCK count');
    expect(byId.B09?.notes).toContain('REF design');

    expect(byId.B36?.class).toBe('UNVERIFIED');
    expect(byId.B36?.name).toContain('IMX519');
    expect(byId.B36?.name).toContain('Particle-supported');

    expect(byId.B42?.class).toBeNull();
    expect(byId.B42?.name).toBe('Particle Tachyon');
    expect(byId.B42?.notes).toMatch(/85\s*x\s*56\s*x\s*18\.5/i);
    expect(byId.B42?.notes).toContain('none selected');
    expect(byId.B42?.notes).toContain(
      'https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/',
    );
    expect(byId.B42?.notes).toContain(
      'https://store.particle.io/products/tachyon-5g-single-board-computer',
    );

    expect(byId.B43?.class).toBeNull();
    expect(byId.B43?.notes).toContain('M1ENCLEA');
    expect(byId.B43?.notes).toContain('lifecycle GA');
    expect(byId.B43?.notes).toContain('2x M20 glands');
    expect(byId.B43?.notes).toContain(
      'https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/',
    );

    expect(byId.B04?.qty_text).toBe('set');
    expect(byId.B22?.qty_text).toBe('1+');
    expect(byId.B43?.qty_text).toBe('0-1');
    expect(byId.B23?.qty_text).toBe('2/carriage');

    expect(byId.B05?.class).toBe('REF');
    expect(byId.B06?.class).toBe('REF');
    expect(byId.B05?.notes).toContain('TAP Chemcast');
    expect(byId.B05?.notes).toContain('2.24 to 3.50 mm');
    expect(byId.B05?.notes).toContain('No selected cut-size SKU');
    expect(byId.B11?.class).toBe('LOCK');
    expect(byId.B11?.notes).toContain('1.2 mm hole');
    expect(byId.B11?.notes).toContain('<=0.80 mm');

    expect(byId.B45?.class).toBeNull();
    expect(byId.B45?.notes).toContain('MAX96717');
    expect(byId.B45?.notes).toContain('Package/tape suffix');
    expect(byId.B46?.class).toBeNull();
    expect(byId.B46?.notes).toContain('UNVERIFIED');

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

  it('lands CAD candidate SKUs without selecting one or inventing a quote', async () => {
    const db = await load();
    const skus = await listManufacturerSkus(db);
    const suppliers = await listSuppliers(db);

    expect(skus).toEqual([
      {
        id: 'TACH4NA',
        part_id: 'B42',
        manufacturer: 'Particle',
        mpn: 'TACH4NA',
        revision: null,
      },
      {
        id: 'TACH8NA',
        part_id: 'B42',
        manufacturer: 'Particle',
        mpn: 'TACH8NA',
        revision: null,
      },
      {
        id: 'TACH8ROW',
        part_id: 'B42',
        manufacturer: 'Particle',
        mpn: 'TACH8ROW',
        revision: null,
      },
      {
        id: 'M1ENCLEA',
        part_id: 'B43',
        manufacturer: 'Particle',
        mpn: 'M1ENCLEA',
        revision: null,
      },
      {
        id: 'MAX96717',
        part_id: 'B45',
        manufacturer: 'Analog Devices',
        mpn: 'MAX96717',
        revision: null,
      },
    ]);

    expect(skus.filter((row) => row.part_id === 'B46')).toEqual([]);
    expect(skus.filter((row) => row.part_id === 'B05')).toEqual([]);
    expect(skus.some((row) => row.mpn === 'TACH4ROW')).toBe(false);

    expect(suppliers).toEqual([{ id: 'particle', name: 'Particle' }]);

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

  it('still refuses B42/B43/B45/B46 when a candidate SKU id is attached', async () => {
    const db = await load();

    const withSku = [
      { partId: 'B42', skuId: 'TACH4NA' },
      { partId: 'B43', skuId: 'M1ENCLEA' },
      { partId: 'B45', skuId: 'MAX96717' },
      { partId: 'B46', skuId: null },
    ] as const;

    for (const row of withSku) {
      const result = await issuePurchaseOrder(db, {
        poId: `po-${row.partId}`,
        lineId: `po-${row.partId}-1`,
        partId: row.partId,
        qty: 1,
        skuId: row.skuId,
        vendorId: 'particle',
        quoteId: null,
      });
      expect(result).toEqual({ ok: false, reason: 'class_null' });
    }

    expect(await countTable(db, 'quote')).toBe(0);
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
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
         VALUES ('forced-b42-1', 'forced-b42', 'B42', 'TACH4NA', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    await db.query(
      `INSERT INTO purchase_order (po_id, supplier_party_id, status)
       VALUES ('forced-b43', 'particle', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
         VALUES ('forced-b43-1', 'forced-b43', 'B43', 'M1ENCLEA', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    await db.query(
      `INSERT INTO purchase_order (po_id, status) VALUES ('forced-b45', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
         VALUES ('forced-b45-1', 'forced-b45', 'B45', 'MAX96717', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    await db.query(
      `INSERT INTO purchase_order (po_id, status) VALUES ('forced-b46', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, qty)
         VALUES ('forced-b46-1', 'forced-b46', 'B46', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    expect(await countTable(db, 'purchase_order_line')).toBe(0);
    await db.close();
  });
});
