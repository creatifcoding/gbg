#!/usr/bin/env bun
/**
 * Prospect Pipeline — Seed Initial Data
 *
 * Ingests the 36 prospects from the initial scraping passes
 * into the SQLite database via the HarvestService.
 *
 * Usage:
 *   bun src/lib/prospects/migrations/seed-initial.ts
 *
 * @module
 */

import { Effect, Console } from 'effect'
import { ProspectDbLayer } from '../models/sqlite-layer'
import { HarvestService } from '../services/harvest'
import { CIPScoring } from '../services/cip-scoring'
import type { HarvestCompanyRecord } from '../services/harvest'
import type { Industry, CompanySize, TitleLevel, SignalType } from '../schemas/domain'

// =============================================================================
// Seed Data — From our 4 scraping passes
// =============================================================================

const initialProspects: ReadonlyArray<HarvestCompanyRecord> = [
  // ─── A-TIER: AMH Installation (JCK analogs) ────────────────────────
  {
    name: 'Conveyor Specialties Inc',
    industry: 'construction' as Industry,
    subIndustry: 'AMH Installation',
    hq: 'Crest Hill, IL, USA',
    size: 'mid_small' as CompanySize,
    website: 'https://conveyorspecialtiesinc.com',
    description: 'Mechanical installation experts in material handling. Installs for Daifuku, Dematic, KNAPP, Honeywell Intelligrated. National scope.',
    tags: ['amh', 'conveyor', 'jck-analog', 'sortation'],
    signals: [
      { type: 'manual_observation' as SignalType, title: 'Exact JCK analog — same integrator clients (Daifuku, Dematic, KNAPP)', weight: 3 },
      { type: 'pain_admission' as SignalType, title: 'No digital/tech presence — likely Excel/paper ops', weight: 3 },
    ],
  },
  {
    name: 'Advanced Conveyor Installation',
    industry: 'construction' as Industry,
    subIndustry: 'AMH Installation',
    hq: 'Multi-state (14 licenses)',
    size: 'small' as CompanySize,
    website: 'https://theacillc.com',
    description: 'Specialty conveyor and sorter installation. 100+ years combined experience. NWBE certified. Licensed in 14 states.',
    tags: ['amh', 'conveyor', 'jck-analog', 'nwbe', 'women-owned'],
    signals: [
      { type: 'manual_observation' as SignalType, title: 'Specialty sorter installer with national scope', weight: 3 },
      { type: 'manual_observation' as SignalType, title: 'NWBE certified — access to set-aside funding for tech adoption', weight: 2 },
    ],
  },
  {
    name: 'AMH Industrial',
    industry: 'construction' as Industry,
    subIndustry: 'AMH Installation',
    hq: 'Memphis, TN, USA',
    size: 'small' as CompanySize,
    website: 'https://amhindustrial.com',
    description: 'Purchased operations of DanMar Installations (30+ year company). Heavy material handling in factories and fulfillment centers.',
    tags: ['amh', 'jck-analog', 'new-ownership'],
    signals: [
      { type: 'acquisition' as SignalType, title: 'New ownership (2023) of 30-year legacy business — modernization window', weight: 3 },
      { type: 'pain_admission' as SignalType, title: 'No visible tech presence — inherited paper processes from DanMar', weight: 3 },
    ],
  },
  // ─── A-TIER: Construction (tech-investing GCs) ─────────────────────
  {
    name: 'Mortenson Construction',
    industry: 'construction' as Industry,
    hq: 'Minneapolis, MN, USA',
    size: 'mid_large' as CompanySize,
    revenue: '$5B+',
    employeeCount: 6000,
    website: 'https://www.mortenson.com',
    description: 'ENR Top 20 contractor. Heavy investment in construction technology. Uses Trimble Stratus/Propeller for site data.',
    tags: ['enr-top-20', 'tech-forward'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring AI Researcher - Construction', weight: 3 },
      { type: 'job_posting' as SignalType, title: 'Hiring ITS Director of Construction Technology', weight: 3 },
      { type: 'job_posting' as SignalType, title: 'Hiring IT Manager - Data & AI', weight: 2 },
    ],
    decisionMakers: [
      { name: 'Construction Technology Director', title: 'ITS Director of Construction Technology', titleLevel: 'director' as TitleLevel },
    ],
  },
  {
    name: 'Suffolk Construction',
    industry: 'construction' as Industry,
    hq: 'Boston, MA, USA',
    size: 'mid_large' as CompanySize,
    revenue: '$5B+',
    employeeCount: 2700,
    website: 'https://suffolk.com',
    description: 'Known for Jobsite of the Future approach. Active digital transformation. SiteAware partnership.',
    tags: ['tech-forward', 'digital-transformation'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Senior Manager, Digital Engineering role', weight: 3 },
      { type: 'job_posting' as SignalType, title: 'Hiring VDC Engineers in multiple cities', weight: 2 },
    ],
    decisionMakers: [
      { name: 'Joshua Weyand', title: 'Director of Construction Technology', titleLevel: 'director' as TitleLevel },
    ],
  },
  {
    name: 'Boh Bros. Construction',
    industry: 'construction' as Industry,
    hq: 'New Orleans, LA, USA',
    size: 'mid' as CompanySize,
    revenue: '$300-600M',
    website: 'https://bohbros.com',
    description: 'Heavy civil contractor. Infrastructure-focused. Procore user.',
    tags: ['heavy-civil', 'infrastructure'],
    signals: [
      { type: 'leadership_change' as SignalType, title: 'Director of IT + Field Audit + Process Improvement — title IS our pitch', weight: 3 },
    ],
    decisionMakers: [
      { name: 'Adam Krob', title: 'Director of IT, Field Audit, and Process Improvement', titleLevel: 'director' as TitleLevel },
    ],
  },
  {
    name: 'Dick Anderson Construction',
    industry: 'construction' as Industry,
    hq: 'Great Falls, MT, USA',
    size: 'mid_small' as CompanySize,
    revenue: '$200-400M',
    website: 'https://daconstruction.com',
    description: 'Regional GC with dedicated Director of Technology & Innovation.',
    tags: ['regional-gc', 'tech-director'],
    signals: [
      { type: 'manual_observation' as SignalType, title: 'Has Dir of Technology & Innovation (Sean Courtney) — small team needs outside help', weight: 2 },
    ],
    decisionMakers: [
      { name: 'Sean Courtney', title: 'Director of Technology and Innovation', titleLevel: 'director' as TitleLevel },
    ],
  },
  // ─── A-TIER: Manufacturing / Energy ────────────────────────────────
  {
    name: 'Southern Lifting & Hoisting',
    industry: 'manufacturing' as Industry,
    subIndustry: 'Industrial Equipment',
    hq: 'Kilgore, TX, USA',
    size: 'mid_small' as CompanySize,
    description: 'Rapidly growing manufacturer across multiple divisions. Posted for Operations Systems Developer (ERP & Manufacturing).',
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Operations Systems Developer (ERP & Manufacturing) — they ARE looking for us', weight: 3 },
    ],
  },
  {
    name: 'Euclid Power',
    industry: 'renewable_energy' as Industry,
    hq: 'New York, NY, USA',
    size: 'mid_small' as CompanySize,
    employeeCount: 73,
    revenue: '$20M total funding',
    website: 'https://euclidpower.com',
    description: 'Renewable energy project solutions and software. Series A. Growing 28% YoY. MCJ portfolio company.',
    tags: ['series-a', 'high-growth', 'renewable'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Assoc Director Renewable Energy Data Strategy & Solutions', weight: 3 },
      { type: 'funding_round' as SignalType, title: 'Series A — $20M total funding, growing 28% YoY', weight: 3 },
    ],
  },
  // ─── B-TIER ────────────────────────────────────────────────────────
  {
    name: 'Chobani',
    industry: 'food_beverage' as Industry,
    hq: 'New Berlin, NY / Twin Falls, ID, USA',
    size: 'mid_large' as CompanySize,
    employeeCount: 3000,
    revenue: '$2B+',
    website: 'https://www.chobani.com',
    description: 'Major yogurt manufacturer. Scaling automation across multiple plants.',
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Sr. Director Automation Engineering & OT ($130-160K)', weight: 3 },
      { type: 'job_posting' as SignalType, title: 'Hiring Automation Engineers at multiple facilities', weight: 2 },
    ],
  },
  {
    name: 'WaterBridge Resources',
    industry: 'energy' as Industry,
    subIndustry: 'Water Infrastructure',
    hq: 'Houston, TX, USA',
    size: 'mid' as CompanySize,
    employeeCount: 500,
    website: 'https://h2obridge.com',
    description: 'Produced water infrastructure. Pipeline networks. Modernizing with IIoT and SCADA (Cirrus Link / Ignition).',
    signals: [
      { type: 'manual_observation' as SignalType, title: 'Actively modernizing with IIoT and SCADA', weight: 2 },
    ],
  },
  {
    name: 'BETA Technologies',
    industry: 'aviation' as Industry,
    hq: 'South Burlington, VT, USA',
    size: 'mid' as CompanySize,
    employeeCount: 800,
    website: 'https://www.beta.team',
    description: 'Electric aircraft manufacturer. Building manufacturing operations from scratch. Well-funded startup.',
    tags: ['electric-aviation', 'greenfield'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Data Platform Engineer - Digital Operations', weight: 3 },
    ],
  },
  {
    name: 'Miller Electric Company',
    industry: 'construction' as Industry,
    subIndustry: 'Electrical Contracting',
    hq: 'Jacksonville, FL, USA',
    size: 'mid_large' as CompanySize,
    employeeCount: 2000,
    website: 'https://www.mecojax.com',
    description: 'Full-service electrical contractor. Systems integration, energy, building intelligence, business continuity.',
    signals: [
      { type: 'manual_observation' as SignalType, title: 'Large electrical contractor with diverse service lines — field crew mgmt pain', weight: 2 },
    ],
  },
  {
    name: 'Amteck',
    industry: 'construction' as Industry,
    subIndustry: 'Electrical Design-Build',
    hq: 'Lexington, KY, USA',
    size: 'mid' as CompanySize,
    website: 'https://www.amteck.com',
    description: 'Electrical design/build + service + technologies + life safety. Decades of experience.',
    signals: [
      { type: 'manual_observation' as SignalType, title: 'Multi-discipline electrical contractor — design-build = evolving scope', weight: 2 },
    ],
  },
  {
    name: 'Warfel Construction',
    industry: 'construction' as Industry,
    hq: 'East Petersburg, PA, USA',
    size: 'mid_small' as CompanySize,
    revenue: '$150-300M',
    website: 'https://warfelcc.com',
    description: 'ENR Top 400 (#396). Founded 1911. Senior living, healthcare, education. Recently promoted Dir of IT.',
    tags: ['enr-top-400', 'legacy-company'],
    signals: [
      { type: 'leadership_change' as SignalType, title: 'Recently promoted Director of IT (Mitch Denlinger) — new mandate', weight: 2 },
    ],
    decisionMakers: [
      { name: 'Mitch Denlinger', title: 'Director of Information Technology', titleLevel: 'director' as TitleLevel, tenure: 'new' },
    ],
  },
  {
    name: 'Corso Systems',
    industry: 'manufacturing' as Industry,
    subIndustry: 'System Integrator',
    hq: 'USA',
    size: 'small' as CompanySize,
    website: 'https://corsosystems.com',
    description: 'SCADA/Ignition system integrator. Builds custom solutions for end users. Partnership opportunity — channel, not client.',
    tags: ['system-integrator', 'partnership'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Systems Engineers — small team needs contractor augmentation', weight: 2 },
    ],
  },
  {
    name: 'City of Statesville WWTP',
    industry: 'water_wastewater' as Industry,
    hq: 'Statesville, NC, USA',
    size: 'small' as CompanySize,
    website: 'https://www.statesvillenc.net',
    description: 'Municipal wastewater treatment plant. Active RFP for SCADA system upgrade at Third Creek WWTP.',
    tags: ['government', 'rfp-active'],
    signals: [
      { type: 'rfp' as SignalType, title: 'Active RFP for SCADA system upgrade at Third Creek WWTP', weight: 3, sourceUrl: 'https://www.statesvillenc.net/2025/02/14/17009/' },
    ],
  },
  {
    name: 'Tacoma Public Utilities',
    industry: 'energy' as Industry,
    hq: 'Tacoma, WA, USA',
    size: 'mid' as CompanySize,
    employeeCount: 1500,
    website: 'https://www.mytpu.org',
    description: 'Public utility. Hiring Senior Control System Engineer. Modernizing infrastructure.',
    tags: ['public-utility', 'government'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Senior Control System Engineer', weight: 2 },
    ],
  },
  {
    name: 'Cone Health',
    industry: 'healthcare' as Industry,
    hq: 'Greensboro, NC, USA',
    size: 'mid_large' as CompanySize,
    employeeCount: 13000,
    revenue: '$3.5B',
    website: 'https://www.conehealth.com',
    description: '$3.5B nonprofit health system. Has Cone Health Ventures arm launching digital health startups.',
    tags: ['healthcare', 'ventures-arm'],
    signals: [
      { type: 'job_posting' as SignalType, title: 'Founding CTO for Nclusive Scan via Cone Health Ventures', weight: 3 },
      { type: 'job_posting' as SignalType, title: 'Executive Director Digital Health Programs', weight: 2 },
    ],
  },
  {
    name: 'Wagman Inc',
    industry: 'construction' as Industry,
    subIndustry: 'Heavy Civil + Geotechnical',
    hq: 'York, PA, USA',
    size: 'mid_small' as CompanySize,
    employeeCount: 141,
    revenue: '$350M',
    website: 'https://wagman.com',
    description: '4th generation family-owned. Heavy civil + general construction + geotechnical. $350M revenue with only 141 employees = heavy subcontractor use.',
    tags: ['family-owned', 'heavy-civil'],
    signals: [
      { type: 'manual_observation' as SignalType, title: '$350M revenue / 141 employees = massive subcontractor coordination needs', weight: 2 },
    ],
  },
  {
    name: 'Shepherd Chemical Company',
    industry: 'chemical' as Industry,
    hq: 'Cincinnati, OH, USA',
    size: 'mid_small' as CompanySize,
    employeeCount: 87,
    website: 'https://shepchem.com',
    description: 'Specialty chemical manufacturer. Metal-based chemistries. Global operations from small HQ.',
    tags: ['specialty-chemical', 'process-manufacturing'],
  },
  {
    name: 'Palmer International',
    industry: 'chemical' as Industry,
    hq: 'Skippack, PA, USA',
    size: 'mid_small' as CompanySize,
    website: 'https://palmerint.com',
    description: 'Founded 1946. Specialty chemical manufacturer. Sustainability focus.',
    tags: ['specialty-chemical', 'legacy-company'],
  },
  {
    name: 'Oxalis Group',
    industry: 'maritime' as Industry,
    subIndustry: 'Shipyard Technology',
    hq: 'USA',
    size: 'mid_small' as CompanySize,
    website: 'https://oxalis.io',
    description: 'Building ShipyardOS — digital platform for US shipyards. Government/DoD shipyard modernization.',
    tags: ['shipyard', 'defense', 'digital-platform'],
    signals: [
      { type: 'product_launch' as SignalType, title: 'Building ShipyardOS — digital transformation for US shipbuilding', weight: 2 },
    ],
  },
  {
    name: 'BioTrack',
    industry: 'cannabis' as Industry,
    hq: 'Fort Lauderdale, FL, USA',
    size: 'small' as CompanySize,
    employeeCount: 45,
    revenue: '$12M',
    website: 'https://biotrack.com',
    description: 'Seed-to-sale inventory management + POS for cannabis. Compliance-heavy. Growing industry.',
    tags: ['cannabis', 'compliance', 'saas'],
  },
  {
    name: 'Sysdyne Technologies',
    industry: 'construction' as Industry,
    subIndustry: 'Ready-Mix Concrete Tech',
    hq: 'Stamford, CT, USA',
    size: 'small' as CompanySize,
    website: 'https://sysdynetechnologies.com',
    description: 'Cloud-native software for concrete operations. ConcreteGO dispatch product.',
    tags: ['concrete', 'dispatch', 'cloud-native'],
  },
  {
    name: 'Multiservice Industrial',
    industry: 'construction' as Industry,
    subIndustry: 'Mechanical Insulation',
    hq: 'USA',
    size: 'mid_small' as CompanySize,
    website: 'https://multiserviceindustrial.com',
    description: 'Mechanical insulation contractor with field crews. Family-like culture. Actively hiring.',
    tags: ['insulation', 'field-crews'],
  },
  {
    name: 'USIBWC',
    industry: 'water_wastewater' as Industry,
    hq: 'El Paso, TX, USA',
    size: 'mid' as CompanySize,
    website: 'https://www.ibwc.gov',
    description: 'International Boundary & Water Commission. Active SAM.gov contract for SCADA lifecycle support.',
    tags: ['government', 'federal', 'scada'],
    signals: [
      { type: 'rfp' as SignalType, title: 'Active SAM.gov contract: SCADA Lifecycle Support', weight: 3, sourceUrl: 'https://sam.gov' },
    ],
  },
  // ─── C-TIER (monitor) ──────────────────────────────────────────────
  {
    name: 'Lam Research',
    industry: 'manufacturing' as Industry,
    subIndustry: 'Semiconductor',
    hq: 'Fremont, CA, USA',
    size: 'large' as CompanySize,
    employeeCount: 17000,
    revenue: '$14B+',
    website: 'https://www.lamresearch.com',
    description: 'Semiconductor equipment manufacturer. Multiple DT roles posted.',
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Digital Transformation Manager - Manufacturing Quality', weight: 2 },
    ],
  },
  {
    name: 'Hitachi Energy',
    industry: 'energy' as Industry,
    hq: 'Raleigh, NC, USA',
    size: 'large' as CompanySize,
    employeeCount: 40000,
    website: 'https://www.hitachienergy.com',
    description: 'Global energy technology company.',
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Global Engineering Process Digital Transformation Manager', weight: 1 },
    ],
  },
  {
    name: 'Eaton Corporation',
    industry: 'manufacturing' as Industry,
    subIndustry: 'Power Management',
    hq: 'Dublin, Ireland',
    size: 'large' as CompanySize,
    employeeCount: 92000,
    website: 'https://www.eaton.com',
    description: 'Global power management company.',
    signals: [
      { type: 'job_posting' as SignalType, title: 'Hiring Digital Power Management Solutions Lead', weight: 1 },
    ],
  },
  {
    name: 'Hardline Built',
    industry: 'construction' as Industry,
    subIndustry: 'Construction Tech Startup',
    hq: 'Boston, MA, USA',
    size: 'micro' as CompanySize,
    employeeCount: 2,
    website: 'https://hardlinebuilt.com',
    description: 'Field-first daily reporting platform for construction. Founded 2025. COMPETITOR.',
    tags: ['competitor', 'startup'],
    signals: [
      { type: 'product_launch' as SignalType, title: 'Field-first construction reporting — competitor to our field ops approach', weight: 1 },
    ],
  },
  {
    name: 'FarmQA',
    industry: 'agriculture' as Industry,
    hq: 'Fargo, ND, USA',
    size: 'small' as CompanySize,
    employeeCount: 20,
    website: 'https://farmqa.com',
    description: 'Farm management / QA software. Growing 14% YoY. Precision agriculture niche.',
    tags: ['agtech', 'precision-ag'],
  },
  {
    name: 'ABCWUA',
    industry: 'water_wastewater' as Industry,
    hq: 'Albuquerque, NM, USA',
    size: 'mid_small' as CompanySize,
    employeeCount: 66,
    website: 'https://www.abcwua.org',
    description: 'Albuquerque Bernalillo County Water Utility Authority. Small utility growing 3.8% YoY.',
    tags: ['government', 'municipal', 'water-utility'],
  },
]

