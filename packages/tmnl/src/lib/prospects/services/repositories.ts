/**
 * Prospect Pipeline — Repository Services
 *
 * Effect.Service wrappers around Model.makeRepository.
 * Each repository is a proper Effect service with a Live layer.
 *
 * Pattern: Effect.Service<Self>()("tag", { effect: ... })
 *
 * @module prospects/services/repositories
 */

import { Effect } from 'effect'
import { Model, SqlClient } from '@effect/sql'
import { CompanyModel } from '../models/CompanyModel'
import { DecisionMakerModel } from '../models/DecisionMakerModel'
import { SignalModel } from '../models/SignalModel'
import { OutreachModel } from '../models/OutreachModel'
import { ProposalModel } from '../models/ProposalModel'

// =============================================================================
// Raw repository factories (Model.makeRepository)
// =============================================================================

const _companyRepo = Model.makeRepository(CompanyModel, {
  tableName: 'companies',
  idColumn: 'id',
  spanPrefix: 'CompanyRepo',
})

const _decisionMakerRepo = Model.makeRepository(DecisionMakerModel, {
  tableName: 'decision_makers',
  idColumn: 'id',
  spanPrefix: 'DecisionMakerRepo',
})

const _signalRepo = Model.makeRepository(SignalModel, {
  tableName: 'signals',
  idColumn: 'id',
  spanPrefix: 'SignalRepo',
})

const _outreachRepo = Model.makeRepository(OutreachModel, {
  tableName: 'outreach',
  idColumn: 'id',
  spanPrefix: 'OutreachRepo',
})

const _proposalRepo = Model.makeRepository(ProposalModel, {
  tableName: 'proposals',
  idColumn: 'id',
  spanPrefix: 'ProposalRepo',
})

// =============================================================================
// CompanyRepository Service
// =============================================================================

export class CompanyRepository extends Effect.Service<CompanyRepository>()(
  'prospects/CompanyRepository',
  {
    effect: Effect.gen(function* () {
      const repo = yield* _companyRepo
      const sql = yield* SqlClient.SqlClient

      return {
        ...repo,

        /** Find company by slug (dedup key) */
        findBySlug: (slug: string) =>
          Effect.gen(function* () {
            const rows = yield* sql<CompanyModel>`
              SELECT * FROM companies WHERE slug = ${slug} LIMIT 1
            `
            return rows.length > 0 ? rows[0] : null
          }),

        /** Find companies by industry */
        findByIndustry: (industry: string) =>
          sql<CompanyModel>`
            SELECT * FROM companies WHERE industry = ${industry} ORDER BY name
          `,

        /** Find companies by pipeline stage */
        findByStage: (stage: string) =>
          sql<CompanyModel>`
            SELECT * FROM companies WHERE pipeline_stage = ${stage} ORDER BY name
          `,

        /** Count companies by harvest source */
        countBySource: () =>
          sql<{ source: string; count: number }>`
            SELECT harvest_source as source, COUNT(*) as count
            FROM companies GROUP BY harvest_source ORDER BY count DESC
          `,

        /** Search companies by name (case-insensitive) */
        search: (query: string) =>
          sql<CompanyModel>`
            SELECT * FROM companies
            WHERE name ILIKE ${'%' + query + '%'}
            ORDER BY name LIMIT 50
          `,

        /** Update pipeline stage for a company */
        updateStage: (id: string, stage: string) =>
          sql`
            UPDATE companies SET pipeline_stage = ${stage}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Enrich a single field by name */
        enrichField: (id: string, field: string, value: string) =>
          sql.unsafe(
            `UPDATE companies SET "${field}" = $1, updated_at = $2 WHERE id = $3`,
            [value, new Date().toISOString(), id]
          ).pipe(Effect.asVoid),

        /** Reload a single company after mutation */
        reload: (id: string) =>
          sql<CompanyModel>`SELECT * FROM companies WHERE id = ${id} LIMIT 1`.pipe(
            Effect.map((rows) => rows.length > 0 ? rows[0] : null)
          ),
      }
    }),
  }
) {}

// =============================================================================
// DecisionMakerRepository Service
// =============================================================================

export class DecisionMakerRepository extends Effect.Service<DecisionMakerRepository>()(
  'prospects/DecisionMakerRepository',
  {
    effect: Effect.gen(function* () {
      const repo = yield* _decisionMakerRepo
      const sql = yield* SqlClient.SqlClient

      return {
        ...repo,

        /** Top decision makers by CIP composite score */
        topByCIP: (limit: number = 25) =>
          sql<DecisionMakerModel>`
            SELECT * FROM decision_makers
            ORDER BY cip_composite DESC LIMIT ${limit}
          `,

        /** Decision makers for a company */
        findByCompany: (companyId: string) =>
          sql<DecisionMakerModel>`
            SELECT * FROM decision_makers
            WHERE company_id = ${companyId}
            ORDER BY cip_composite DESC
          `,

        /** Decision makers by pipeline stage */
        findByStage: (stage: string) =>
          sql<DecisionMakerModel>`
            SELECT * FROM decision_makers
            WHERE pipeline_stage = ${stage}
            ORDER BY cip_composite DESC
          `,

        /** Decision makers with high CIP but not yet contacted */
        readyForOutreach: (minComposite: number = 5.0) =>
          sql<DecisionMakerModel & { companyName: string; companyIndustry: string }>`
            SELECT dm.*, c.name as company_name, c.industry as company_industry
            FROM decision_makers dm
            JOIN companies c ON dm.company_id = c.id
            WHERE dm.cip_composite >= ${minComposite}
              AND dm.pipeline_stage IN ('scored', 'qualified')
            ORDER BY dm.cip_composite DESC
          `,

        /** Update pipeline stage */
        updateStage: (id: string, stage: string) =>
          sql`
            UPDATE decision_makers SET pipeline_stage = ${stage}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Update contact info (JSON column) */
        updateContacts: (id: string, contactsJson: string) =>
          sql`
            UPDATE decision_makers SET contacts_json = ${contactsJson}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Set contract estimate (JSON column) */
        setContractEstimate: (id: string, estimateJson: string) =>
          sql`
            UPDATE decision_makers SET contract_estimate_json = ${estimateJson}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Reload a single DM after mutation */
        reload: (id: string) =>
          sql<DecisionMakerModel>`SELECT * FROM decision_makers WHERE id = ${id} LIMIT 1`.pipe(
            Effect.map((rows) => rows.length > 0 ? rows[0] : null)
          ),
      }
    }),
  }
) {}

