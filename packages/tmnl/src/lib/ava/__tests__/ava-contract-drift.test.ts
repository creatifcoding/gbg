import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AVA_CONTRACT_V1,
  type AvaCommandName,
  type AvaContractArtifact,
  type AvaStreamName,
} from '../contracts'
import { AvaSubjectTemplates, avaSubjects } from '../services/AvaClientV2'
import {
  InvalidationRequest,
  SubscribeRequest,
  UnsubscribeRequest,
} from '../schemas/v2/status'

const canonicalArtifactPath = resolve(
  process.cwd(),
  'src/lib/ava/contracts/ava_contract_v1.json'
)

const canonicalArtifact = JSON.parse(
  readFileSync(canonicalArtifactPath, 'utf8')
) as AvaContractArtifact

describe('AVA contract drift gate', () => {
  it('keeps TS mirror aligned with canonical JSON artifact', () => {
    expect(AVA_CONTRACT_V1).toEqual(canonicalArtifact)
  })

  it('keeps AvaSubjectTemplates aligned with canonical command/stream templates', () => {
    for (const command of Object.keys(canonicalArtifact.commands) as AvaCommandName[]) {
      expect(AvaSubjectTemplates.commands[command]).toBe(
        canonicalArtifact.commands[command].subjectTemplate
      )
    }

    for (const stream of Object.keys(canonicalArtifact.streams) as AvaStreamName[]) {
      expect(AvaSubjectTemplates.streams[stream].single).toBe(
        canonicalArtifact.streams[stream].singleTemplate
      )
      expect(AvaSubjectTemplates.streams[stream].wildcard).toBe(
        canonicalArtifact.streams[stream].wildcardTemplate
      )
    }
  })

  it('keeps avaSubjects builders aligned with canonical command/stream subjects', () => {
    const viewId = 'view-drift-check-1'

    for (const command of Object.keys(canonicalArtifact.commands) as AvaCommandName[]) {
      const expected = canonicalArtifact.commands[command].subjectTemplate.replace(
        '{view_id}',
        viewId
      )
      expect(avaSubjects.command(command, viewId)).toBe(expected)
    }

    for (const stream of Object.keys(canonicalArtifact.streams) as AvaStreamName[]) {
      const expectedSingle = canonicalArtifact.streams[stream].singleTemplate.replace(
        '{view_id}',
        viewId
      )
      const expectedWildcard = canonicalArtifact.streams[stream].wildcardTemplate

      expect(avaSubjects.stream(stream, viewId)).toBe(expectedSingle)
      expect(avaSubjects.streamWildcard(stream)).toBe(expectedWildcard)
    }
  })
})

describe('AVA command payload casing contract', () => {
  it.effect('requires view_id and rejects viewId alias by schema decode', () =>
    Effect.gen(function* () {
      const invalidationDecoded = yield* Schema.decode(InvalidationRequest)({
        view_id: 'view-1',
        reason: 'refresh',
        force: false,
      })
      const subscribeDecoded = yield* Schema.decode(SubscribeRequest)({
        view_id: 'view-1',
      })
      const unsubscribeDecoded = yield* Schema.decode(UnsubscribeRequest)({
        view_id: 'view-1',
      })

      expect(invalidationDecoded.view_id).toBe('view-1')
      expect(subscribeDecoded.view_id).toBe('view-1')
      expect(unsubscribeDecoded.view_id).toBe('view-1')

      expect(() =>
        Schema.decodeUnknownSync(InvalidationRequest)({
          reason: 'missing view_id',
          force: false,
        })
      ).toThrow()
      expect(() => Schema.decodeUnknownSync(SubscribeRequest)({})).toThrow()
      expect(() => Schema.decodeUnknownSync(UnsubscribeRequest)({})).toThrow()

      expect(() =>
        Schema.decodeUnknownSync(InvalidationRequest)({
          viewId: 'view-1',
          reason: 'camel case key',
          force: false,
        })
      ).toThrow()
      expect(() =>
        Schema.decodeUnknownSync(SubscribeRequest)({ viewId: 'view-1' })
      ).toThrow()
      expect(() =>
        Schema.decodeUnknownSync(UnsubscribeRequest)({ viewId: 'view-1' })
      ).toThrow()
    })
  )
})
