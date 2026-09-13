# RFC — `@tmnl/addr` resource algebra

**Status:** Ratified (Prime, 2026-08-15) · **decisions closed** · **lift gated** — RFC + Pass 0 + reconvene before any package cut  
**Date:** 2026-08-15  
**Author:** Val (addr-cluster thread: URI research → overturned “park under shell” brief → instance-as-domain law → format/identity/capability close)  
**Companions:** [`tla-package-suites-rfc.md`](tla-package-suites-rfc.md) (Kind A/B + Layer doctrine only — **not** naming/barrels) · [`effect-v4-layer-doctrine.md`](effect-v4-layer-doctrine.md) · [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) (cluster register) · [`../../../pct/RFC-IDENTITY.md`](../../../pct/RFC-IDENTITY.md) (`pct:` `nodeId` may *be* an instance; it does not own locator grammar)

> Addr is a **resource capability layer**. It is not “parse a URL.” Wire form is a URI. Interior form is a tagged Addr plus an optic into the resource. Handlers never re-split strings.

---

## §0 — Problem

TMNL already speaks locators, badly.

`BufferMeta.uri` is `Schema.String` with folklore in a comment (`file:///…`, `ydoc://doc-id`, `pty://session-id`, `widget://…`). PCT has `pct:<fingerprint>`. Harness sessions key on `nodeId`. Colon-prefix soup (`task:`, `faceplate:`, `buf-…`) is branded identity pretending it is not addressing. Cursor IDE chrome (`cursor-plan://`) leaked into the research thread and must stay out of this cluster.

Three failures compound:

1. **Impl leaked into identity.** `ydoc://` names a CRDT library. A document is a document. Y.Doc / file / canvas are backends.
2. **No resource handle.** A string you can `new URL` is not open / subscribe / release. There is no lease, no capability, no optic into a particular.
3. **No domain.** A running TMNL instance is an authority. Crossing instances, that authority *is* the domain — not a query param bolted on later, and not `@tmnl/domain` (`dmn`), which stays business verticals (iot/geo/…).

The earlier brief (“tiny L0 leaf `adr` on shell, URI-only-at-boundaries, don’t mint a cluster”) is **overturned** on placement and ambition. URI-at-boundaries remains true for **opaque IDs**. Once a thing is a resource — open, focus, modify, release — it lives in `@tmnl/addr`.

---

## §1 — Law (do not relitigate)

1. **Cluster** `@tmnl/addr`. **TLA** `addr` (4-letter keystone, same class as `shll` / `mrph`). `export * as Addr`. Substrate. Consumed by nearly everything. **Not** a shell leaf. **Not** `pct`. **Not** `@tmnl/domain`.
2. **YDoc is impl.** Identity scheme is `doc://`, not `ydoc://`. CRDT / file / canvas are backends behind `doc://`.
3. **First identity schemes:** `doc://`, `pnl://`, `wnd://`. `pty://` / `widget://` become doc kinds or later schemes — not first-class identity in this RFC.
4. **Every TMNL instance is a domain unto itself.** Local locators are relative to *this* instance. Crossing instances, the instance IS the domain (`addr://<instance>/…`). `pct:` `nodeId` may BE `<instance>` when federated; it does not own locator grammar. `file://` stays the one foreign interop scheme (editor / Tauri).
5. **In-TMNL format is product law.** Locator grammar and canonical encode are decided here for every surface that stays inside the product (webview, IPC, clipboard MIME, MCP tools, in-product logs). Do not defer format as if OS or foreign consumers own it. True OS deep-link *spelling* may wrap later; it does not block or redefine the in-app form.
6. **OS deep links (future)** encode the same Addr. One desktop scheme. Thin wrap over the canonical ADT. Never `tmnl://run?cmd=`. Never OS-register `doc://` / `pnl://` / `wnd://` as separate OS protocols. Desktop scheme name is not this RFC’s blocker.
7. **Resource algebra, not URL parsing.** Schema = shape. `Schema.annotations` (via `Addr.resource` / field helpers) bless fields (locator, focus, capability, lifetime). Optic = get/set/modify particulars (`packages/stx/src/internal/auto-lens.ts` is the in-memory half). Scope = handle lease (open, subscribe, release). `#fragment` / optic path addresses particulars. Scheme = resource class; optic = slot.
8. **Document identity is `DocId`.** `doc://<id>` names a `DocId`. Buffer rewrite shapes around that. `buf-…` / `BufferId` is not sacred dual identity for documents — at most a secondary ephemeral view-state id. Opaque brands that are *not* resources (`task:`, `faceplate:`) stay branded until they need a handle.
9. **Do not use `Schema.URL` as the semantic validator** for custom schemes (WHATWG traps). `TemplateLiteralParser` / `transformOrFail` per scheme into a tagged ADT. Semantic round-trip, not byte-identical href. Fail closed. Parse ≠ authorize.
10. **`cursor-plan://` is Cursor IDE chrome.** Addr does not learn it.

