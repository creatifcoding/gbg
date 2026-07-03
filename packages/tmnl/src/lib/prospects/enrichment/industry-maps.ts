/**
 * Industry Classification Maps
 *
 * NAICS → Industry and SIC → Industry lookup tables.
 * Used by IndustryReclassWorkflow to upgrade 'other' companies.
 *
 * @module prospects/enrichment/industry-maps
 */

import type { Industry } from '../schemas/domain'

// =============================================================================
// NAICS → Industry (2-4 digit codes)
// =============================================================================

/**
 * NAICS (North American Industry Classification System) mapping.
 * 2-digit codes are broad sectors. 3-4 digit codes are subsectors.
 * More specific codes take priority over 2-digit parents.
 */
export const NAICS_TO_INDUSTRY: Record<string, Industry> = {
  // Construction (23)
  '23': 'construction',
  '236': 'construction', // Construction of Buildings
  '237': 'construction', // Heavy and Civil Engineering Construction
  '238': 'construction', // Specialty Trade Contractors
  '2381': 'construction', // Foundation/Structure/Exterior
  '2382': 'construction', // Building Equipment Contractors
  '2383': 'construction', // Building Finishing Contractors

  // Manufacturing (31-33)
  '31': 'manufacturing',
  '32': 'manufacturing',
  '33': 'manufacturing',
  '331': 'manufacturing', // Primary Metal
  '332': 'manufacturing', // Fabricated Metal Product
  '333': 'manufacturing', // Machinery
  '334': 'manufacturing', // Computer and Electronic Product
  '335': 'manufacturing', // Electrical Equipment
  '336': 'manufacturing', // Transportation Equipment
  '337': 'manufacturing', // Furniture
  '339': 'manufacturing', // Miscellaneous

  // Food & Beverage (311-312)
  '311': 'food_beverage', // Food Manufacturing
  '3111': 'food_beverage', // Animal Food
  '3112': 'food_beverage', // Grain and Oilseed Milling
  '3113': 'food_beverage', // Sugar and Confectionery
  '3114': 'food_beverage', // Fruit and Vegetable Preserving
  '3115': 'food_beverage', // Dairy Product
  '3116': 'food_beverage', // Animal Slaughtering and Processing
  '3117': 'food_beverage', // Seafood Product
  '3118': 'food_beverage', // Bakeries and Tortilla
  '3119': 'food_beverage', // Other Food
  '312': 'food_beverage', // Beverage and Tobacco Product
  '3121': 'food_beverage', // Beverage

  // Pharmaceutical / Healthcare (3254, 3391, 621-623)
  '3254': 'healthcare', // Pharmaceutical and Medicine
  '3391': 'healthcare', // Medical Equipment and Supplies
  '621': 'healthcare', // Ambulatory Health Care Services
  '622': 'healthcare', // Hospitals
  '623': 'healthcare', // Nursing and Residential Care

  // Transportation / Logistics (48-49)
  '48': 'logistics',
  '49': 'logistics',
  '481': 'logistics', // Air Transportation
  '482': 'logistics', // Rail Transportation
  '483': 'logistics', // Water Transportation
  '484': 'logistics', // Truck Transportation
  '488': 'logistics', // Support Activities for Transportation
  '491': 'logistics', // Postal Service
  '492': 'logistics', // Couriers and Messengers
  '493': 'logistics', // Warehousing and Storage

  // Utilities / Energy (22)
  '22': 'energy',
  '221': 'energy', // Utilities
  '2211': 'energy', // Electric Power Generation
  '2212': 'energy', // Natural Gas Distribution
  '2213': 'water_wastewater', // Water, Sewage, Other Systems

  // Mining / Oil & Gas (21)
  '21': 'mining',
  '211': 'energy', // Oil and Gas Extraction
  '212': 'mining', // Mining (except Oil and Gas)

  // Agriculture (11)
  '11': 'agriculture',
  '111': 'agriculture', // Crop Production
  '112': 'agriculture', // Animal Production
  '115': 'agriculture', // Support Activities for Agriculture

  // Chemical (325, excluding 3254 pharma)
  '325': 'chemical',
  '3251': 'chemical', // Basic Chemical
  '3252': 'chemical', // Resin, Rubber, Fiber
  '3253': 'chemical', // Agricultural Chemical
  '3255': 'chemical', // Paint, Coating, Adhesive
  '3256': 'chemical', // Soap, Cleaning Compound
  '3259': 'chemical', // Other Chemical Product
}

