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
  listQuotes,
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
  'B08',
  'B09',
  'B10',
  'B11',
  'B12',
  'B13',
  'B14',
  'B15',
  'B16',
  'B17',
  'B18',
  'B19',
  'B25',
  'B26',
  'B27',
  'B29',
  'B30',
  'B31',
  'B32',
  'B33',
  'B34',
  'B35',
  'B36',
  'B37',
  'B38',
  'B39',
  'B40',
  'B41',
  'B42',
  'B43',
  'B44',
  'B45',
  'B46',
  'B47',
  'B48',
  'B49',
  'B50',
  'B51',
  'B52',
]);

const FORBIDDEN_MPNS = [
  'TACH4ROW',
  '0685T1000-01',
  '0685T2500-01',
  '0685T3000-01',
  '812-22-012-30-000101',
  '9218T23',
  '11195A11',
  '7381K31',
  '4685',
  'TPS25221',
  'M80-5101242',
  '39512000440',
  '91292A113',
  '11565A11',
  '154002.0',
];

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
    expect(await countTable(db, 'manufacturer_sku')).toBe(50);
    expect(await countTable(db, 'supplier_party')).toBe(3);
    expect(await countTable(db, 'quote')).toBe(4);
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
    expect(byId.B36?.notes).toContain('S5K3P9SX');
    expect(byId.B36?.notes).toContain('22-pin 0.5 mm');

    expect(byId.B42?.class).toBeNull();
    expect(byId.B42?.name).toBe('Particle Tachyon');
    expect(byId.B42?.notes).toMatch(/85\s*x\s*56\s*x\s*18\.5/i);
    expect(byId.B42?.notes).toContain('none selected');
    expect(byId.B42?.notes).toContain('Do not promote TACH4ROW');
    expect(byId.B42?.notes).toContain(
      'https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/',
    );

    expect(byId.B43?.class).toBeNull();
    expect(byId.B43?.notes).toContain('M1ENCLEA');
    expect(byId.B43?.notes).toContain('lifecycle GA');
    expect(byId.B43?.notes).toContain('2x M20 glands');

    expect(byId.B04?.qty_text).toBe('set');
    expect(byId.B22?.qty_text).toBe('1+');
    expect(byId.B43?.qty_text).toBe('0-1');
    expect(byId.B23?.qty_text).toBe('2/carriage');

    expect(byId.B05?.class).toBe('REF');
    expect(byId.B06?.class).toBe('REF');
    expect(byId.B05?.notes).toContain('TAP Chemcast');
    expect(byId.B05?.notes).toContain('2.24 to 3.50 mm');
    expect(byId.B05?.notes).toContain('ACRYCLR0.118CCM48X96');
    expect(byId.B05?.notes).toContain('Paper Masked Sheet');
    expect(byId.B05?.notes).toContain(
      'TAP Chemcast family and Sheet Haus stay as other family/sheet candidates',
    );
    expect(byId.B08?.class).toBe('REF');
    expect(byId.B11?.class).toBe('LOCK');
    expect(byId.B11?.notes).toContain('1.2 mm hole');
    expect(byId.B11?.notes).toContain('<=0.80 mm');
    expect(byId.B20?.class).toBe('REF');

    expect(byId.B45?.class).toBeNull();
    expect(byId.B45?.notes).toContain('MAX96717GTJ/VY+');
    expect(byId.B46?.class).toBeNull();
    expect(byId.B46?.notes).toContain('Future product');
    expect(byId.B46?.notes).toContain('6 Gbps MAX96724 rows marked future-product');
    expect(byId.B46?.notes).toContain('analog.com HTML timed out');
    expect(byId.B46?.notes).toContain('not a suffix pick');
    expect(byId.B46?.notes).toContain('https://www.farnell.com/datasheets/4416323.pdf');
    expect(byId.B37?.notes).toContain('CAD miss: no invented FPC PN');
    expect(byId.B46?.notes).toContain('LCSC prints stock');
    expect(byId.B44?.class).toBeNull();
    expect(byId.B44?.notes).toContain('rejected as a selection');
    expect(byId.B44?.notes).toContain('CAD miss this pass on the custom rail tap');
    expect(byId.B44?.notes).toContain('Do not claim CAD printed 0154002.DR');
    expect(byId.B44?.notes).toContain('$1.411 snapshot is NOT a quote');
    expect(byId.B27?.notes).toContain('do not treat this as accepted against a wet/animal balloon');
    expect(byId.B48?.notes).toContain('Not a 12 V interrupt');
    expect(byId.B48?.notes).toContain('CAD miss this pass on supervisor');
    expect(byId.B50?.notes).toContain('Pinout not invented');
    expect(byId.B50?.notes).toContain('CAD miss this pass on the keyed 12-net');
    expect(byId.B08?.notes).toContain('CAD miss this pass until a non-JS hinge page is opened');
    expect(byId.B25?.notes).toContain('CAD miss this pass');
    expect(byId.B25?.notes).toContain('EE candidate remains: Lee Spring LC032C08M');
    expect(byId.B38?.notes).toContain('SPIROL 151284');
    expect(byId.B38?.notes).toContain('Adafruit 4256');
    expect(byId.B38?.notes).toContain('EE candidates remain');
    expect(byId.B41?.notes).toContain('CD20MA-BK');
    expect(byId.B41?.notes).toContain('1.209.2001.50');
    expect(byId.B41?.notes).toContain('not selected over the kit');
    expect(byId.B11?.notes).toContain('UNVERIFIED stop');
    expect(byId.B09?.notes).toContain('CAD miss');
    expect(byId.B16?.notes).toContain('PT2683');
    expect(byId.B37?.notes).toContain('Adafruit 6034');
    expect(byId.B47?.notes).toContain('C28S-11.00-SPS8-SPS8');
    expect(byId.B49?.class).toBeNull();
    expect(byId.B49?.notes).toContain('A2A1A0 strap');
    expect(byId.B49?.notes).toContain('8-Nov-2025');

    const alternates = await listAlternates(db);
    expect(alternates.map((row) => row.id).sort()).toEqual([
      'alt-B19-319-10-112',
      'alt-B36-B0371',
      'alt-B37-pi-22-15',
      'alt-B44-fuse-dump',
      'alt-B48-supervisor',
      'alt-B50-molex-1053081212',
    ]);
    const b0371 = alternates.find((row) => row.id === 'alt-B36-B0371');
    expect(b0371?.status).toBe('rejected');
    expect(b0371?.mpn).toBeNull();

    const need = await listNeed(db);
    const setLine = need.find((row) => row.balloon_id === 'B04');
    expect(setLine?.qty_text).toBe('set');
    expect(setLine?.on_hand).toBeNull();

    expect(DEFAULT_DATA_DIR.startsWith(PROCUREMENT_ROOT)).toBe(true);
    expect(PROCUREMENT_ROOT.endsWith('procurement')).toBe(true);

    await db.close();
  });

  it('lands CAD/EE candidate SKUs without selecting one or issuing a PO', async () => {
    const db = await load();
    const skus = await listManufacturerSkus(db);
    const suppliers = await listSuppliers(db);
    const quotes = await listQuotes(db);

    const byPart = (id: string) =>
      skus.filter((row) => row.part_id === id).map((row) => row.mpn);

    expect(byPart('B42')).toEqual(['TACH4NA', 'TACH8NA', 'TACH8ROW']);
    expect(byPart('B43')).toEqual(['M1ENCLEA']);
    expect(byPart('B45')).toEqual(['MAX96717GTJ/VY+', 'MAX96717GTJ/VY+T']);
    expect(byPart('B46')).toEqual([
      'MAX96724FGTN/V+',
      'MAX96724FGTN/VY+',
      'MAX96724GTN/VY+',
      'MAX96724GTN/VY+T',
      'MAX96724RGTN/V+',
    ]);
    expect(byPart('B49')).toEqual([
      'TCA9548ADGSR',
      'TCA9548AMRGER',
      'TCA9548APWR',
      'TCA9548ARGER',
    ]);
    expect(byPart('B37')).toEqual(['0150200231', '6034', '6035', '6036']);
    expect(byPart('B47')).toEqual(['C28S-11.00-SPS8-SPS8']);
    expect(byPart('B50')).toEqual(['39-01-2120']);
    expect(byPart('B19')).toEqual(['319-10-108-00-001000']);
    expect(byPart('B27')).toEqual(['816-22-012-10-000101']);
    expect(byPart('B44')).toEqual(['0154002.DR']);
    expect(byPart('B48')).toEqual(['D2FS-F-N', 'TPS259830LNRGER']);
    expect(byPart('B25')).toEqual(['LC032C08M']);
    expect(byPart('B05')).toEqual(['A000AN03.0L0GPCTE', 'ACRYCLR0.118CCM48X96']);
    expect(byPart('B06')).toEqual(['A000AN03.0L0GPCTE', 'ACRYCLR0.118CCM48X96']);
    expect(byPart('B08')).toEqual(['1588A714', '1588A724', '1588A733']);
    expect(byPart('B41')).toEqual(['53111420', 'CD20MA-BK']);
    expect(byPart('B38')).toEqual([
      '151284',
      '4255',
      '4256',
      '94180A331',
      '94180A333',
      '94459A130',
      '94459A140',
      '94459A769',
    ]);

    const mpns = new Set(skus.map((row) => row.mpn));
    for (const forbidden of FORBIDDEN_MPNS) {
      expect(mpns.has(forbidden)).toBe(false);
    }
    expect(mpns.has('MAX96717')).toBe(false);
    expect(mpns.has('TCA9548A')).toBe(false);
    expect(mpns.has('1053081212')).toBe(false);
    expect(mpns.has('319-10-112-00-001000')).toBe(false);
    expect(mpns.has('PT2683')).toBe(false);
    expect(mpns.has('B0371')).toBe(false);
    expect(mpns.has('1.209.2001.50')).toBe(false);

    expect(suppliers).toEqual([
      { id: 'lcsc', name: 'LCSC' },
      { id: 'particle', name: 'Particle' },
      { id: 'ti', name: 'Texas Instruments' },
    ]);
    expect(quotes.map((row) => row.quote_id).sort()).toEqual([
      'quote-lcsc-b45',
      'quote-lcsc-b46',
      'quote-particle-b42',
      'quote-particle-b43',
    ]);
    expect(JSON.stringify(quotes)).not.toContain('1.411');
    expect(JSON.stringify(quotes)).not.toContain('39512000440');
    const quoteAttrs = await db.query<{ attrs: unknown }>(
      'SELECT attrs FROM quote',
    );
    expect(JSON.stringify(quoteAttrs.rows)).not.toContain('1.411');
    expect(JSON.stringify(quoteAttrs.rows)).not.toContain('39512000440');

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

  it('still refuses B42/B43/B45/B46 when a candidate SKU and discovery quote are attached', async () => {
    const db = await load();

    const withSku = [
      { partId: 'B42', skuId: 'TACH4NA', quoteId: 'quote-particle-b42' },
      { partId: 'B43', skuId: 'M1ENCLEA', quoteId: 'quote-particle-b43' },
      { partId: 'B45', skuId: 'MAX96717GTJ/VY+T', quoteId: 'quote-lcsc-b45' },
      { partId: 'B46', skuId: 'MAX96724GTN/VY+T', quoteId: 'quote-lcsc-b46' },
    ] as const;

    for (const row of withSku) {
      const result = await issuePurchaseOrder(db, {
        poId: `po-${row.partId}`,
        lineId: `po-${row.partId}-1`,
        partId: row.partId,
        qty: 1,
        skuId: row.skuId,
        vendorId: 'particle',
        quoteId: row.quoteId,
      });
      expect(result).toEqual({ ok: false, reason: 'class_null' });
    }

    const b05 = await issuePurchaseOrder(db, {
      poId: 'po-b05',
      lineId: 'po-b05-1',
      partId: 'B05',
      qty: 1,
      skuId: 'B05:ACRYCLR0.118CCM48X96',
      vendorId: 'particle',
      quoteId: 'quote-particle-b42',
    });
    expect(b05).toEqual({ ok: false, reason: 'class_not_orderable' });

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
      `INSERT INTO purchase_order (po_id, supplier_party_id, quote_id, status)
       VALUES ('forced-b43', 'particle', 'quote-particle-b43', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
         VALUES ('forced-b43-1', 'forced-b43', 'B43', 'M1ENCLEA', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    await db.query(
      `INSERT INTO purchase_order (po_id, supplier_party_id, quote_id, status)
       VALUES ('forced-b45', 'lcsc', 'quote-lcsc-b45', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
         VALUES ('forced-b45-1', 'forced-b45', 'B45', 'MAX96717GTJ/VY+T', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    await db.query(
      `INSERT INTO purchase_order (po_id, supplier_party_id, quote_id, status)
       VALUES ('forced-b46', 'lcsc', 'quote-lcsc-b46', 'draft')`,
    );
    await expect(
      db.query(
        `INSERT INTO purchase_order_line (line_id, po_id, part_id, sku_id, qty)
         VALUES ('forced-b46-1', 'forced-b46', 'B46', 'MAX96724GTN/VY+T', 1)`,
      ),
    ).rejects.toThrow(/class_null/);

    expect(await countTable(db, 'purchase_order_line')).toBe(0);
    await db.close();
  });
});