---

## §2 — Cluster placement

| | |
|---|---|
| **npm** | `@tmnl/addr` |
| **dir** | `packages/addr` |
| **TLA** | `addr` |
| **export** | `export * as Addr from './addr.js'` (Layout A; path TLA lowercase, export Pascal) |
| **tags** | `@tmnl/addr/addr/<seam>/<Name>` |
| **Nx** | one project for the cluster |
| **Kind** | **mixed.** Tagged ADT + Schema + optics are values (Kind B-adjacent — do not fake a service graph for parse/format). Scope / handlers (`open`, `subscribe`, `release`) are Kind A: `Context.Service`, `static layer` + `layerTest`. |
| **public root** | `export * as Addr from '@tmnl/addr'` on unscoped `tmnl` when the cluster exists |

`addr` is a 4-letter **cluster keystone**. The cluster name matching the TLA is intentional: this cluster *is* addressing. That does not license minting `@tmnl/vnt`, `@tmnl/pnl`, or any other TLA-as-package. New work still ships as cluster packages; this cluster’s name happens to be the TLA.

**Edges (downward only):**

```
                    ┌─────────────┐
                    │ @tmnl/addr  │   substrate
                    │    Addr     │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     @tmnl/state      @tmnl/chrome    @tmnl/shell
     (doc handles,    (pnl://)        (wnd://)
      stx optics)
           │
           ▼
     @tmnl/domain     business verticals (dmn/iot/…)
                      instance-as-domain is NOT theirs
```

Protocol (`pct`) may supply the federated `<instance>` token. Transport (`msh`/`lnk`) may carry Addr on the wire. Neither owns the grammar.

Do not put Addr under `@tmnl/shell`. Shell consumes `wnd://`. Chrome consumes `pnl://`. State/docs consume `doc://`. The substrate sits beneath them.

---

## §3 — Grammar (canonical in-TMNL form)

**In-app format is law.** Negotiate it now. Webview, IPC, clipboard MIME, MCP tools, and logs that stay in-product speak this grammar. Outside TMNL (true OS deep-link spelling) is a thin encode wrap later — see §3.7. Do not leave in-app format open for foreign consumers to invent.

### §3.1 Local (this instance)

A running TMNL is the implicit domain. Locators do not name it:

```
doc://<id>
pnl://<id>
wnd://<id>
```

Shape: `<scheme>://<id>` — exactly two slashes after the colon. No third slash. No empty authority. No query string.

### §3.2 Federated (instance is the domain)

Crossing instances, the instance is the authority — path-shaped, not a query bag:

```
addr://<instance>/doc/<id>
addr://<instance>/pnl/<id>
addr://<instance>/wnd/<id>
```

Shape: `addr://<instance>/<kind>/<id>` — exactly two path segments after `<instance>`; `<kind>` ∈ {`doc`,`pnl`,`wnd`}. No trailing slash. No empty segments. No query string.

