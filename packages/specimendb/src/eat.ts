import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import { AssetExistsError as DiskAssetExistsError } from './assets'
import {
  copyOriginal,
  defaultAssetsDir,
  writeSidecar,
} from './assets'
import {
  cameraFromExif,
  localityFromExif,
  observedAtFromExif,
  sidecarFromTags,
} from './exif'
import { readExifTags } from './exif.server'
import { fileSpecimen, IntakeDecodeError } from './intake'
import { AttachmentId } from './schemas/identifiers'
import { attachToSpecimen } from './entity/specimen'
import { SpecimenRepo } from './repos/specimen-repo'
import {
  AssetExistsError,
  IntakeError,
} from './rpc/errors'
import type { EvidenceKind } from './schemas/specimen'
import type { Guess } from './schemas/guess'
import type { Locality } from './schemas/locality'
import type { Specimen } from './schemas/specimen'
import type { SpecimenId } from './schemas/identifiers'

export type EatFileInput = {
  kind: EvidenceKind
  bytes?: Uint8Array
  filename?: string
  mimeType?: string
  claim?: string
  tags?: ReadonlyArray<string>
  organismGuess?: Guess | null
  structureGuess?: Guess | null
  locality?: Locality
  questions?: ReadonlyArray<string>
  id?: SpecimenId
  assetsDir?: string
  now?: number
}

/**
 * Intake: eat a file. Picture requires bytes. Sidecar from exiftool.
 * Locality attaches only when GPSLatitude + GPSLongitude exist.
 */
export const eatFile = (
  input: EatFileInput,
): Effect.Effect<Specimen, IntakeError | AssetExistsError, SpecimenRepo> =>
  Effect.gen(function* () {
    if (input.kind === 'picture' && (!input.bytes || input.bytes.byteLength === 0)) {
      return yield* Effect.fail(
        new IntakeError({ issues: ['Picture intake needs a dropped file.'] }),
      )
    }

    const repo = yield* SpecimenRepo
    const now = input.now ?? Date.now()
    const takenIds = yield* repo.takenIds().pipe(
      Effect.mapError(
        (error) => new IntakeError({ issues: [error.message] }),
      ),
    )

    let locality = input.locality
    let observedAt: string | undefined
    let cameraMake: string | undefined
    let cameraModel: string | undefined
    let sidecar:
      | ReturnType<typeof sidecarFromTags>
      | undefined

    if (input.kind === 'picture' && input.bytes) {
      const read = yield* Effect.tryPromise({
        try: () =>
          readExifTags({
            bytes: input.bytes!,
            filename: input.filename,
          }),
        catch: (cause) =>
          new IntakeError({
            issues: [
              cause instanceof Error ? cause.message : 'Could not read EXIF',
            ],
          }),
      })
      sidecar = sidecarFromTags({
        tool: read.tool,
        tags: read.tags,
        originalPresent: true,
      })
      const gps = localityFromExif(read.tags)
      locality = gps._tag === 'gps' ? gps : undefined
      observedAt = observedAtFromExif(read.tags) ?? undefined
      const camera = cameraFromExif(read.tags)
      cameraMake = camera.make ?? undefined
      cameraModel = camera.model ?? undefined
    } else if (input.kind !== 'picture') {
      locality = input.locality?._tag === 'named' ? input.locality : undefined
    } else {
      locality = undefined
    }

    let filed
    try {
      filed = fileSpecimen(
        {
          kind: input.kind,
          ...(input.claim ? { claim: input.claim } : {}),
          ...(input.tags && input.tags.length > 0 ? { tags: [...input.tags] } : {}),
          ...(input.organismGuess ? { organismGuess: input.organismGuess } : {}),
          ...(input.structureGuess ? { structureGuess: input.structureGuess } : {}),
          ...(locality ? { locality } : {}),
          ...(observedAt ? { observedAt } : {}),
          ...(cameraMake ? { cameraMake } : {}),
          ...(cameraModel ? { cameraModel } : {}),
          ...(input.questions && input.questions.length > 0
            ? { questions: [...input.questions] }
            : {}),
          ...(input.id ? { id: input.id } : {}),
          takenIds,
        },
        now,
      )
    } catch (error) {
      if (error instanceof IntakeDecodeError) {
        return yield* Effect.fail(new IntakeError({ issues: [...error.issues] }))
      }
      return yield* Effect.fail(
        new IntakeError({
          issues: ['Need a type. Attach whatever is in hand.'],
        }),
      )
    }

    let specimen = filed.specimen
    const assetsDir = input.assetsDir ?? defaultAssetsDir()

    if (input.kind === 'picture' && input.bytes) {
      try {
        const copied = copyOriginal({
          assetsDir,
          specimenId: specimen.id,
          filename: input.filename ?? 'upload',
          mimeType: input.mimeType ?? 'application/octet-stream',
          bytes: input.bytes,
        })
        if (sidecar) {
          writeSidecar(copied.sidecarPath, sidecar)
        }
        const attachmentId = Schema.decodeUnknownSync(AttachmentId)(
          `att_${specimen.id}_original`,
        )
        specimen = attachToSpecimen(specimen, attachmentId, now)
      } catch (error) {
        if (error instanceof DiskAssetExistsError) {
          return yield* Effect.fail(new AssetExistsError({ dest: error.dest }))
        }
        throw error
      }
    }

    yield* repo.insert(specimen, filed.events).pipe(
      Effect.mapError(
        (error) => new IntakeError({ issues: [error.message] }),
      ),
    )
    return specimen
  })