// =============================================================================
// SignalRepository Service
// =============================================================================

export class SignalRepository extends Effect.Service<SignalRepository>()(
  'prospects/SignalRepository',
  {
    effect: Effect.gen(function* () {
      const repo = yield* _signalRepo
      const sql = yield* SqlClient.SqlClient

      return {
        ...repo,

        /** Signals for a company, ordered by weight */
        findByCompany: (companyId: string) =>
          sql<SignalModel>`
            SELECT * FROM signals
            WHERE company_id = ${companyId}
            ORDER BY weight DESC, detected_at DESC
          `,

        /** Recent signals across all companies */
        recent: (limit: number = 50) =>
          sql<SignalModel & { companyName: string }>`
            SELECT s.*, c.name as company_name
            FROM signals s
            JOIN companies c ON s.company_id = c.id
            ORDER BY s.detected_at DESC LIMIT ${limit}
          `,

        /** Total signal weight per company (for interest scoring) */
        weightByCompany: () =>
          sql<{ companyId: string; totalWeight: number; signalCount: number }>`
            SELECT company_id as "companyId",
                   SUM(weight) as "totalWeight",
                   COUNT(*) as "signalCount"
            FROM signals
            GROUP BY company_id
            ORDER BY "totalWeight" DESC
          `,

        /** Attach signal to a decision maker */
        attachToDM: (id: string, decisionMakerId: string) =>
          sql`
            UPDATE signals SET decision_maker_id = ${decisionMakerId}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Set expiry on a signal */
        expire: (id: string) =>
          sql`
            UPDATE signals SET expires_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Reload a single signal after mutation */
        reload: (id: string) =>
          sql<SignalModel>`SELECT * FROM signals WHERE id = ${id} LIMIT 1`.pipe(
            Effect.map((rows) => rows.length > 0 ? rows[0] : null)
          ),
      }
    }),
  }
) {}

// =============================================================================
// OutreachRepository Service
// =============================================================================