`<instance>` is an **opaque brandable string** (same character class as `<id>`). It may later be a `pct:` `nodeId` when federated. That does not invent a second identity system and does not give PCT ownership of locator grammar. PCT identity ([`RFC-IDENTITY.md`](../../../pct/RFC-IDENTITY.md)) stays scoped keys, grants, audiences. Addr stays locators and resource handles. Do not merge the RFCs.

### §3.3 Particulars (fragment ↔ optic)

Scheme selects the **resource class**. Optic selects the **slot**.

On the wire, the slot is a URI fragment. Interior, it is an optic. **The codec is the same path language as `stx` `autoLens`:** successive string keys, one `.key(prop)` per segment — the Proxy chain `lens.user.name` is keys `["user","name"]`.

Wire encoding:

```
#<key>(.<key>)*
```

Examples:

```
doc://<id>#body
doc://<id>#user.name
addr://<instance>/doc/<id>#body
```

- Empty fragment → whole resource (no optic / identity optic).
- Leading `#` only; no JSON Pointer (`#/…`), no brackets, no array sugar in v1.
- Keys are non-empty; no leading/trailing `.`; no `..`; fail closed on malformed paths.
- Handlers receive `{ addr, optic }`. They do not `split('#')`.

`packages/stx/src/internal/auto-lens.ts` remains the in-memory half. Addr binds fragment ↔ that path; it does not reimplement optics.

### §3.4 Character class (`<id>`, `<instance>`)

Both tokens:

- One or more of `A–Z` `a–z` `0–9` `.` `_` `-` `~`, **or** pct-encoded octets (`%HH`) for anything else needed later.
- **Forbidden unencoded:** `/` `?` `#` `@` whitespace control chars.
- Non-empty. Decode fails closed on empty, illegal chars, or bad pct sequences.

Local form: after `scheme://`, the remainder until `#` or EOS **is** the id — if it contains `/`, fail (do not treat as hierarchical path).

### §3.5 Slash rules & fail-closed decode

| Input | Result |
|---|---|
| Known local scheme, `://`, legal id, optional legal fragment | Addr |
| `addr://` + legal instance + `/` + known kind + `/` + legal id + optional fragment | Addr |
| Unknown scheme | fail |
| `doc:/x`, `doc:///x`, `doc:x`, trailing `/`, extra `/` | fail |
| Empty id / empty instance / empty kind | fail |
| `addr://…` with unknown kind | fail |
| Query string on any TMNL scheme | fail |
| Malformed fragment path | fail |

Semantic round-trip: `encode(decode(s))` equals `s` **as Addr**, not as a byte-identical href. WHATWG normalization is irrelevant; the ADT is the truth.

Parse produces an Addr. **Authorize is a later step.** A string that decodes is not a permission.

### §3.6 Foreign interop

`file://` remains the one scheme TMNL does not own. Editor and Tauri already speak it. Do not wrap it as `doc://` with a file backend *for interop* — a local file the OS can open stays `file://`. A TMNL document whose *backend* happens to be a file is still `doc://`.

### §3.7 OS deep links (future — thin wrap)

One desktop-registered scheme. It **encodes** an Addr; it is not a second identity system.

- Never `…://run?cmd=`.
- Never OS-register `doc://` / `pnl://` / `wnd://` as protocols.
- Spelling of the desktop scheme name is **deferred** (see §9). Mapping is not: desktop URL is an Addr encoding, decode once, then the interior tagged form. In-app canonical form above is already law; OS spelling does not block lifts.

`cursor-plan://` is Cursor’s plan UI. Out of scope forever.

---

## §4 — Resource algebra

Four pieces, one layer:

| Piece | Role |
|---|---|
| **Schema** | Shape of the resource |
| **annotations / decorators** | Bless fields: locator, focus, capability, lifetime — via Effect `Schema.annotations` |
| **Optic** | Get / set / modify the particular |
| **Scope** | Handle lease — open, subscribe, release |

