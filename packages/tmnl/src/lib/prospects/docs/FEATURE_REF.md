# Prospect Pipeline — Feature Plan Reference

## Status Key
- 🔴 Not started
- 🟡 In progress  
- 🟢 Complete

## Features

### #F946 HTTP API — REST Exposure via EntityProxyServer 🔴
| Task | Ref | Status |
|------|-----|--------|
| Define HttpApi contract with EntityProxy.toHttpApiGroup for all 5 entities | #3447 | 🔴 |
| Add workflow trigger endpoints to HttpApi (harvest, enrich, score) | #3448 | 🔴 |
| Build EntityProxyServer handler layers for all 5 entities | #3449 | 🔴 |
| Build workflow trigger handlers (harvest, enrich, score) | #3450 | 🔴 |
| Compose full HTTP server Layer: API + Swagger + CORS + Cluster + PG | #3451 | 🔴 |
| Add read-only query endpoints (search, top CIP, pipeline summary) | #3452 | 🔴 |
| Create bun run script + NX target for prospect API server | #3453 | 🔴 |

---

### #F947 CIP Scoring & Pipeline Workflows 🔴

#### #F948 CIP Scoring Workflow
| Task | Ref | Status |
|------|-----|--------|
| CIPScoringWorkflow — Workflow.make with recalculateAll Activity | #3454 | 🔴 |
| CIPSingleScoreWorkflow — score one DM on demand | #3455 | 🔴 |
| Run initial CIP scoring against all 3,392 companies in PG | #3456 | 🔴 |

#### #F949 Pipeline Stage Advancement Workflow
| Task | Ref | Status |
|------|-----|--------|
| Define stage transition rules as Effect Schema | #3457 | 🔴 |
| PipelineAdvanceWorkflow — evaluate + advance all companies | #3458 | 🔴 |
| PipelineSingleAdvanceWorkflow — evaluate one company | #3459 | 🔴 |

#### #F950 Deduplication Workflow
| Task | Ref | Status |
|------|-----|--------|
| DedupWorkflow — fuzzy name matching + merge | #3460 | 🔴 |
| Run initial dedup pass on 3,392 companies | #3461 | 🔴 |

---

### #F951 State Registry Harvest — Per-State Composed into Master 🔴

#### #F952 Per-State Harvest Workflows
| Task | Ref | Status |
|------|-----|--------|
| StateHarvestActivity — generic Activity parameterized by state config | #3462 | 🔴 |
| Add 8 remaining verified states to STATE_REGISTRY config | #3463 | 🔴 |
| StateRegistryHarvestWorkflow — one state end-to-end | #3464 | 🔴 |

#### #F953 Source-Specific Harvest Workflows
| Task | Ref | Status |
|------|-----|--------|
| EDGARHarvestWorkflow — SEC EDGAR connector as durable workflow | #3465 | 🔴 |
| USASpendingHarvestWorkflow — federal contracts as durable workflow | #3466 | 🔴 |

#### #F954 Master Harvest Orchestrator
| Task | Ref | Status |
|------|-----|--------|
| MasterHarvestWorkflow — compose all sources into single orchestration | #3467 | 🔴 |
| Schedule registration — daily/weekly cron via Effect Schedule | #3468 | 🔴 |
| Execute full MasterHarvest against all sources | #3469 | 🔴 |

---

### #F955 Enrichment Pipeline — 7 Tracks + Master 🔴

#### #F956 Track 1: Cross-Source Merge
| Task | Ref | Status |
|------|-----|--------|
| Build cross-source matcher — slug similarity + NAICS + location overlap | #3470 | 🔴 |
| Build field merge resolver — confidence-wins with provenance | #3471 | 🔴 |
| CrossSourceMergeWorkflow — Activity chain | #3472 | 🔴 |

#### #F957 Track 2: Industry Reclassification
| Task | Ref | Status |
|------|-----|--------|
| Build NAICS → Industry mapping table | #3473 | 🔴 |
| Build SIC → Industry mapping table | #3474 | 🔴 |
| Enhanced regex industry detector — NAICS-informed | #3475 | 🔴 |
| IndustryReclassWorkflow — reclassify all 'other' companies | #3476 | 🔴 |

#### #F958 Track 3: Website Discovery
| Task | Ref | Status |
|------|-----|--------|
| Domain inference engine — company name → candidate URLs | #3477 | 🔴 |
| Google CSE lookup for companies where inference fails | #3478 | 🔴 |
| WebsiteDiscoveryWorkflow — infer → CSE fallback → write | #3479 | 🔴 |

#### #F959 Track 4: Headcount & Revenue Estimation
| Task | Ref | Status |
|------|-----|--------|
| EDGAR 10-K employee count extractor | #3480 | 🔴 |
| USASpending contract-size revenue estimator | #3481 | 🔴 |
| State registry employee range extractor | #3482 | 🔴 |
| HeadcountRevenueWorkflow — multi-source estimation pipeline | #3483 | 🔴 |

#### #F960 Track 5: Signal Upgrade & Acquisition
| Task | Ref | Status |
|------|-----|--------|
| Derived signal generators — from existing data | #3484 | 🔴 |
| Contract value signal generator — weight by award amount | #3485 | 🔴 |
| Manual observation cleanup — expire or reclassify | #3486 | 🔴 |
| SignalUpgradeWorkflow — generate + cleanup + score impact | #3487 | 🔴 |

#### #F961 Track 6: Decision Maker Discovery
| Task | Ref | Status |
|------|-----|--------|
| Job posting title parser — extract DM-level roles | #3488 | 🔴 |
| State registry officer extractor — registered agents | #3489 | 🔴 |
| Agent-assisted DM research protocol for top-CIP | #3490 | 🔴 |
| DMDiscoveryWorkflow — job parse → state officers → agent | #3491 | 🔴 |

#### #F962 Master Enrichment Orchestrator
| Task | Ref | Status |
|------|-----|--------|
| MasterEnrichWorkflow — compose all 6 tracks + CIP rescore | #3492 | 🔴 |
| Execute MasterEnrich against full PG dataset | #3493 | 🔴 |

---

## Execution Order
1. **#F946** HTTP API (unblocks everything — agentic consumer needs endpoints)
2. **#F947** CIP Scoring & Pipeline Workflows (scores the data we have)
3. **#F951** State Registry Harvest (expands dataset to >10K)
4. **#F955** Enrichment Pipeline (fills gaps, upgrades quality)

## Totals
- **4** root features
- **13** sub-features
- **47** tasks
- **9** quality gates
