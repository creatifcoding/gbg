import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { eatFile } from '../eat'
import { SpecimenRepo } from '../repos/specimen-repo'
import { SpecimenNotFound } from './errors'
import { SpecimendbRpcs } from './rpcs'

export const SpecimendbRpcLive = SpecimendbRpcs.toLayer(
  Effect.gen(function* () {
    const repo = yield* SpecimenRepo
    return {
      'Intake.File': (payload) =>
        eatFile({
          kind: payload.kind,
          bytes: payload.bytes,
          filename: payload.filename,
          mimeType: payload.mimeType,
          claim: payload.claim,
          tags: payload.tags,
          organismGuess: payload.organismGuess,
          structureGuess: payload.structureGuess,
          locality: payload.locality,
          questions: payload.questions,
          id: payload.id,
        }),
      'Specimen.Get': (payload) =>
        Effect.gen(function* () {
          const specimen = yield* repo.get(payload.id)
          if (!specimen) {
            return yield* Effect.fail(
              new SpecimenNotFound({ specimenId: payload.id }),
            )
          }
          return specimen
        }),
      'Specimen.List': () => repo.list(),
      'Specimen.Promote': (payload) => repo.promote(payload.id, payload.to),
    }
  }),
)

export const SpecimendbLive = SpecimendbRpcLive.pipe(Layer.provide(SpecimenRepo.layer))