### §4.1 Schema is the resource

A resource is an Effect Schema with a scheme. The schema *is* the class; the tagged Addr *is* the identity.

```ts
const Doc = Schema.Struct({
  id: DocId,
  body: Schema.String.annotations({
    [Addr.Focus]: "body",
    [Addr.Ops]: ["get", "modify", "watch"],
  }),
}).pipe(Addr.resource({ scheme: "doc" }))
```

`Addr.resource` (decorator API — decided):

1. Injects Effect `Schema.annotations` onto the schema (scheme, resource-class metadata).
2. Registers the resource class in the Addr registry (scheme → schema / handler binding point).
3. Does **not** invent a parallel annotation system. Field blessing is `Schema.annotations` (optionally via a thin `Addr.annotate` helper that *is* annotations under the hood).

### §4.2 Capability vocabulary

Capability triad on blessed particulars:

| Cap | Meaning |
|---|---|
| `get` | read the particular |
| `modify` | replace / modify the particular |
| `watch` | subscribe to changes on the particular |

**Lease is not a fourth field op.** Open / subscribe / release live on Scope (`Addr.open(…).pipe(Effect.scoped)`). Unblessed fields are not addressable. Default is closed.

### §4.3 Optic is the in-memory half

`packages/stx/src/internal/auto-lens.ts` already builds a memoized Proxy tree over `Optic.id<S>().key(prop)` with class-aware `replace` / `modify`. Addr does not reimplement that. Addr **binds** an optic to a resource handle:

- wire fragment → autoLens key path (codec above)
- `get` / `replace` / `modify` on the particular
- handlers see optics, not strings

`stx` stays state. Addr stays addressing. The optic is the seam.

### §4.4 Scope is the lease

Open is not parse. Open acquires a handle inside an Effect Scope: subscribe, use, release. Dropping the scope releases the backend (Y.Doc room, panel mount, OS window claim — whatever the scheme’s handler registered).

```ts
yield* Addr.get("doc://abc#body")
yield* Addr.modify("doc://abc#body", f)
yield* Addr.watch("doc://abc#body", /* … */)

const h = yield* Addr.open("pnl://main").pipe(Effect.scoped)
```

`layerTest` for Addr is an in-memory handler map (lnk’s `InMemoryWire` shape): parse + optic + fake lease, no Yjs, no Tauri window.

### §4.5 Backend binding (scheme registry + adapters)

**Decided strategy:**

- Addr keeps a **registry keyed by scheme** (`doc` / `pnl` / `wnd` / …). Scheme table stays clean: scheme → resource class → handler entry point.
- **Adapters live in the handler / owning cluster** (Y.Doc vs file vs canvas under state’s doc handler; panel mount under chrome; window claim under shell). Binding is adapter lookup *inside* that handler — not a second scheme, not a query param, not a URI suffix.
- Addr does not grow a parallel “backend://” namespace. Impl stays behind the scheme.

### §4.6 Wire vs interior

| | Wire | Interior |
|---|---|---|
| Form | URI string (canonical grammar §3) | tagged ADT + optic |
| Who | IPC, deep link, log, clipboard, MCP | every handler |
| Rule | encode from ADT | never re-parse mid-flight |

---

## §5 — Parse ≠ authorize (fail closed)

Per scheme: `TemplateLiteralParser` and/or `Schema.transformOrFail` into a tagged ADT. Unknown scheme → fail. Malformed id → fail. Bad slash shape → fail. Do not coerce. Rules in §3.5 are the decode contract.

**Do not use `Schema.URL` as the semantic validator.** WHATWG `URL` is an http(s) machine:

- slash-count flips host vs path (`doc://abc` vs `doc:///abc` vs `doc:abc`)
- opaque vs hierarchical paths
- IDNA, default ports, percent-decoding surprises
- custom schemes are second-class

`Schema.URL` may exist at a foreign `file://` interop edge if Tauri already hands us a WHATWG URL. Custom TMNL schemes go through the template/transform path.