// =============================================================================
// Main Program
// =============================================================================

const program = Effect.gen(function* () {
  yield* Console.log('🌱 Seeding prospect pipeline...')
  yield* Console.log('')

  const harvest = yield* HarvestService

  // Ingest all prospects
  const result = yield* harvest.ingestBatch('web_search', initialProspects, 'Initial 4-pass scraping')

  yield* Console.log('')
  yield* Console.log(`📊 Batch ${result.batchId}:`)
  yield* Console.log(`   Found: ${result.recordsFound}`)
  yield* Console.log(`   New: ${result.recordsNew}`)
  yield* Console.log(`   Updated: ${result.recordsUpdated}`)
  yield* Console.log(`   Skipped: ${result.recordsSkipped}`)

  // Run CIP scoring
  yield* Console.log('')
  yield* Console.log('📐 Running CIP scoring...')
  const scoring = yield* CIPScoring
  const scored = yield* scoring.recalculateAll

  yield* Console.log(`   Scored: ${scored} decision makers`)

  // Pipeline summary
  yield* Console.log('')
  const summary = yield* harvest.pipelineSummary()
  yield* Console.log('📋 Pipeline Summary:')
  yield* Console.log(`   Companies: ${summary.totalCompanies}`)
  yield* Console.log(`   Decision Makers: ${summary.totalDecisionMakers}`)
  yield* Console.log(`   Signals: ${summary.totalSignals}`)
})

// =============================================================================
// Run
// =============================================================================

import { Layer } from 'effect'

const AppLayer = Layer.mergeAll(
  HarvestService.Default,
  CIPScoring.Default,
).pipe(Layer.provideMerge(ProspectDbLayer()))

Effect.runPromise(
  program.pipe(
    Effect.provide(AppLayer),
    Effect.catchAll((error) =>
      Console.error(`❌ Seed failed: ${String(error)}`)
    )
  )
).then(() => {
  console.log('\n✨ Seed complete!')
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
