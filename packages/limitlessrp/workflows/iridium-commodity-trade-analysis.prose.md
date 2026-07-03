---
prose-version: 0.1
template: limitlessrp-iridium-analysis
status: draft
risk-class: market-research-not-financial-advice
commodity: iridium
package: "@gbg/limitlessrp"
---

# Iridium Commodity Detail Acquisition and Non-Advisory Analysis

## Goal

Acquire the essential factual details needed to evaluate a potential iridium commodity transaction and produce a structured market, operational, counterparty, compliance, and risk analysis. This workflow is for research and decision support only; it must not produce personalized financial, investment, legal, tax, or trading advice.

## Steps

- [intake-objective] Ask for purpose, desired output, time horizon, transaction status, and constraints. If the user does not provide an item, record it as `unknown`.
- [classify-instrument] Identify physical form, economic form, quantity, unit, purity, assay status, title status, current location, and destination.
- [collect-commercial-terms] Collect quoted price, currency, pricing basis, benchmark/source, premiums/discounts, fees, payment terms, delivery basis, and quote expiry.
- [collect-custody-logistics] Collect custodian, warehouse/refinery/vault, chain-of-custody documents, shipping mode, insurance, transfer-of-title point, settlement date, and inspection process.
- [collect-counterparty-compliance] Collect counterparty names, jurisdictions, beneficial ownership/KYC/sanctions status, responsible-sourcing documents, licenses, and trade references.
- [load-source-registry] Load `packages/limitlessrp/data/sources/iridium.sources.json` and identify which sources must be refreshed for the requested analysis.
- [dispatch-research-scrape] Run or request `workflows/iridium-research-scrape.prose.md` for current source-grounded market context when live research is authorized.
- [normalize-economics] Convert quantities/prices into comparable units. State assumptions for troy ounces, grams, kilograms, payable metal content, currency, taxes, freight, storage, and fees.
- [analyze-market-fit] Compare transaction terms against source-grounded context. Note spread, premium/discount, liquidity limitations, form constraints, and unknowns.
- [analyze-operational-risk] Assess assay, custody, logistics, settlement, title, insurance, storage, and inspection risks.
- [analyze-counterparty-risk] Assess counterparty, jurisdiction, sanctions/KYC, provenance, reputation, and documentation risks.
- [produce-red-flag-register] Create a red-flag register with severity, evidence, open question, owner, and required mitigation.
- [produce-decision-memo] Produce a concise memo with collected facts, unknowns, normalized economics, market context, risks, and next due-diligence actions. Do not recommend buy/sell/hold.

## Commands

```prose
run intake-objective
run classify-instrument
run collect-commercial-terms
run collect-custody-logistics
run collect-counterparty-compliance
run load-source-registry
run dispatch-research-scrape
run normalize-economics
run analyze-market-fit
run analyze-operational-risk
run analyze-counterparty-risk
run produce-red-flag-register
run produce-decision-memo
```

## Required Inputs

- User objective: purpose, desired decision/output, time horizon, constraints.
- Instrument: physical form, economic form, quantity/unit, purity/spec, assay, title, location.
- Commercial terms: price, currency, benchmark, premiums/discounts, fees, payment, delivery, expiry.
- Custody/logistics: chain of custody, custodian, insurance, shipping, settlement, inspection.
- Counterparty/compliance: identities, jurisdictions, KYC/sanctions, provenance, licenses, references.
- Risk controls: exposure limit, required documents, escalation owner, rejection triggers.

## Output Contract

```markdown
# Iridium Commodity Analysis Intake Memo

## Executive Summary
- Purpose:
- Transaction form:
- Quantity/spec:
- Price basis:
- Main uncertainties:
- Main red flags:

## Collected Facts
| Category | Detail | Status | Source |
|---|---|---|---|

## Missing Details
| Missing item | Why it matters | Required source/owner |
|---|---|---|

## Normalized Economics
| Component | Value | Unit | Assumption/source |
|---|---:|---|---|

## Market Context
- Pricing context:
- Liquidity/context limitations:
- Supply/demand drivers:
- Comparable quotes/benchmarks:

## Operational and Custody Risk
| Risk | Severity | Evidence | Mitigation |
|---|---|---|---|

## Counterparty and Compliance Risk
| Risk | Severity | Evidence | Mitigation |
|---|---|---|---|

## Red Flag Register
| Red flag | Severity | Trigger | Required action |
|---|---|---|---|

## Next Due-Diligence Actions
1.
2.
3.

## Non-Advisory Notice
This memo is factual research and risk analysis only. It does not recommend whether to buy, sell, hold, finance, hedge, or otherwise trade iridium.
```

## Guardrails

- Do not fabricate market prices, counterparties, availability, assay results, or documents.
- Mark unknowns explicitly; silent assumptions are forbidden.
- Separate observed, user-provided, calculated, inferred, and unknown information.
- Treat OTC quote dispersion and delivery/form constraints as analysis variables.
- Never request or expose banking credentials, private account credentials, or unrelated personal data.
- Escalate sanctions, customs, tax, legal, and regulated investment questions to qualified review.
- Do not make a trade recommendation.