Parse produces an Addr. **Authorize is a later step** (capability on the handle, PCT grant when federated, whatever the handler requires). A string that decodes is not a permission.

---

## §6 — First schemes & identity

| Scheme | Resource class | Owner cluster (consumer) | Notes |
|---|---|---|---|
| `doc://` | document | state / editors / canvas | Y.Doc, file-backed doc, canvas are **backends**, not schemes |
| `pnl://` | chrome panel | `@tmnl/chrome` / `pnl` | in-viewport UI identity |
| `wnd://` | OS window | `@tmnl/shell` / `wnd` | webview / Tauri window identity |

`file://` — foreign interop only. Not in the Addr scheme table as a TMNL resource class.

### §6.1 `DocId` vs buffer identity (decided)

**One document resource identity:** `DocId` — the `<id>` in `doc://<id>`, branded to the §3.4 character class. Buffer stack rewrite shapes around `DocId` / Addr-aligned document identity. Do **not** preserve `buf-…` vs `DocId` as sacred dual spaces.

If a secondary id is still needed after the rewrite, it is **view-state only** (ephemeral cursor / scroll / mode / window-onto-doc) — not a competing document locator. Legacy `BufferId` `buf-…` is debt to retire or demote; it is not Addr law.

### §6.2 Not first-class (this RFC)

| Thing | Fate |
|---|---|
| `ydoc://` | dead as identity; backend of `doc://` |
| `pty://` | doc kind **or** a later scheme — shelf still open (§9) |
| `widget://` | same |
| `task:`, `faceplate:` | branded IDs until they need a handle |
| `buf-…` / `BufferId` as document identity | dead as dual identity; rewrite around `DocId` |
| `schema://`, `merge://` | hypothesis locators; out of Addr until they are resources |
| `pct:` | pact node identity; may fill `<instance>` |
| `cursor-plan://` | Cursor chrome; never |

Live code that documents `ydoc://` / `pty://` / `widget://` on `BufferMeta.uri` (`packages/tmnl/src/lib/buffer/schemas/buffer.ts`) is **debt**. Pass 0 does not rewrite it. The Addr lift + buffer rewrite retarget that field to `DocId` / Addr.

---

## §7 — Non-goals

- **No package cut in this pass.** No `packages/addr`, no Nx project, no barrel, no codemod of `BufferMeta.uri`.
- **No OS protocol registration.** Deep-link spelling is future; in-app encoding law is set now.
- **No teaching Addr Cursor’s `cursor-plan://`.**
- **No URI-ifying the colon-prefix soup** for non-resources. Brands stay brands until they need handles.
- **No merging with `pct` identity.** Grants and keys stay in protocol. Locators stay here.
- **No stealing `dmn`.** Domain cluster is business verticals. Instance-as-domain is Addr.
- **No `tmnl://run?cmd=` command channel.** Ever.
- **No byte-identical href fetish.** Semantic Addr equality.
- **No `Schema.URL` as the custom-scheme oracle.**
- **No parallel annotation system.** Effect `Schema.annotations` only, wrapped by `Addr.resource`.

---

## §8 — Sequence / gate

The rose-tree execution order still holds: **docs → cleanup Pass 0 → stop → reconvene → lifts.** This RFC is a docs artifact. Decisions below are **closed**; the gate is still no package cut until Pass 0 + reconvene.

