import { readFile, writeFile } from 'node:fs/promises';
import { BOM_MD, SEED_SQL } from './paths';
import { expectedBalloonIds, parseBomTable } from './parse-bom';

const dollar = (value: string): string => {
  let tag = 'bom';
  while (value.includes(`$${tag}$`)) {
    tag = `${tag}x`;
  }
  return `$${tag}$${value}$${tag}$`;
};

const sqlNull = (value: string | null): string =>
  value === null ? 'NULL' : dollar(value);

const generate = async (): Promise<string> => {
  const markdown = await readFile(BOM_MD, 'utf8');
  const balloons = parseBomTable(markdown);
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

  return `-- Generated from terrarium/BOM.md. Do not invent SKUs, vendors, prices, or lead times.
-- Empty manufacturer_sku / supplier_party / quote / purchase_order is correct.
-- B0371 is a rejected alternate with no PN.

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
