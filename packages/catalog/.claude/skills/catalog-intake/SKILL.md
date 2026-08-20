---
name: catalog-intake
description: Catalog 10-second intake. Type, claim, 3+ tags. Raw is complete. Do not block on taxon, GPS, mechanism, or analog. No identification wizard.
model_invoked: true
triggers:
  - "intake"
  - "file a specimen"
  - "10-second"
  - "dump"
  - "fileSpecimen"
  - "open questions"
  - "one-line claim"
---

# Catalog intake

Dump first. File in one screen. Body waits. Raw is complete.

This package is biomimetic and specimen-first. A picture dump becomes a Specimen by copying the original into package assets and reading EXIF. Taxon, GPS, mechanism, and analog do not block filing. Open questions are enough for later understanding. The app does not invent citations, geocode from pixels, or run an identification wizard.

## Canonical sources

- Schemas: `src/lib/catalog/schemas/` (`specimen.ts`, `locality.ts`, `observation.ts`, `guess.ts`)
- Invariant: `src/lib/catalog/intake.ts` (`fileSpecimen`, `IntakeError`)
- Picture birth: `src/lib/catalog/store.server.ts` (`ingestPicture`), `exif.ts`, `exif.server.ts`, `assets.ts`
- Entity: `src/lib/catalog/entity/specimen-entity.ts` (status machine + events)
- Server: `src/lib/catalog/functions.ts` (`createSpecimen`)
- Screen: `src/ui/intake-drop.tsx`, `src/routes/intake.tsx`
- Persistence: `src/lib/catalog/repos/json-catalog.ts`, `src/lib/catalog/store.server.ts`

## First pass (required)

One screen. No wizard. No step 2.

| Field | Rule |
| --- | --- |
| first evidence | `picture` \| `dossier` \| `artifact` \| `note` |
| dropped file | required for `picture`. Copied to `assets/specimens/<id>/original.<ext>`. Never overwrite. |
| exif sidecar | `assets/specimens/<id>/exif.json`. Raw tags from `exiftool -j -n -a`, or `exifr` if exiftool is missing. |
| claim | one line, required |
| tags | at least 3 |
| taxon guess | optional. Marked `{ label, guess: true }` if present |
| part / structure | optional guess |
| locality | pictures: EXIF `GPSLatitude` / `GPSLongitude` / `GPSAltitude` / `GPSDateTime`, or `unknown`. Capture JPEGs get those tags from `navigator.geolocation` at shoot. Never IP, Cloudflare country, pixels, or a geocoded city. Other kinds may take a named string. |
| collected / observed | pictures: `DateTimeOriginal` when present. Other kinds optional. |
| camera | `Make` / `Model` when present |
| open questions | enough for later understanding. Zero or more, already in hand |
| id | `YYYYMMDD-NNN` from DateTimeOriginal or the filing day |

Status starts `raw`. That is a complete dump, not a draft. Intake also writes a CRUD Observation (`observation-of` the specimen) and hangs the original on that observation. Body is `''`.

Intake still owns filing. A JPEG from `capture/` is the preferred picture dump: browser geo written into GPS tags on the device, or unknown if location was denied. `ingestPicture` ignores form locality.

`fileSpecimen` is the record gate. `ingestPicture` is how a picture Specimen is born. If the dump cannot make that Specimen, throw `IntakeError`. Do not save a partial.

`20260819-001` is the first real specimen (elongate arthropod in a Taco Bell cup). EXIF was stripped. Status `raw`. Original not in this clone. Sidecar records empty tags.

## Then file

After `fileSpecimen` succeeds, the Specimen exists. Detail can take body, move status (`filed` / `working` / `dead`), and show blobs.

Deeper writing happens on `/specimens/$specimenId`, never as intake step 2.

## Patterns

### Pattern 1: Decode, then commit through the entity

```typescript
export function fileSpecimen(input: unknown, now = Date.now()): IntakeResult {
  const intake = decodeIntake(input) // throws -> IntakeError
  const { specimen, event } = createSpecimen({ …intake, status implied raw, body: '' }, now)
  return { specimen, observation, observationEdge, tags, questions, events: [event] }
}
```

### Pattern 2: One form

`IntakeDrop` is drop zone plus type tabs plus claim, tags, optional taxon/part, questions, submit. Pictures hide the locality field. GPS is EXIF-only and never a filing gate. No mechanism or analog fields. No identification step.

### Pattern 3: Empty is valid

Index may render zero specimens. Seed examples are opt-in and marked `example: true`.

## Anti-patterns

### Wizard

```typescript
// BANNED
/intake/type -> /intake/tags -> /intake/review
/intake/identify
```

Do not build an identification wizard. Raw specimens are complete.

### Require taxon, GPS, mechanism, or analog to file

```typescript
// BANNED
if (!intake.organismGuess) throw new IntakeError(['Identify it first'])
if (locality._tag === 'unknown') throw new IntakeError(['Need GPS'])
intake.mechanism // not on IntakeInput
intake.analog // not on IntakeInput
```

A Specimen can exist with `organismGuess: null`, locality `unknown`, no mechanism, and no analog. Open questions are enough. Do not invent an Organism record from a guess.

### Body at dump time

```typescript
// BANNED
decodeIntake({ …, body: 'methods section' })
```

Body is not on `IntakeInput`.

### Keep Card as a peer aggregate

Intake creates a Specimen. Do not revive Card.

### Invented locality

```typescript
// BANNED
locality: reverseGeocode(pixels)
localityFromExif({ latitude, longitude }) // IP or pixel dump
headers['cf-ipcountry']
```

Missing GPS tags file as `{ _tag: 'unknown' }`. Do not invent a place. Generic `latitude` / `longitude` keys are not GPS tags.

### Overwrite the original

```typescript
// BANNED
writeFileSync(assets/specimens/20260819-001/original.jpg, bytes)
```

Allocate the next `YYYYMMDD-NNN` instead. `wx` or throw `AssetExistsError`.

### Invented citations

Do not generate PMIDs, DOIs, or fake papers to fill a specimen.

### Soft save

Do not write a specimen with two tags and a blank claim "to come back later." The invariant is the product.

## Related

- `catalog-registry-patterns`
- `catalog-file-organization`
- `catalog-testbed-patterns`
