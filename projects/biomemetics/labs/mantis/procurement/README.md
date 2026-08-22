# Mantis procurement constellation

Five Start routes over one file-backed PGlite book. Balloon lines B01–B52 are
design identities, not buys. This tree does not share the specimendb catalog
instance or schema. No purchase order has been issued.

## Routes

| Route | Job |
| --- | --- |
| `/register` | B01–B52 on lab-ui `Grid`. Class is a slot. SKU sockets stay blank. |
| `/buy` | SKU, vendor, quote, PO on lab-ui `Grid`. The class gate blocks issue. |
| `/receive` | Receipt and lot. Inspector sockets until something arrives. |
| `/need` | First-tower kit vs on-hand on lab-ui `Grid`. Demand qty stays text. |
| `/vendors` | Supplier parties. An empty list is correct. |

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

Manufacturer part numbers, prices, and lead times stay blank until sourced.
`manufacturer_sku`, `supplier_party`, `quote`, `purchase_order`, `receipt`, `lot`,
`cost_history`, and `lead_time` start empty. The one seeded alternate is B36's
rejected B0371, with no PN.

B42 has no class token. Particle Tachyon is a name. The 85 x 56 x 18.5 mm envelope
stays in the note. B43 keeps `M1ENCLEA` in the note until it earns a SKU row.

## Rebuild

Live cluster is gitignored at `data/pglite/`. Schema and seed SQL are committed.

```text
npm install
npm run sql:seed
npm test
npm run rebuild
npm run dev
```

`sql:seed` reads `../terrarium/BOM.md` and rewrites `sql/0002_seed.sql`. It does
not write prices, MPNs, or vendors. A fresh PGlite is `schema + seed`.

This applet is self-contained so clusterbot can host it later. It does not import
the specimendb catalog instance.
