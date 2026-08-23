import { readFile, writeFile } from 'node:fs/promises';
import { BOM_MD, SEED_SQL } from './paths';
import { expectedBalloonIds, parseBomTable, type BalloonDraft } from './parse-bom';

const TACHYON_DATASHEET =
  'https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/';
const TACHYON_STORE =
  'https://store.particle.io/products/tachyon-5g-single-board-computer';
const M1_DATASHEET =
  'https://docs.particle.io/reference/datasheets/m-series/m1-enclosure-datasheet/';
const M1_STORE = 'https://store.particle.io/products/m1-enclosure';
const MAX96717_PAGE = 'https://www.analog.com/en/products/max96717.html';
const TAP_CAST_ACRYLIC =
  'https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_cast_clear/510';

const dollar = (value: string): string => {
  let tag = 'bom';
  while (value.includes(`$${tag}$`)) {
    tag = `${tag}x`;
  }
  return `$${tag}$${value}$${tag}$`;
};

const sqlNull = (value: string | null): string =>
  value === null ? 'NULL' : dollar(value);

const FDM_MISS =
  'CAD miss: in-house FDM/Bambu. Printer model UNVERIFIED. No catalog MPN.';

const CAD_NOTES: Record<string, string> = {
  B01: FDM_MISS,
  B02: FDM_MISS,
  B03: FDM_MISS,
  B04: FDM_MISS,
  B05: [
    'Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast).',
    'PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm.',
    'No selected cut-size SKU. Not a buy.',
    `Source: ${TAP_CAST_ACRYLIC}`,
  ].join(' '),
  B06: [
    'Item family 3.0 mm / 0.118 in cast acrylic (TAP Chemcast).',
    'PARAMS LOCK is 3.00 mm; TAP listed thickness tolerance is 2.24 to 3.50 mm.',
    'No selected cut-size SKU. Not a buy.',
    `Source: ${TAP_CAST_ACRYLIC}`,
  ].join(' '),
  B07: FDM_MISS,
  B11: [
    'constraint.',
    'CAD miss: common 18x16 insect mesh is cited around 1.2 mm hole (PVC-coated fiberglass listing); that misses LOCK <=0.80 mm nonmetal aperture.',
    'No selected PN.',
  ].join(' '),
  B18: FDM_MISS,
  B42: [
    'Vendor-documented 85 x 56 x 18.5 mm; exact revision CAD still required.',
    'Candidate manufacturer SKUs from the datasheet ordering table, none selected: TACH4NA Tachyon 4GB RAM / 64GB Flash (NorAm); TACH8NA Tachyon 8GB RAM / 128GB Flash (NorAm); TACH8ROW Tachyon 8GB RAM / 128GB Flash (EMEA).',
    `Sources: ${TACHYON_DATASHEET} ${TACHYON_STORE}`,
  ].join(' '),
  B43: [
    'M1ENCLEA; lifecycle GA as printed in the ordering table; vendor-documented 121 x 220 x 69 mm.',
    'Kit includes 2x M20 glands + 2x M20 plugs (B41 adjacent, not a selected standalone gland PN).',
    `Sources: ${M1_DATASHEET} ${M1_STORE}`,
  ].join(' '),
  B45: [
    'device verified; carrier design UNVERIFIED.',
    'Analog Devices MAX96717 (CSI-2 to GMSL2 serializer). Package/tape suffix and carrier UNVERIFIED; no orderable suffix PN.',
    `Source: ${MAX96717_PAGE}`,
  ].join(' '),
};

const applyCadSearchHits = (balloons: BalloonDraft[]): void => {
  for (const balloon of balloons) {
    const notes = CAD_NOTES[balloon.balloonId];
    if (notes !== undefined) {
      balloon.notes = notes;
    }
  }
};

const generate = async (): Promise<string> => {
  const markdown = await readFile(BOM_MD, 'utf8');
  const balloons = parseBomTable(markdown);
  applyCadSearchHits(balloons);
  const expected = expectedBalloonIds();
  if (balloons.length !== 52) {
    throw new Error(`expected 52 balloons, parsed ${balloons.length}`);
  }
  for (const id of expected) {
    if (!balloons.some((row) => row.balloonId === id)) {
      throw new Error(`missing ${id}`);
    }
  }

  const inserts = balloons.map(
    (row) =>
      `INSERT INTO part (balloon_id, name, qty_text, class, notes) VALUES (${dollar(row.balloonId)}, ${dollar(row.name)}, ${dollar(row.qtyText)}, ${sqlNull(row.class)}, ${dollar(row.notes)}) ON CONFLICT (balloon_id) DO NOTHING;`,
  );

  return `-- Generated from terrarium/BOM.md plus CAD search hits.
-- Do not invent prices, lead times, quotes, or purchase orders.
-- manufacturer_sku has no source_url, description, or lifecycle columns.
-- supplier_party has no URL column. Source URLs live in part.notes.
-- B42 class stays NULL. Three Tachyon SKUs are candidates, none selected.
-- B43 class stays NULL. M1ENCLEA is a SKU row, not an order.
-- B45 MAX96717 is device discovery. Package suffix UNVERIFIED.
-- B46 has no SKU. CAD did not open the product page.
-- B05/B06 are a TAP Chemcast family hit with no selected SKU.
-- Particle supplier_party is discovery, not a buy.

${inserts.join('\n')}

INSERT INTO alternate (id, part_id, name, status, manufacturer, mpn, notes)
VALUES (
  ${dollar('alt-B36-B0371')},
  ${dollar('B36')},
  ${dollar('B0371')},
  ${dollar('rejected')},
  NULL,
  NULL,
  ${dollar('Historical Release A only; not a release selection. No manufacturer part number.')}
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO supplier_party (id, name) VALUES (
  ${dollar('particle')},
  ${dollar('Particle')}
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO manufacturer_sku (id, part_id, manufacturer, mpn, revision) VALUES
  (${dollar('TACH4NA')}, ${dollar('B42')}, ${dollar('Particle')}, ${dollar('TACH4NA')}, NULL),
  (${dollar('TACH8NA')}, ${dollar('B42')}, ${dollar('Particle')}, ${dollar('TACH8NA')}, NULL),
  (${dollar('TACH8ROW')}, ${dollar('B42')}, ${dollar('Particle')}, ${dollar('TACH8ROW')}, NULL),
  (${dollar('M1ENCLEA')}, ${dollar('B43')}, ${dollar('Particle')}, ${dollar('M1ENCLEA')}, NULL),
  (${dollar('MAX96717')}, ${dollar('B45')}, ${dollar('Analog Devices')}, ${dollar('MAX96717')}, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO where_used (parent_id, child_id, relation) VALUES
  (${dollar('B35')}, ${dollar('B42')}, ${dollar('mounts')}),
  (${dollar('B29')}, ${dollar('B36')}, ${dollar('sits-on')})
ON CONFLICT (parent_id, child_id, relation) DO NOTHING;

INSERT INTO kit (kit_id, name, notes) VALUES (
  ${dollar('first-tower')},
  ${dollar('First tower')},
  ${dollar('Quantities are first-tower estimates copied from the balloon register. Qty stays text. Shop pack is DRAFT; do not order from it.')}
)
ON CONFLICT (kit_id) DO NOTHING;

INSERT INTO kit_line (kit_id, part_id, qty_text)
SELECT 'first-tower', balloon_id, qty_text
FROM part
ON CONFLICT (kit_id, part_id) DO NOTHING;
`;
};

const sql = await generate();
await writeFile(SEED_SQL, sql);