// =============================================================================
// SIC → Industry (SEC EDGAR uses SIC codes)
// =============================================================================

/**
 * SIC (Standard Industrial Classification) mapping.
 * 2-digit codes for major groups. Used by SEC EDGAR.
 */
export const SIC_TO_INDUSTRY: Record<string, Industry> = {
  // Agriculture (01-09)
  '01': 'agriculture', '02': 'agriculture', '07': 'agriculture', '08': 'agriculture', '09': 'agriculture',

  // Mining (10-14)
  '10': 'mining', '12': 'mining', '13': 'energy', '14': 'mining',

  // Construction (15-17)
  '15': 'construction', '16': 'construction', '17': 'construction',

  // Manufacturing (20-39)
  '20': 'food_beverage', // Food & Kindred Products
  '21': 'food_beverage', // Tobacco Products
  '22': 'manufacturing', // Textile Mill Products
  '23': 'manufacturing', // Apparel
  '24': 'manufacturing', // Lumber and Wood Products
  '25': 'manufacturing', // Furniture and Fixtures
  '26': 'manufacturing', // Paper and Allied Products
  '27': 'manufacturing', // Printing, Publishing
  '28': 'chemical', // Chemicals and Allied Products
  '29': 'energy', // Petroleum Refining
  '30': 'manufacturing', // Rubber and Plastics Products
  '31': 'manufacturing', // Leather
  '32': 'manufacturing', // Stone, Clay, Glass Products
  '33': 'manufacturing', // Primary Metal Industries
  '34': 'manufacturing', // Fabricated Metal Products
  '35': 'manufacturing', // Industrial and Commercial Machinery
  '36': 'manufacturing', // Electronic and Electrical Equipment
  '37': 'manufacturing', // Transportation Equipment
  '38': 'manufacturing', // Measuring, Analyzing, Controlling Instruments
  '39': 'manufacturing', // Miscellaneous Manufacturing

  // Transportation, Communications, Electric, Gas (40-49)
  '40': 'logistics', // Railroad Transportation
  '41': 'logistics', // Local and Suburban Transit
  '42': 'logistics', // Motor Freight Transportation
  '43': 'logistics', // US Postal Service
  '44': 'maritime', // Water Transportation
  '45': 'logistics', // Transportation by Air
  '46': 'logistics', // Pipelines
  '47': 'logistics', // Transportation Services
  '48': 'manufacturing', // Communications
  '49': 'energy', // Electric, Gas, Sanitary Services

  // Wholesale Trade (50-51)
  '50': 'logistics', // Wholesale Trade — Durable Goods
  '51': 'logistics', // Wholesale Trade — Nondurable Goods
}

// =============================================================================
// Enhanced Regex Patterns (50+ patterns)
// =============================================================================

/**
 * Regex-based industry detection. Each pattern returns an Industry
 * and a confidence score.
 */