1. **This RFC** (written; threads closed in §9). Law for locators and the addr cluster.
2. **Rose-tree RFC** ([plan](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)) still names the full cluster table — it must include `@tmnl/addr` / `addr` when drafted.
3. **Cleanup Pass 0** — repair, archive, testbeds. Do **not** sneak an Addr reshape into Pass 0. Do not retarget `BufferMeta.uri` yet.
4. **Reconvene.**
5. **Cut `packages/addr`** (Layout A, `.js` specifiers, source exports, `export * as Addr`). Substrate — land **before** chrome/shell need resource handles, or those lifts stub locators as branded strings until Addr exists.
6. **First handlers:** `doc`, `pnl`, `wnd`. In-memory `layerTest` first. Yjs / Tauri / panel mounts are backend adapters behind the handler, not the algebra.
7. **Retarget** buffer URI folklore and any `ydoc://` strings as part of the doc handler + buffer rewrite around `DocId` — not before.
8. **OS deep-link encoding** last, when there is a desktop boundary worth registering (thin wrap; spelling still free).

Consumers (`pnl`, `wnd`, editors) may *speak* the locator spelling in comments and schemas after reconvene. They do not implement parse/open/modify.

---

## §9 — Closed decisions & remaining deferrals

### Closed (law — do not reopen)

| ID | Decision |
|---|---|
| **Format** | In-TMNL canonical grammar is §3. Product law for webview / IPC / clipboard / MCP / in-product logs. Negotiate now; do not defer to OS/foreign consumers. |
| **ADDR-2** | `<instance>` = opaque brandable string (same char class as `<id>`). May be `pct` `nodeId` later. No second identity system; PCT does not own grammar. |
| **ADDR-4** | Capability triad: `get` / `modify` / `watch`. Lease via Scope / `open` — not theater. |
| **ADDR-5** | Registry keyed by scheme; adapters live in handler / owning cluster. Scheme table stays clean; binding = adapter lookup. |
| **ADDR-6** | `DocId` is the `doc://` resource identity. Shape buffer rewrite around it. `BufferId`/`buf-…` not sacred; secondary view-state only if still needed. |
| **ADDR-7** | Fragment ↔ optic codec = `stx` autoLens key path (`#a.b.c` ↔ successive `.key()`). Genius, keep it. |
| **ADDR-8** | Public blessing = Effect `Schema.annotations`. `Addr.resource` injects annotations + registers the class. No parallel annotation system. |

### Still deferred (not inventing)

| ID | Thread | Why deferred |
|---|---|---|
| ADDR-1 | Desktop OS scheme **spelling** | Law is “one scheme, encodes Addr” as a thin wrap. Name is not ratified. Do not assume `tmnl://`. Does **not** block in-app format or package lift after reconvene. |
| ADDR-3 | `pty://` / `widget://` as `doc://` kinds vs later schemes | First-class identity is refused. Which shelf they land on is a later lift. |

---

## §10 — Backlinks

**Law hub:** [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md)  
**Docs gate (rose tree RFC):** [TLA module RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Pass 0:** [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Public root (re-export `Addr` when the cluster exists):** [tmnl public root](cursor-plan://plan/tmnl_public_root_c3d04422.plan.md)

**First-scheme consumers (do not implement Addr):**

- `pnl://` — [pnl floating rewrite](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md)
- `wnd://` — [wnd os windows](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) · [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)
- `doc://` — buffer/editor debt in `packages/tmnl/src/lib/buffer/`; state cluster later — rewrite around `DocId`

**Adjacent, not owners:**

- [domain cluster dmn](cursor-plan://plan/domain_cluster_dmn_f6a37755.plan.md) — business verticals; instance-as-domain is Addr
- [protocol cluster pct](cursor-plan://plan/protocol_cluster_pct_b8c59977.plan.md) — `nodeId` may fill `<instance>`
- Kind A/B + `layerTest`: [`tla-package-suites-rfc.md`](tla-package-suites-rfc.md) §0.3 · [`effect-v4-layer-doctrine.md`](effect-v4-layer-doctrine.md)
- In-memory optic half / fragment codec: `packages/stx/src/internal/auto-lens.ts`
- PCT identity (not locators): [`packages/pct/RFC-IDENTITY.md`](../../../pct/RFC-IDENTITY.md)

---

*This RFC is the source of truth for `@tmnl/addr`. Decisions above are closed. Do not cut the package until Pass 0 is done and Prime reconvenes.*
