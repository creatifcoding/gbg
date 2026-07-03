/**
 * CompanyEntity Handlers — thin dispatch to CompanyRepository + ProvenanceService
 *
 * All reads use repo.reload() (raw SQL) to avoid Model schema Date/String
 * mismatch with PG TIMESTAMPTZ columns. Model.insert.make() for writes.
 *
 * @module prospects/entity/handlers/CompanyHandlers
 */

import { Effect, Option } from 'effect'
import { CompanyEntity, CompanyNotFoundError, CompanyAlreadyExistsError } from '../CompanyEntity'
import type { CompanyView } from '../CompanyEntity'
import { CompanyModel } from '../../models/CompanyModel'
import { CompanyRepository } from '../../services/repositories'
import { ProvenanceService } from '../../services/provenance'
import type { EntityType } from '../../services/provenance'

const ENTITY_TYPE: EntityType = 'company'

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const toView = (row: any): typeof CompanyView.Type => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  industry: row.industry,
  subIndustry: row.subIndustry ?? null,
  size: row.size,
  pipelineStage: row.pipelineStage,
  website: row.website ?? null,
  description: row.description ?? null,
})

export const CompanyEntityHandlers = CompanyEntity.toLayer(
  Effect.gen(function* () {
    const repo = yield* CompanyRepository
    const provenance = yield* ProvenanceService

    const load = (id: string) =>
      Effect.gen(function* () {
        const row = yield* repo.reload(id)
        if (!row) return yield* Effect.fail(new CompanyNotFoundError({ companyId: id }))
        return toView(row)
      })

    return {
      'Company.Create': (envelope) =>
        Effect.gen(function* () {
          const p = envelope.payload
          const slug = slugify(p.name)

          const existing = yield* repo.findBySlug(slug)
          if (existing) return yield* Effect.fail(new CompanyAlreadyExistsError({ slug }))

          yield* repo.insert(
            CompanyModel.insert.make({
              id: p.id,
              name: p.name,
              slug,
              industry: p.industry,
              subIndustry: p.subIndustry ? Option.some(p.subIndustry) : Option.none(),
              locationJson: Option.none(),
              size: p.size ?? 'unknown',
              headcountJson: Option.none(),
              revenueJson: Option.none(),
              website: p.website ? Option.some(p.website) : Option.none(),
              linkedinUrl: Option.none(),
              description: p.description ? Option.some(p.description) : Option.none(),
              capabilitiesJson: Option.none(),
              harvestSource: p.harvestSource,
              harvestBatchId: Option.none(),
              pipelineStage: 'harvested',
              tagsJson: p.tags ? Option.some(p.tags) : Option.none(),
              notes: Option.none(),
            })
          )

          yield* provenance.trackBatch([
            { entityType: ENTITY_TYPE, entityId: p.id, fieldName: 'name', value: p.name,
              source: { connector: p.harvestSource }, confidence: 1.0 },
            { entityType: ENTITY_TYPE, entityId: p.id, fieldName: 'industry', value: p.industry,
              source: { connector: p.harvestSource }, confidence: 0.7 },
          ])

          return yield* load(p.id)
        }),

      'Company.Get': (envelope) => load(envelope.payload.id),

      'Company.UpdateStage': (envelope) =>
        Effect.gen(function* () {
          const { id, stage } = envelope.payload
          yield* repo.updateStage(id, stage)
          yield* provenance.track({
            entityType: ENTITY_TYPE, entityId: id, fieldName: 'pipeline_stage',
            value: stage, source: { connector: 'manual' }, confidence: 1.0,
          })
          return yield* load(id)
        }),

      'Company.Enrich': (envelope) =>
        Effect.gen(function* () {
          const { id, field, value, source, confidence } = envelope.payload
          const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
          yield* repo.enrichField(id, field, valueStr)
          yield* provenance.track({
            entityType: ENTITY_TYPE, entityId: id, fieldName: field,
            value: valueStr, source: { connector: source }, confidence: confidence ?? 0.8,
          })
          return yield* load(id)
        }),
    }
  })
)