export const INDUSTRY_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp
  readonly industry: Industry
  readonly confidence: number
}> = [
  // ── Logistics / Material Handling ──
  { pattern: /conveyor|sortation|material handling|warehouse automation/i, industry: 'logistics', confidence: 0.9 },
  { pattern: /freight|trucking|shipping|courier|cargo|drayage/i, industry: 'logistics', confidence: 0.8 },
  { pattern: /forklift|pallet|dock equipment|loading dock/i, industry: 'logistics', confidence: 0.8 },
  { pattern: /3pl|fulfillment center|distribution center/i, industry: 'logistics', confidence: 0.8 },
  { pattern: /cold chain|cold storage|refrigerat.*transport/i, industry: 'logistics', confidence: 0.7 },

  // ── Construction ──
  { pattern: /general contractor|construction company|builder/i, industry: 'construction', confidence: 0.9 },
  { pattern: /electrical contractor|mechanical contractor|plumbing contractor/i, industry: 'construction', confidence: 0.9 },
  { pattern: /hvac contractor|hvac install|heating.*cooling/i, industry: 'construction', confidence: 0.85 },
  { pattern: /steel erection|structural steel|iron work/i, industry: 'construction', confidence: 0.85 },
  { pattern: /insulation contractor|fireproofing|scaffolding/i, industry: 'construction', confidence: 0.8 },
  { pattern: /roofing|flooring|painting contractor|drywall/i, industry: 'construction', confidence: 0.8 },
  { pattern: /excavat|grading|paving|concrete|masonry/i, industry: 'construction', confidence: 0.8 },
  { pattern: /rigging|crane|hoisting|lifting/i, industry: 'construction', confidence: 0.75 },
  { pattern: /demolition|abatement|remediation/i, industry: 'construction', confidence: 0.75 },
  { pattern: /design.*build|construction manag/i, industry: 'construction', confidence: 0.7 },

  // ── Manufacturing ──
  { pattern: /manufactur|fabricat|machine shop|tool.*die/i, industry: 'manufacturing', confidence: 0.9 },
  { pattern: /weld|millwright|metal work|sheet metal/i, industry: 'manufacturing', confidence: 0.85 },
  { pattern: /cnc|precision machining|stamping|forging/i, industry: 'manufacturing', confidence: 0.85 },
  { pattern: /assembly|production line|lean manufactur/i, industry: 'manufacturing', confidence: 0.8 },
  { pattern: /injection mold|extrusion|die cast/i, industry: 'manufacturing', confidence: 0.85 },
  { pattern: /industrial equipment|capital equipment/i, industry: 'manufacturing', confidence: 0.7 },

  // ── Food & Beverage ──
  { pattern: /food process|food manufactur|food product/i, industry: 'food_beverage', confidence: 0.9 },
  { pattern: /bakery|baking|confection|candy/i, industry: 'food_beverage', confidence: 0.9 },
  { pattern: /dairy|cheese|milk process|creamery/i, industry: 'food_beverage', confidence: 0.9 },
  { pattern: /meat process|poultry|slaughter|butcher/i, industry: 'food_beverage', confidence: 0.9 },
  { pattern: /brewery|distillery|winery|beverage/i, industry: 'food_beverage', confidence: 0.9 },
  { pattern: /grain|flour|cereal|feed mill/i, industry: 'food_beverage', confidence: 0.8 },
  { pattern: /canning|preserv|frozen food/i, industry: 'food_beverage', confidence: 0.8 },
  { pattern: /seafood|fish process/i, industry: 'food_beverage', confidence: 0.85 },
  { pattern: /restaurant supply|food service equipment/i, industry: 'food_beverage', confidence: 0.7 },

  // ── Water / Wastewater ──
  { pattern: /water treatment|wastewater|sewage|water system/i, industry: 'water_wastewater', confidence: 0.9 },
  { pattern: /water utility|water district|water authority/i, industry: 'water_wastewater', confidence: 0.9 },
  { pattern: /irrigation|pump station|desalination/i, industry: 'water_wastewater', confidence: 0.8 },
  { pattern: /stormwater|drainage|water quality/i, industry: 'water_wastewater', confidence: 0.75 },

  // ── Energy ──
  { pattern: /solar|wind energy|renewable energy|wind farm/i, industry: 'energy', confidence: 0.9 },
  { pattern: /power plant|power generation|electric utilit/i, industry: 'energy', confidence: 0.9 },
  { pattern: /oil.*gas|petroleum|natural gas|pipeline/i, industry: 'energy', confidence: 0.85 },
  { pattern: /battery|energy storage|fuel cell/i, industry: 'energy', confidence: 0.8 },
  { pattern: /transmission.*distribution|substation|transformer/i, industry: 'energy', confidence: 0.8 },

  // ── Chemical ──
  { pattern: /chemical|coating|adhesive|sealant/i, industry: 'chemical', confidence: 0.8 },
  { pattern: /paint.*manufactur|industrial coating/i, industry: 'chemical', confidence: 0.8 },
  { pattern: /polymer|resin|plastic compound/i, industry: 'chemical', confidence: 0.75 },

  // ── Healthcare / Pharma ──
  { pattern: /pharma|biotech|medical device|life science/i, industry: 'healthcare', confidence: 0.9 },
  { pattern: /hospital|clinic|healthcare|health system/i, industry: 'healthcare', confidence: 0.85 },
  { pattern: /laboratory|lab service|diagnostic/i, industry: 'healthcare', confidence: 0.7 },

  // ── Agriculture ──
  { pattern: /farm|ranch|agricultur|crop|livestock/i, industry: 'agriculture', confidence: 0.85 },
  { pattern: /grain elevator|feed lot|agribusiness/i, industry: 'agriculture', confidence: 0.85 },
  { pattern: /fertilizer|seed.*company|agricultural equipment/i, industry: 'agriculture', confidence: 0.75 },

  // ── Maritime ──
  { pattern: /marine|shipyard|ship build|boat|maritime/i, industry: 'maritime', confidence: 0.85 },
  { pattern: /port.*authority|harbor|dredging/i, industry: 'maritime', confidence: 0.8 },
  { pattern: /offshore|subsea|diving.*contractor/i, industry: 'maritime', confidence: 0.75 },

  // ── Mining ──
  { pattern: /mining|quarry|mineral|aggregate/i, industry: 'mining', confidence: 0.85 },
  { pattern: /drilling|bore.*hole|exploration/i, industry: 'mining', confidence: 0.7 },

  // ── Aviation ──
  { pattern: /aviat|aerospace|aircraft|airport/i, industry: 'aviation', confidence: 0.85 },
  { pattern: /hangar|runway|air traffic/i, industry: 'aviation', confidence: 0.75 },
]

