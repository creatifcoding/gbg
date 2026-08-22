# Mantis procurement constellation

Five Start routes over one file-backed PGlite book. Balloon lines B01–B52 are
design identities, not buys. This tree does not share the specimendb catalog
instance or schema. No purchase order has been issued.

## Routes

| Route | Job |
| --- | --- |
| `/register` | B01–B52, class slot, qty as text, notes. SKU wells render empty. |
| `/buy` | SKU, vendor, quote, PO. The class gate blocks issue. No seeded PO. |
| `/receive` | Receipt and lot. Empty until something arrives. |
| `/need` | First-tower kit vs on-hand. Demand qty stays text (`set`, `1+`, `0-1`). |
| `/vendors` | Supplier parties. An empty list is correct. |

One shell owns the five tabs. Each route is an outlet table. `/` redirects to
`/register`.

## Look

Look is copied from Variant HTML (Catalog/Workbench), not from a chalkboard
sketch. Three named regions:

| Region | Source |
| --- | --- |
| Constellation tab rail | `docs/variant/e90f6c74-5f26-4990-9cb8-0f76ff18f3d8.html` thin chrome |
| Register table | `docs/variant/9263d787-0811-440f-8822-f31ee93b56a8.html` IBM Plex Mono + Inter |
| Footer gate | kickers from `docs/variant/8a21a4b1-d6cc-415e-954b-6288c6a0b0b1.html` |

Type is Inter 400/500 and IBM Plex Mono 400/500/600. Kickers are 9px at
letter-spacing 0.2em. Color is `#0a0a0a` / `#080808` / `#1a1a1a` / `#222` with
zinc hairlines. The surface does not import specimendb UI.

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

## Empty wells

Manufacturer part numbers, prices, and lead times stay empty until sourced.
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