export class OutreachRepository extends Effect.Service<OutreachRepository>()(
  'prospects/OutreachRepository',
  {
    effect: Effect.gen(function* () {
      const repo = yield* _outreachRepo
      const sql = yield* SqlClient.SqlClient

      return {
        ...repo,

        /** Outreach history for a decision maker */
        findByDecisionMaker: (dmId: string) =>
          sql<OutreachModel>`
            SELECT * FROM outreach
            WHERE decision_maker_id = ${dmId}
            ORDER BY created_at DESC
          `,

        /** Pending outreach (drafted, not sent) */
        pending: () =>
          sql<OutreachModel & { dmName: string; companyName: string }>`
            SELECT o.*, dm.name as dm_name, c.name as company_name
            FROM outreach o
            JOIN decision_makers dm ON o.decision_maker_id = dm.id
            JOIN companies c ON o.company_id = c.id
            WHERE o.status = 'drafted'
            ORDER BY o.created_at DESC
          `,

        /** Response rate by channel */
        responseRateByChannel: () =>
          sql<{ channel: string; sent: number; replied: number; rate: number }>`
            SELECT channel,
                   COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'replied')) as sent,
                   COUNT(*) FILTER (WHERE status = 'replied') as replied,
                   CASE
                     WHEN COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'replied')) > 0
                     THEN ROUND(
                       CAST(COUNT(*) FILTER (WHERE status = 'replied') AS REAL) /
                       COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'replied')) * 100, 1
                     )
                     ELSE 0
                   END as rate
            FROM outreach
            GROUP BY channel
          `,

        /** Mark outreach as sent */
        markSent: (id: string) =>
          sql`
            UPDATE outreach SET status = 'sent', sent_at = ${new Date().toISOString()}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Mark outreach as replied */
        markReplied: (id: string, notes?: string) =>
          sql`
            UPDATE outreach SET status = 'replied', responded_at = ${new Date().toISOString()},
              notes = COALESCE(${notes ?? null}, notes), updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Mark outreach as bounced */
        markBounced: (id: string) =>
          sql`
            UPDATE outreach SET status = 'bounced', updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Reload a single outreach after mutation */
        reload: (id: string) =>
          sql<OutreachModel>`SELECT * FROM outreach WHERE id = ${id} LIMIT 1`.pipe(
            Effect.map((rows) => rows.length > 0 ? rows[0] : null)
          ),
      }
    }),
  }
) {}

// =============================================================================
// ProposalRepository Service
// =============================================================================

export class ProposalRepository extends Effect.Service<ProposalRepository>()(
  'prospects/ProposalRepository',
  {
    effect: Effect.gen(function* () {
      const repo = yield* _proposalRepo
      const sql = yield* SqlClient.SqlClient

      return {
        ...repo,

        /** Proposals for a company */
        findByCompany: (companyId: string) =>
          sql<ProposalModel>`
            SELECT * FROM proposals WHERE company_id = ${companyId}
            ORDER BY version DESC, created_at DESC
          `,

        /** Proposals by status */
        findByStatus: (status: string) =>
          sql<ProposalModel>`
            SELECT * FROM proposals WHERE status = ${status}
            ORDER BY updated_at DESC
          `,

        /** Update status */
        advanceStatus: (id: string, status: string) =>
          sql`
            UPDATE proposals SET status = ${status}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Replace sections JSON */
        updateSections: (id: string, sectionsJson: string) =>
          sql`
            UPDATE proposals SET sections_json = ${sectionsJson}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Set contract estimate JSON */
        setEstimate: (id: string, estimateJson: string) =>
          sql`
            UPDATE proposals SET contract_estimate_json = ${estimateJson}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Set capabilities JSON */
        setCapabilities: (id: string, capabilitiesJson: string) =>
          sql`
            UPDATE proposals SET capabilities_json = ${capabilitiesJson}, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Increment version (e.g., after revision) */
        incrementVersion: (id: string) =>
          sql`
            UPDATE proposals SET version = version + 1, updated_at = ${new Date().toISOString()}
            WHERE id = ${id}
          `.pipe(Effect.asVoid),

        /** Reload */
        reload: (id: string) =>
          sql<ProposalModel>`SELECT * FROM proposals WHERE id = ${id} LIMIT 1`.pipe(
            Effect.map((rows) => rows.length > 0 ? rows[0] : null)
          ),
      }
    }),
  }
) {}