// =============================================================================
// Classification Engine
// =============================================================================

/**
 * Classify a company by name + optional metadata.
 * Returns null if no match found (stays 'other').
 *
 * Priority: NAICS code (if available) → SIC code → regex patterns
 */
export const classifyIndustry = (opts: {
  readonly name: string
  readonly description?: string | null
  readonly naicsCode?: string | null
  readonly sicCode?: string | null
  readonly entityType?: string | null
}): { industry: Industry; confidence: number; method: string } | null => {
  // 1. NAICS code (most specific first: 4-digit → 3-digit → 2-digit)
  if (opts.naicsCode) {
    const code = opts.naicsCode.trim()
    for (let len = Math.min(code.length, 4); len >= 2; len--) {
      const prefix = code.slice(0, len)
      if (NAICS_TO_INDUSTRY[prefix]) {
        return { industry: NAICS_TO_INDUSTRY[prefix], confidence: 0.95, method: `naics:${prefix}` }
      }
    }
  }

  // 2. SIC code (2-digit)
  if (opts.sicCode) {
    const code = opts.sicCode.trim().slice(0, 2)
    if (SIC_TO_INDUSTRY[code]) {
      return { industry: SIC_TO_INDUSTRY[code], confidence: 0.9, method: `sic:${code}` }
    }
  }

  // 3. Regex patterns (against name + description + entityType)
  const searchText = [opts.name, opts.description, opts.entityType].filter(Boolean).join(' ')
  let bestMatch: { industry: Industry; confidence: number; method: string } | null = null

  for (const p of INDUSTRY_PATTERNS) {
    if (p.pattern.test(searchText)) {
      if (!bestMatch || p.confidence > bestMatch.confidence) {
        bestMatch = { industry: p.industry, confidence: p.confidence, method: `regex:${p.pattern.source.slice(0, 30)}` }
      }
    }
  }

  return bestMatch
}
