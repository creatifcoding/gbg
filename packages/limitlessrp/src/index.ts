export type EvidenceKind = "observed" | "provided" | "calculated" | "inferred" | "unknown"

export type RiskSeverity = "low" | "medium" | "high" | "critical"

export interface ProvenanceRef {
  sourceId: string
  url?: string
  publisher?: string
  retrievedAt?: string
  note?: string
}

export interface EvidenceValue<T = string> {
  value: T | null
  kind: EvidenceKind
  provenance?: ProvenanceRef[]
  note?: string
}

export interface IridiumObjective {
  purpose: EvidenceValue
  desiredDecision: EvidenceValue
  timeHorizon: EvidenceValue
  constraints: EvidenceValue<string[]>
}

export interface IridiumInstrument {
  physicalForm: EvidenceValue
  economicForm: EvidenceValue
  quantity: EvidenceValue<number>
  unit: EvidenceValue
  purityPercent: EvidenceValue<number>
  assayStatus: EvidenceValue
  titleStatus: EvidenceValue
  currentLocation: EvidenceValue
}

export interface IridiumCommercialTerms {
  quotedPrice: EvidenceValue<number>
  currency: EvidenceValue
  pricingBasis: EvidenceValue
  benchmark: EvidenceValue
  premiumsDiscounts: EvidenceValue<string[]>
  fees: EvidenceValue<string[]>
  paymentTerms: EvidenceValue
  quoteExpiry: EvidenceValue
}

export interface IridiumCustodyLogistics {
  custodian: EvidenceValue
  chainOfCustody: EvidenceValue
  shippingMode: EvidenceValue
  insurance: EvidenceValue
  transferOfTitle: EvidenceValue
  settlementDate: EvidenceValue
  inspectionProcess: EvidenceValue
}

export interface IridiumCounterpartyCompliance {
  counterparties: EvidenceValue<string[]>
  jurisdictions: EvidenceValue<string[]>
  kycSanctionsStatus: EvidenceValue
  responsibleSourcingDocs: EvidenceValue<string[]>
  tradeReferences: EvidenceValue<string[]>
  escalationRequired: EvidenceValue<boolean>
}

export interface IridiumIntake {
  objective: IridiumObjective
  instrument: IridiumInstrument
  commercial: IridiumCommercialTerms
  custody: IridiumCustodyLogistics
  compliance: IridiumCounterpartyCompliance
}

export interface SourceRegistryEntry {
  id: string
  title: string
  publisher: string
  url: string
  sourceClass:
    | "price-benchmark"
    | "market-report"
    | "statistical-agency"
    | "responsible-sourcing"
    | "chain-of-custody"
    | "market-context"
  trustTier: "primary" | "industry" | "secondary" | "unknown"
  refreshCadence: "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "on-demand"
  expectedFields: string[]
  extractionNotes?: string
}

export interface RedFlag {
  code: string
  severity: RiskSeverity
  trigger: string
  requiredAction: string
  evidenceKind: EvidenceKind
}

export interface AnalysisMemo {
  executiveSummary: string
  missingDetails: string[]
  redFlags: RedFlag[]
  nextDueDiligenceActions: string[]
  nonAdvisoryNotice: string
}

export const NON_ADVISORY_NOTICE =
  "This memo is factual research and risk analysis only. It does not recommend whether to buy, sell, hold, finance, hedge, or otherwise trade iridium."

export function unknownValue<T = string>(note?: string): EvidenceValue<T> {
  return { value: null, kind: "unknown", note }
}

export function providedValue<T>(value: T, note?: string): EvidenceValue<T> {
  return { value, kind: "provided", note }
}

export function observedValue<T>(value: T, provenance: ProvenanceRef[], note?: string): EvidenceValue<T> {
  return { value, kind: "observed", provenance, note }
}

