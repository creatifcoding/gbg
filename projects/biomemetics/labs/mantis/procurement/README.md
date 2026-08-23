# Mantis procurement constellation

Five Start routes over one file-backed PGlite book. Balloon lines B01–B52 are
design identities, not buys. This tree does not share the specimendb catalog
instance or schema. No purchase order has been issued.

## Routes

| Route | Job |
| --- | --- |
| `/register` | B01–B52 on lab-ui `Grid`. Class is a slot. SKU sockets stay blank. Candidate MPNs are listed separately, none selected. |
| `/buy` | SKU, vendor, quote, PO on lab-ui `Grid`. The class gate blocks issue. |
| `/receive` | Receipt and lot. Inspector sockets until something arrives. |
| `/need` | First-tower kit vs on-hand on lab-ui `Grid`. Demand qty stays text. |
| `/vendors` | Supplier parties. Particle, LCSC, and TI are discovery rows, not a buy. |

One shell owns the five tabs. Tabular chrome is `@gbg/lab-ui` `Grid` (AG-Grid)
or `Table` (TanStack, small inspectors). `/` redirects to `/register`.

## Look

Paint is `@gbg/lab-ui` `VANTA_*` / `chrome`. Faces are Share Tech Mono, Space
Grotesk, and Geo. `Socket` / `SocketCell` draw the box; the value stays blank
until a real MPN exists. Do not import datagrid `COLORS`.

## Wire

I/O for this book is local PGlite through Start server fns. The applet depends
on `@tmnl/pct`, `@tmnl/msh`, and `@tmnl/lnk`. There is no published Pact
procedure for mantis procurement. Do not add fetch or a second bus. New remote
I/O waits on a real pct contract.

## Class gate

A purchase order line is refused when any of these is true:

- `class` is `UNVERIFIED` or `DRAFT`
- `class` is NULL
- `class` is `REF` or `LOCK` (design confidence, not a buy)
- no manufacturer SKU
- no supplier party
- no quote

`orderable` is its own class and still needs SKU + vendor + quote.

Shop pack `terrarium/shop/` is DRAFT. Do not order from it. Camera SKU is unset.

## Blank sockets

Register SKU sockets stay blank. Candidate MPNs in `manufacturer_sku` are not a
selected SKU. `purchase_order`, `receipt`, `lot`, `cost_history`, and
`lead_time` stay empty. Discovery `quote` rows are printed store/LCSC pages
marked UNVERIFIED in `attrs`. They are not a buy.

`manufacturer_sku` has no source_url, description, or lifecycle columns.
`supplier_party` has no URL column. Source URLs, GA, kit copy, and printed
prices live in `part.notes` and `quote.attrs`.

Particle, LCSC, and Texas Instruments are discovery `supplier_party` rows, not
a buy. Analog Devices is a manufacturer name on SerDes rows. There is no Analog
Devices vendor row.

B42 has no class token. Three Tachyon ordering-table SKUs are candidates. None
is selected. TACH4ROW is not landed. Exact revision CAD still required. The
85 x 56 x 18.5 mm envelope stays in the note.

B43 class stays NULL. M1ENCLEA is a manufacturer_sku row with lifecycle GA in
the note. Not an order.

B45/B46 are candidate IC families. Package suffix is not a selected buy.
Carrier / Tachyon integration stay UNVERIFIED. Datasheet future-product vs LCSC
stock both stay in the B46 note.

B05 and B06 stay REF. TAP Chemcast is a family hit with no TAP SKU. Sheet SKUs
are candidates, not finished cassette/door parts.

## Rebuild

Live cluster is gitignored at `data/pglite/`. Schema and seed SQL are committed.

```text
npm install
npm run sql:seed
npm test
npm run rebuild
npm run dev
```

`sql:seed` reads `../terrarium/BOM.md`, applies CAD search-hit notes, and
rewrites `sql/0002_seed.sql`. It does not write prices, lead times, quotes, or
POs. A fresh PGlite is `schema + seed`.

This applet is self-contained so clusterbot can host it later. It does not import
the specimendb catalog instance.