export function createEmptyIridiumIntake(): IridiumIntake {
  return {
    objective: {
      purpose: unknownValue("purpose not supplied"),
      desiredDecision: unknownValue("desired decision/output not supplied"),
      timeHorizon: unknownValue("time horizon not supplied"),
      constraints: unknownValue("risk and operating constraints not supplied"),
    },
    instrument: {
      physicalForm: unknownValue("physical form not supplied"),
      economicForm: unknownValue("economic form not supplied"),
      quantity: unknownValue("quantity not supplied"),
      unit: unknownValue("quantity unit not supplied"),
      purityPercent: unknownValue("purity not supplied"),
      assayStatus: unknownValue("assay status not supplied"),
      titleStatus: unknownValue("title status not supplied"),
      currentLocation: unknownValue("location not supplied"),
    },
    commercial: {
      quotedPrice: unknownValue("quoted price not supplied"),
      currency: unknownValue("currency not supplied"),
      pricingBasis: unknownValue("pricing basis not supplied"),
      benchmark: unknownValue("benchmark/source not supplied"),
      premiumsDiscounts: unknownValue("premiums/discounts not supplied"),
      fees: unknownValue("fees not supplied"),
      paymentTerms: unknownValue("payment terms not supplied"),
      quoteExpiry: unknownValue("quote expiry not supplied"),
    },
    custody: {
      custodian: unknownValue("custodian not supplied"),
      chainOfCustody: unknownValue("chain of custody not supplied"),
      shippingMode: unknownValue("shipping mode not supplied"),
      insurance: unknownValue("insurance not supplied"),
      transferOfTitle: unknownValue("transfer of title point not supplied"),
      settlementDate: unknownValue("settlement date not supplied"),
      inspectionProcess: unknownValue("inspection process not supplied"),
    },
    compliance: {
      counterparties: unknownValue("counterparty identities not supplied"),
      jurisdictions: unknownValue("jurisdictions not supplied"),
      kycSanctionsStatus: unknownValue("KYC/sanctions status not supplied"),
      responsibleSourcingDocs: unknownValue("responsible sourcing documents not supplied"),
      tradeReferences: unknownValue("trade references not supplied"),
      escalationRequired: unknownValue("escalation status not evaluated"),
    },
  }
}

export function collectUnknownPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  if ("kind" in record && record.kind === "unknown") return [prefix || "root"]
  return Object.entries(record).flatMap(([key, child]) => collectUnknownPaths(child, prefix ? `${prefix}.${key}` : key))
}

export function buildRedFlags(intake: IridiumIntake): RedFlag[] {
  const flags: RedFlag[] = []
  const addUnknown = (path: string, action: string, severity: RiskSeverity = "high") => {
    flags.push({
      code: `unknown:${path}`,
      severity,
      trigger: `${path} is unknown`,
      requiredAction: action,
      evidenceKind: "unknown",
    })
  }

  if (intake.instrument.assayStatus.kind === "unknown") addUnknown("instrument.assayStatus", "Require independent assay evidence before settlement.", "critical")
  if (intake.instrument.titleStatus.kind === "unknown") addUnknown("instrument.titleStatus", "Verify title, allocation, liens, pledge, and transfer rights.", "critical")
  if (intake.commercial.quotedPrice.kind === "unknown") addUnknown("commercial.quotedPrice", "Collect dated quote, currency, pricing basis, and expiry.")
  if (intake.custody.chainOfCustody.kind === "unknown") addUnknown("custody.chainOfCustody", "Collect chain-of-custody and storage/custodian evidence.", "critical")
  if (intake.compliance.kycSanctionsStatus.kind === "unknown") addUnknown("compliance.kycSanctionsStatus", "Complete KYC/sanctions screening before payment or shipment.", "critical")

  return flags
}

export function buildAnalysisMemo(intake: IridiumIntake): AnalysisMemo {
  const missingDetails = collectUnknownPaths(intake)
  const redFlags = buildRedFlags(intake)
  return {
    executiveSummary: missingDetails.length === 0
      ? "All required intake fields are populated; proceed to source-grounded market and operational analysis."
      : `Intake is incomplete: ${missingDetails.length} required field(s) remain unknown. Analysis must preserve unknowns and avoid assumptions.`,
    missingDetails,
    redFlags,
    nextDueDiligenceActions: [
      "Collect missing objective, instrument, commercial, custody, and compliance details.",
      "Refresh price and market-context sources using the scraping workflow.",
      "Verify assay, title, custody, and counterparty evidence before any settlement decision.",
    ],
    nonAdvisoryNotice: NON_ADVISORY_NOTICE,
  }
}

export function renderMarkdownMemo(memo: AnalysisMemo): string {
  const missing = memo.missingDetails.map((item) => `- ${item}`).join("\n") || "- None"
  const flags = memo.redFlags.map((flag) => `- [${flag.severity}] ${flag.trigger} — ${flag.requiredAction}`).join("\n") || "- None"
  const next = memo.nextDueDiligenceActions.map((action, index) => `${index + 1}. ${action}`).join("\n")
  return [
    "# Iridium Commodity Analysis Intake Memo",
    "",
    "## Executive Summary",
    memo.executiveSummary,
    "",
    "## Missing Details",
    missing,
    "",
    "## Red Flag Register",
    flags,
    "",
    "## Next Due-Diligence Actions",
    next,
    "",
    "## Non-Advisory Notice",
    memo.nonAdvisoryNotice,
    "",
  ].join("\n")
}
