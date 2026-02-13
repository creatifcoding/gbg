# RFC-001 Section: Product Strategy — Personas, Pricing, GTM & User Journeys

```
Section:       Product Strategy
RFC:           001 — Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Status:        DRAFT (Revision 1)
Author:        product-strategist (Val)
Created:       2026-02-12
Source Data:   rfc-section-competitive-analysis.md (platform economics, commons thesis)
               rfc-section-developer-experience.md (DX.3 developer personas)
               rfc-section-marketplace-protocol.md (M.3-M.4 marketplace vision)
               rfc-section-onboarding-protocol.md (15-minute SLA)
               rfc-section-depin-token-economics.md (Section 23, reward tiers)
               rfc-section-settlement-layer.md (18.11 Sui settlement)
               rfc-section-introduction.md (commons thesis, Earl/Boeing framing)
Bibliography:  docs/specifications/bibliography.md
```

<!-- INTEGRATION NOTES (for RFC assembly)
- This section is NEW content — does not replace any existing RFC-001 section.
- Should be placed AFTER Competitive Differentiation & Industry Analysis
  and BEFORE the Developer Experience section.
- Cross-references: rfc-section-competitive-analysis.md (Section 5 platform economics,
  Section 6 onboarding SLA), rfc-section-developer-experience.md (DX.3 developer personas
  are technical; this section adds business personas), rfc-section-marketplace-protocol.md
  (M.3 two-sided market, M.4 capability discovery), rfc-section-depin-token-economics.md
  (Section 23.3 reward tiers feed into pricing model), rfc-section-settlement-layer.md
  (18.11.8 gas cost estimates feed into total cost of ownership),
  rfc-section-onboarding-protocol.md (Sections 1-8 define the experience this section
  journeys through).
- Dependencies: rfc-section-competitive-analysis.md MUST define the five universal gaps
  and commons thesis before this section references them.
  rfc-section-depin-token-economics.md MUST define $TMNL and reward tiers before this
  section references token incentives in pricing.
- Bibliography: Citation keys used here reference bibliography.md. New keys introduced:
  [MACHINEMETRICS-AWS], [TULIP-PLANS], [IGN-PRICING], [XOMETRY-10Q-2025],
  [GA-MFG-STATS-2024], [GAMEP-ABOUT], [UGA-SBDC-2025], [QUICKBOOKS-API],
  [SAP-B1], [JOBOSS-PROSHOP], [PROCORE-CRM], [NIST-MEP].
-->

---

Every IIoT platform prices for the enterprise. TMNL prices for the commons — where a 2-person machine shop and a Fortune 50 aerospace manufacturer coexist on the same network, each paying proportionally for the value they extract.

---

## Table of Contents

1. [Business Stakeholder Personas](#1-business-stakeholder-personas)
2. [User Journeys](#2-user-journeys)
3. [Pricing Model](#3-pricing-model)
4. [Go-to-Market Cold-Start Strategy](#4-go-to-market-cold-start-strategy)
5. [ERP & Accounting Integration](#5-erp--accounting-integration)
6. [Mobile & Factory-Floor UX](#6-mobile--factory-floor-ux)
7. [Competitive Positioning Matrix](#7-competitive-positioning-matrix)
8. [Codebase Grounding](#8-codebase-grounding)
9. [Risks and Mitigations](#9-risks-and-mitigations)
10. [References](#10-references)

---

## 1. Business Stakeholder Personas

The Developer Experience section (DX.3) defines four *technical* personas: Non-Developer Operator, Integration Developer, Platform Developer, and Hardware Developer. This section defines eight *business* stakeholder personas — the people who sign the check, make the purchasing decision, or consume the business outcome. These personas are complementary: Earl is both the DX.3.1 Non-Developer Operator and the PS.1.1 Shop Owner.

### PS.1.1 Shop Owner / Buyer — "Earl"

**Profile**: Earl Cobb, 58. Owner-operator of Earl's Precision Machining in Decatur, GA. 2 employees including Earl. Equipment: one 1987 Okuma LB15 lathe (RS-232 serial port, no Ethernet), one 2019 Haas VF-2 3-axis CNC mill (MTConnect-ready), one manual Bridgeport mill (zero digital interface). Annual revenue: ~$420K. No IT staff. No ERP — Earl uses a clipboard and a QuickBooks file his wife manages on Friday afternoons.

**Day in the Life**:

```
5:30 AM  — Earl opens the shop, turns on the Haas. The Okuma needs 20 minutes to warm up.
5:45 AM  — Checks the clipboard for today's work: 3 aluminum brackets for a local HVAC company,
           5 steel bushings for a repeat customer. Total: ~$1,800 in work.
6:00 AM  — Runs the Haas on the bracket job. Sets up the Okuma for bushings.
           No monitoring. No OEE. If the Okuma's bearing is going bad, Earl will hear it —
           or his part will go out of tolerance and he'll scrap it.
10:30 AM — Job finishes. Earl inspects parts with calipers and a surface plate.
           Quality record: handwritten dimensions on a yellow legal pad.
11:00 AM — Changes over to next job. 45 minutes of setup. No record of changeover time.
2:00 PM  — Slow afternoon. The Haas and Okuma are idle. Earl doesn't know how many
           hours/week his machines are idle. Neither does anyone else.
4:30 PM  — Earl quotes a job by email: eyeballs the CAD drawing, estimates material
           and time from experience, adds 30% margin. No data-driven quoting.
```

**Pain Points**:

| Pain | Severity | Current Workaround |
|------|----------|-------------------|
| No visibility into machine utilization | High | Gut feel; clipboard tracking |
| Quality records are handwritten | Medium | Yellow legal pad; will fail any aerospace audit |
| Quoting is intuition-based | High | Years of experience; sometimes loses money on complex jobs |
| Idle machine time is invisible revenue loss | High | None — Earl doesn't know what he's losing |
| Cannot accept aerospace work (no traceability) | Critical | Turns away work that requires AS9100 documentation |
| No connection to larger supply chain | High | Word-of-mouth referrals only |

**TMNL Value Proposition**:

1. **15-minute setup** — Earl plugs the edge device into his shop network. The Haas auto-discovers via MTConnect. The Okuma connects via a $12 RS-232-to-Ethernet adapter. Sensor data flows within 15 minutes (Onboarding SLA O-1).
2. **OEE without IT** — Earl sees his first OEE score the same day. He discovers his Haas runs at 47% utilization — 53% of capacity is invisible lost revenue.
3. **Digital quality records** — Sensor data creates time-stamped, immutable quality traces (event sourcing, Section G-1). Earl can now bid on aerospace subcontract work that requires traceability.
4. **Marketplace income** — When machines are idle, the commons routes overflow work from mid-size shops and enterprise buyers. Earl's idle Thursday afternoons become revenue.
5. **Quoting from data** — Actual cycle times and setup times feed into accurate quoting. Earl stops underpricing complex jobs and overpricing simple ones.

**TMNL Features Earl Uses**:

| Feature | DX Surface | Codebase Path |
|---------|-----------|---------------|
| Live OEE dashboard | Web dashboard (zero code) | `lib/iiot/entity/EquipmentStateEntity.ts` |
| Alarm acknowledgment | Single button press (mobile) | `lib/iiot/entity/AlarmEntity.ts` |
| Capacity listing (marketplace) | Toggle in dashboard settings | `lib/iiot/rpc/RealtimeRpcs.ts` |
| Digital quality records | Auto-generated from sensor data | `lib/iiot/schemas/events/` |
| QuickBooks invoice sync | Zapier/webhook integration | Extension: accounting bridge |

**Adoption Barriers**:

| Barrier | Mitigation |
|---------|-----------|
| "I'm not a computer person" | 15-minute onboarding; QR code scan; zero-code dashboard |
| "What's it cost me?" | Free tier for monitoring; marketplace revenue offsets SaaS cost within 60 days |
| "$450 for a box? I'll just listen to my machines." | 90-day hardware-included trial funded by ecosystem fund |
| "I don't want competitors seeing my data" | NATS account isolation — Earl controls what leaves his boundary [NATS-ACCOUNTS] |
| "This sounds like another subscription" | $TMNL rewards offset or eliminate monthly cost at Tier 2+ |

**Monthly Cost at Scale**: $29/mo SaaS + $20/mo blockchain + $12.50/mo hardware amortization = **$61.50/mo total**. With marketplace revenue of $400-$800/mo from idle capacity utilization and $TMNL rewards of ~$15-30/mo at Tier 2, **net cost is effectively negative** within 90 days.

---

### PS.1.2 Operations Manager — "Diana"

**Profile**: Diana Mitchell, 42. Operations Manager at Precision Metal Works in Marietta, GA. 85 employees, 3 shifts, 22 CNC machines, 4 EDM machines, 2 CMMs. Annual revenue: ~$14M. Existing systems: JobBOSS ERP (partially implemented), Renishaw CMM software, Excel for everything else. 1 IT person (part-time contractor).

**Day in the Life**:

```
6:00 AM  — Diana arrives before first shift. Checks overnight production report — it's a
           printed spreadsheet the night shift lead filled in by hand. Two machines were down
           for "unknown reasons" during third shift. Diana walks the floor to find out why.
7:00 AM  — Morning production meeting. Diana presents OEE numbers she calculated manually
           from last week's data. The numbers are 3 days old. Nobody trusts them.
8:30 AM  — A customer calls asking for delivery status on a 500-piece order. Diana walks
           to the shop floor, finds the operator, and gets a verbal estimate: "Maybe Tuesday."
           Diana tells the customer "Wednesday" and hopes.
10:00 AM — The CMM operator flags a dimension trending out of tolerance on a critical
           aerospace part. Diana finds out 2 hours after the trend started because the CMM
           data doesn't flow to any dashboard. 47 parts are now suspect.
1:00 PM  — Diana spends 2 hours in Excel building a capacity plan for next month.
           She knows 3 machines are underutilized but can't quantify it precisely.
3:00 PM  — Shift change. Diana manually reconciles job tickets from first shift.
           Two operators forgot to clock out of their jobs. Cycle time data is useless.
```

**Pain Points**:

| Pain | Severity | Current Workaround |
|------|----------|-------------------|
| OEE data is 3+ days stale | Critical | Manual calculation in Excel; nobody trusts it |
| No real-time production visibility | Critical | Walk the floor; verbal status updates |
| Quality trend detection is reactive | High | CMM operator catches it — or doesn't |
| Shift reports are handwritten | Medium | Night shift lead fills in paper form |
| Capacity planning is guesswork | High | Excel + intuition |
| Cannot prove delivery dates to customers | High | Verbal estimates with safety margin |

**TMNL Value Proposition**:

1. **Real-time OEE across all 26 machines** — Diana's morning meeting uses live data, not 3-day-old spreadsheets. EquipmentState entity streams (`lib/iiot/entity/EquipmentStateEntity.ts`) calculate OEE continuously.
2. **Reactive hierarchy cascade** — When Machine-7 faults on Line-2, Diana's dashboard updates within 100ms. Not 2 hours. Cascade propagation rules (U-1 through U-4) ensure plant-level status reflects reality.
3. **SPC integration** — CMM data feeds into the quality event stream. When Cpk drops below 1.33, an alarm entity fires before 47 parts go suspect.
4. **Automated shift reports** — Event-sourced data eliminates handwritten shift logs. Every state transition is timestamped and attributed.
5. **Data-driven delivery promises** — Actual cycle times and queue depths enable Diana to give customers delivery dates with confidence intervals, not guesses.

**Adoption Barriers**:

| Barrier | Mitigation |
|---------|-----------|
| "We already have JobBOSS" | TMNL integrates with JobBOSS via API bridge; doesn't replace ERP |
| "My operators won't learn a new system" | Operators see a wall-mounted tablet showing machine status — zero training required |
| "Our IT contractor is busy enough" | Self-service deployment; TMNL manages infrastructure |
| "I need to prove ROI to the owner" | 90-day pilot on 4 machines; quantifiable OEE improvement is the proof |

**Monthly Cost**: Professional tier — $155/mo SaaS + $155/mo blockchain + $62.50/mo hardware amortization (5 edge devices) = **$372.50/mo**. ROI: 1% OEE improvement on 26 machines × $14M revenue = ~$140K/year savings. Payback period: **<1 month**.

---

### PS.1.3 Quality Engineer — "Raj"

**Profile**: Raj Patel, 35. Quality Engineer at AeroStar Components in Kennesaw, GA. AS9100 Rev D certified. 120 employees, primarily aerospace and defense subcontracting. Equipment: 8 5-axis CNC machines, 3 CMMs (Zeiss and Hexagon), an optical comparator. Systems: QMS (Qualio), Renishaw Equator gauging, Excel for SPC.

**Day in the Life**:

```
7:00 AM  — Raj reviews yesterday's first-article inspection (FAI) reports. One part
           is 0.0003" out of nominal on a critical bore. Within tolerance, but trending.
8:00 AM  — Customer quality audit from a Tier 1 defense contractor. They want to see
           SPC charts for the last 90 days of production on a specific part number.
           Raj spends 45 minutes pulling data from the CMM software, exporting CSV,
           pasting into Excel, and formatting charts. The auditor is waiting.
10:00 AM — A machinist reports chatter on Machine-3. Raj suspects a worn tool insert
           is causing surface finish degradation. He has no vibration data to confirm
           until the next scheduled inspection.
11:30 AM — CAPA (Corrective and Preventive Action) review. Raj has 4 open CAPAs.
           Root cause analysis for each requires manually correlating machine parameters,
           operator logs, material lot numbers, and inspection data across 3 separate systems.
2:00 PM  — Raj builds a Cp/Cpk report for a customer RFQ. The customer wants proof
           that AeroStar can hold ±0.0005" on 6061-T6 aluminum. Raj's data exists
           but is scattered across CMM exports, QMS entries, and Excel files.
```

**Pain Points**:

| Pain | Severity | Current Workaround |
|------|----------|-------------------|
| SPC data scattered across 3+ systems | Critical | Manual CSV export, Excel charts; 45+ min per audit |
| No real-time process trend alerting | High | Wait for CMM inspection to discover drift |
| CAPA root cause requires manual correlation | High | Cross-reference machine logs, material certs, inspection data by hand |
| Cpk documentation for RFQs is labor-intensive | Medium | Manually assemble from historical data |
| Vibration/surface finish monitoring is periodic, not continuous | High | Scheduled inspections miss transient events |
| 21 CFR Part 11 / AS9100 audit trail gaps | Critical | Paper-based or semi-digital — auditor findings are common |

**TMNL Value Proposition**:

1. **Unified quality event stream** — CMM readings, sensor data, and machine state feed a single event-sourced timeline. When the auditor asks "show me SPC for Part X, last 90 days," Raj queries one system.
2. **Real-time SPC alerting** — Cpk drops below 1.33 → alarm entity fires → Raj's phone buzzes. Not 47 parts later.
3. **Automated CAPA correlation** — Event sourcing means every state change (tool change, material lot, operator, machine parameter) is timestamped. Root cause analysis queries a causal timeline, not three disconnected spreadsheets.
4. **Immutable audit trail** — Event-sourced entity history satisfies FDA 21 CFR Part 11 [FDA-CFR11] and AS9100 Rev D traceability requirements. The auditor sees a blockchain-anchored hash chain, not a folder of Excel files.
5. **Continuous vibration/surface finish monitoring** — Sensor entities track vibration, spindle load, and acoustic signatures continuously, not at scheduled intervals.

**Adoption Barriers**:

| Barrier | Mitigation |
|---------|-----------|
| "We're AS9100 certified — can't risk a transition" | TMNL supplements, doesn't replace QMS; additive data layer |
| "Our CMM software is closed" | Renishaw/Zeiss data export via DMIS/QIF + webhook bridge |
| "I need validation documentation" | IQ/OQ/PQ validation package included for regulated customers |

---

### PS.1.4 Maintenance Manager — "Carlos"

**Profile**: Carlos Reyes, 48. Maintenance Manager at SouthTech Industries in Norcross, GA. 200 employees, 40+ machines, 3 maintenance technicians. Systems: pen-and-paper PM schedules, a shared Excel spreadsheet for work orders, parts inventory in a filing cabinet.

**Day in the Life**:

```
5:45 AM  — Carlos checks the overnight log. Third shift operator wrote: "Machine 12
           making weird noise." No further details. No timestamp. No data.
6:30 AM  — Carlos sends a tech to Machine-12. The tech spends 30 minutes diagnosing
           with a stethoscope and a vibration pen. Bearing degradation. Estimated
           2 weeks to failure, but Carlos doesn't trust the estimate — it's a guess.
8:00 AM  — Morning meeting. Production wants to know when Machine-12 will be back to
           full capacity. Carlos says "it's fine for now" because scheduling a breakdown
           requires a PM window that isn't for 3 weeks.
10:00 AM — Carlos reviews the PM schedule (Excel, printed monthly). Machine-5 was due
           for a PM last week. It was skipped because production was behind. Carlos doesn't
           know this — the Excel wasn't updated.
1:00 PM  — Machine-5 goes down. A spindle bearing seized because the PM was missed.
           Estimated 4-day repair. Lost production: ~$18,000.
3:00 PM  — Carlos calls the bearing supplier. They don't have the part in stock.
           Lead time: 7-10 business days. The 4-day repair is now 2 weeks.
```

**Pain Points**:

| Pain | Severity | Current Workaround |
|------|----------|-------------------|
| PM schedules are manually tracked | Critical | Excel spreadsheet; frequently stale; PMs get skipped |
| No predictive maintenance capability | High | Listen, feel, guess — diagnose by stethoscope |
| Breakdown repair steals from production | Critical | Unplanned downtime averages $4,500/day per machine |
| No MTBF/MTTR tracking | Medium | Carlos knows from experience, not data |
| Spare parts inventory is undocumented | High | Filing cabinet; parts stock-out extends repair by weeks |
| Maintenance work orders are verbal | Medium | "Hey Carlos, Machine 7 sounds funny" |

**TMNL Value Proposition**:

1. **Continuous condition monitoring** — Vibration, temperature, and acoustic sensors feed SensorEntity streams. Carlos sees bearing degradation trends on a dashboard, not through a stethoscope.
2. **Predictive maintenance alerts** — When vibration RMS exceeds baseline by 2σ, an alarm entity fires with estimated time-to-failure. Carlos schedules a PM *before* the seizure, not after.
3. **MTBF/MTTR tracking** — Event-sourced equipment state history calculates MTBF and MTTR automatically. Carlos presents data at the morning meeting, not guesses.
4. **Digital maintenance work orders** — WorkOrder entity state machine manages maintenance lifecycle: request → approve → schedule → execute → verify. No more verbal requests that get forgotten.
5. **Spare parts integration** — When a bearing alert fires, the system can trigger a purchase order in the ERP or flag the spare in inventory.

**Adoption Barriers**:

| Barrier | Mitigation |
|---------|-----------|
| "We can't afford sensors on 40 machines" | Start with 5 critical machines; expand as ROI proven |
| "My techs are mechanics, not IT people" | Mobile app with single-button work order acknowledgment |
| "Predictive maintenance is snake oil" | Show vibration trend → failure correlation on first machine; let data prove it |

---

### PS.1.5 Supply Chain Buyer — "Kim" (Boeing)

**Profile**: Kim Nakamura, 39. Supply Chain Manager at Boeing's Fabrication Division in Macon, GA. Responsible for qualifying and managing 200+ suppliers for structural components. Systems: SAP Ariba for procurement, Boeing's D1-4426 quality system, supplier scorecards maintained in Excel and PowerBI.

**Day in the Life**:

```
7:00 AM  — Kim reviews the supplier dashboard. 3 of 42 active suppliers are flagged
           "at risk" based on delivery performance. The data is 2 weeks stale because
           it's pulled monthly from SAP.
8:30 AM  — An urgent requirement: 300 titanium brackets needed in 4 weeks. Normal
           supplier has a 6-week lead time. Kim needs to find a qualified alternative.
           She opens the approved supplier list — it was last updated 6 months ago.
9:30 AM  — Kim calls 5 potential suppliers. Three don't answer. One says "maybe." One
           says "yes" but Kim doesn't know their current capacity or quality history.
           She initiates a supplier qualification audit — expected completion: 8 weeks.
           The brackets are needed in 4.
11:00 AM — A delivery is late from Supplier-17. Kim doesn't know until the production
           scheduler calls her. Real-time visibility into supplier fulfillment: zero.
1:00 PM  — Kim spends 2 hours updating supplier scorecards in Excel. She collects data
           from receiving inspection reports, production feedback, and delivery logs —
           all from different systems with different formats.
3:00 PM  — Quarterly Business Review with a key supplier. Kim presents OTD (on-time
           delivery) data. The supplier disputes her numbers. Neither side has a single
           source of truth.
```

**Pain Points**:

| Pain | Severity | Current Workaround |
|------|----------|-------------------|
| Supplier capacity visibility is zero | Critical | Phone calls; "Can you take this job?" |
| Supplier qualification takes 8+ weeks | Critical | Manual audit process; misses urgent needs |
| Delivery status is invisible until late | High | Discover late deliveries when production complains |
| Supplier scorecards are manual and disputed | Medium | Excel + PowerBI; data is stale and contested |
| Alternative supplier discovery is ad hoc | High | Approved list (stale); cold calling; trade shows |
| No real-time supplier quality data | High | Inspect on receipt; quality issues discovered after delivery |

**TMNL Value Proposition**:

1. **Real-time supplier capacity visibility** — When Earl's CNC goes IDLE, that is a market signal visible to Kim's procurement dashboard. No phone calls. Equipment state → marketplace signal is the core architectural innovation (Section 4.3, Competitive Analysis).
2. **Pre-qualified supplier pool** — Suppliers on the commons have event-sourced quality histories, machine capability profiles, and verified certifications. Kim's 8-week qualification audit is reduced to a data query.
3. **Live work order tracking** — Once Kim places an order, WorkOrder entity state machine tracks progress: accepted → scheduled → in-progress → QC → shipped. Kim sees this in real-time, not after delivery.
4. **Immutable quality evidence** — Blockchain-anchored quality records mean the QBR argument about OTD numbers disappears. Both sides reference the same event-sourced timeline.
5. **Elastic manufacturing capacity** — Instead of maintaining a fixed supplier base, Kim accesses a pool of 5,000+ shops with verified capabilities. Surge capacity without new supplier qualification.

**Adoption Barriers**:

| Barrier | Mitigation |
|---------|-----------|
| "Boeing has a procurement system (SAP Ariba)" | TMNL provides a data feed INTO existing procurement; doesn't replace Ariba |
| "We need AS9100/D1-4426 compliance" | Event-sourced audit trails satisfy traceability requirements by design |
| "Our suppliers aren't on this platform" | GTM strategy seeds supply side first (Section 4); Boeing joins when supply > threshold |
| "Data sovereignty / IP concerns" | NATS account isolation; Boeing sees only what suppliers explicitly share [NATS-ACCOUNTS] |

**Monthly Cost**: Enterprise tier — custom contract based on number of supplier connections and query volume. Estimated: **$2,000-$5,000/mo** including settlement layer costs. ROI: avoiding a single supplier-related production stoppage (average cost: $100K+/incident) pays for years of the platform.

---

### PS.1.6 Insurance Underwriter — "Priya"

**Profile**: Priya Sharma, 44. Commercial Lines Underwriter at Hartford Manufacturing Insurance, Atlanta branch office. Underwrites policies for 400+ manufacturing facilities in the Southeast. Current risk assessment: annual facility inspections, 10-year loss history, OSHA records, and self-reported equipment lists.

**Day in the Life**:

```
8:00 AM  — Priya reviews a renewal application from SouthTech Industries (Carlos's shop).
           The application states "40 machines, good condition, regular maintenance."
           Priya has no way to verify this. The last facility inspection was 14 months ago.
9:30 AM  — New policy application from a 15-person shop. They claim $2M in equipment value
           and "comprehensive PM program." Priya prices based on industry averages and
           the owner's self-reported data. She knows at least 30% of applications overstate
           their maintenance practices.
11:00 AM — A claim comes in: Machine-12 at SouthTech seized a bearing and caused $18K in
           damage plus $45K in business interruption. Priya's underwriting notes say
           "equipment in good condition." There's no data to indicate the bearing was
           degrading for weeks before failure.
1:00 PM  — Priya reviews industry loss ratios. Manufacturing equipment breakdown claims
           are up 12% YoY. Premiums haven't kept pace. The portfolio is underwater.
```

**Pain Points**:

| Pain | Severity | Current Workaround |
|------|----------|-------------------|
| Risk assessment is based on self-reported, stale data | Critical | Annual inspections; trust the application |
| No real-time equipment health visibility | High | Find out about equipment condition after a claim |
| Moral hazard — insured shops skip PM | High | Cannot verify maintenance compliance |
| Premium pricing is industry-average, not risk-adjusted | Medium | All shops in a class pay the same rate |
| Loss ratios increasing without corresponding premium increases | Critical | Portfolio underperformance |

**TMNL Value Proposition**:

1. **Anonymized equipment telemetry for risk scoring** — With org consent, Priya accesses anonymized fleet intelligence: average utilization rates, PM compliance rates, equipment age distributions, vibration health scores. Risk scoring moves from "trust the application" to "verify with data."
2. **Continuous underwriting** — Instead of annual inspections, Priya sees aggregated health metrics updated in real-time. A shop that skips PMs shows declining equipment health scores before a claim occurs.
3. **Premium discounts for data sharing** — Shops that share telemetry get lower premiums because their risk is quantifiable. This creates an economic incentive to join the commons even without marketplace participation.
4. **Loss prevention** — When fleet intelligence detects a pattern (e.g., a specific spindle model showing elevated failure rates), Priya can issue preventive alerts to all policyholders with that equipment, reducing claims.

**Data Access Model**:

| Data | Visibility to Insurer | Mechanism |
|------|----------------------|-----------|
| Equipment health scores (anonymized) | Aggregate fleet view | Data license via $TMNL burn (UTL-6) |
| PM compliance rate (per-policy) | With policyholder consent | NATS export rule; policyholder controls |
| Equipment age and utilization | With policyholder consent | Part of policy application data |
| Individual machine data | Never without explicit consent | NATS account isolation enforces this |

**Monthly Cost**: Data licensing tier — $500-$2,000/mo depending on fleet size covered, paid in $TMNL burned for data access credits (UTL-6). ROI: 5% improvement in loss ratio on a $50M book = $2.5M/year.

---

### PS.1.7 Local Government Economic Development — "Marcus"

**Profile**: Marcus Williams, 51. Director of Economic Development for DeKalb County, GA. Responsible for attracting manufacturing investment, supporting existing manufacturers, and workforce development.

**Pain Points**:

| Pain | Severity |
|------|----------|
| No visibility into local manufacturing capacity | High |
| Workforce development programs not aligned with actual skills demand | Medium |
| Cannot quantify manufacturing sector health for grant applications | High |
| Losing manufacturing jobs to states with better incentive programs | Critical |

**TMNL Value Proposition**:

1. **Manufacturing census in real-time** — Aggregated (anonymized) data shows: how many shops are operating, total capacity by type, utilization rates, employment trends. This is a live economic census, not a 3-year-old survey.
2. **Workforce demand signals** — When the commons shows 5-axis CNC capacity utilization at 95%, that signals workforce training programs should produce more 5-axis operators.
3. **Grant application ammunition** — "DeKalb County hosts 1,200 connected manufacturing facilities with $380M in combined annual capacity" is more compelling than guesswork.
4. **Reshoring attraction** — The commons creates an aggregated capability profile that Marcus can present to companies considering relocating manufacturing to Georgia.

---

### PS.1.8 Georgia Tech Research Partnership — "Dr. Chen"

**Profile**: Dr. Li Chen, 47. Professor in the H. Milton Stewart School of Industrial and Systems Engineering at Georgia Tech. Research areas: smart manufacturing, digital twins, predictive maintenance. GaMEP advisory board member.

**Pain Points**:

| Pain | Severity |
|------|----------|
| Research data requires factory access agreements (6-12 months each) | Critical |
| Student projects limited to lab equipment, not real production data | High |
| No large-scale manufacturing dataset exists for Atlanta metro | High |
| Industry-academic collaboration is ad hoc and slow | Medium |

**TMNL Value Proposition**:

1. **Anonymized research dataset** — With participant consent, aggregated telemetry, OEE data, and quality metrics from 5,000+ shops create the largest metropolitan manufacturing dataset in existence. This is a publication goldmine.
2. **Student capstone projects** — Georgia Tech ISyE students work on real manufacturing optimization problems using live commons data, not simulated datasets.
3. **GaMEP integration** — GaMEP already works with 800+ Georgia manufacturers annually [GAMEP-ABOUT]. The commons provides GaMEP consultants real-time client data instead of self-reported assessments.
4. **NSF/NIST grant vehicle** — "Metropolitan-scale manufacturing commons with 200K participants" is an NSF-fundable research platform that no other university has access to.

---

## 2. User Journeys

### Journey 2.1: Earl's First Day — Unbox to First Insight

**Persona**: Earl (PS.1.1)
**Starting state**: Zero digital monitoring. Clipboard. QuickBooks.
**End state**: Live OEE dashboard on Earl's phone. First marketplace listing.

```
PHASE 1: DISCOVERY (Week -2 to Day 0)
─────────────────────────────────────

Earl hears about TMNL from his GaMEP regional manager, who mentions it
during a routine plant visit. "They have this new thing where you plug
in a little box and see how your machines are actually running. Free
for 90 days. Worth a shot."

Earl goes to tmnl.network on his phone. Sees:
  "Monitor your machines. Find new work. 15 minutes to start."

Earl taps "Get Started."


PHASE 2: ONBOARDING (T+0:00 to T+15:00) — per Onboarding SLA O-1
──────────────────────────────────────────────────────────────────

T+0:00   Earl enters: Name, email, shop name, number of machines (3).
         Single tap: "Create My Shop."

T+0:30   Account provisioned:
         ├── NATS account created [NATS-DECENTRALIZED]
         ├── Organization entity: "Earl's Precision Machining"
         └── QR code displayed on phone screen

T+1:00   Earl receives a box (pre-ordered via GaMEP, or same-day delivery
         from Atlanta hub). Inside: TMNL edge device ($450), Ethernet cable,
         quick-start card with 4 pictures.

T+2:00   Earl plugs edge device into his shop switch (next to the Haas).
         Edge device boots. Green LED.

T+3:00   Earl scans the QR code on the edge device with his phone.
         Edge device provisions itself:
         ├── Downloads NATS JWT credentials
         ├── Connects to cloud NATS leaf node
         └── Begins Sparkplug-B auto-discovery [SPARKPLUG-B]

T+5:00   Haas VF-2 auto-discovered via MTConnect.
         Dashboard shows: "CNC-1: Haas VF-2 — CONNECTED ✓"

T+6:00   Earl plugs the $12 RS-232 adapter into the Okuma.
         Adapter → edge device Ethernet.
         Dashboard shows: "Lathe-1: Okuma LB15 — CONNECTED ✓"

T+7:00   Bridgeport has no digital interface. Earl attaches a $25 current
         sensor to the power cord. When the Bridgeport is ON, the sensor
         reports power draw. Basic ON/OFF/IDLE detection.
         Dashboard shows: "Manual-1: Bridgeport — CONNECTED (basic) ✓"

T+8:00   Sensor readings flowing:
         ├── Haas: spindle speed, feed rate, spindle temp, vibration
         ├── Okuma: spindle speed, axis positions (limited by RS-232 bandwidth)
         └── Bridgeport: power ON/OFF, current draw

T+10:00  Entity hierarchy auto-created:
         Earl's Precision Machining
           ├── CNC-1 (Haas VF-2)
           │     ├── Spindle Temp
           │     └── Vibration
           ├── Lathe-1 (Okuma LB15)
           │     └── Spindle Speed
           └── Manual-1 (Bridgeport)
                 └── Power Monitor

T+12:00  Live dashboard rendering on Earl's phone.
         Earl sees machine states: CNC-1 RUNNING, Lathe-1 IDLE, Manual-1 OFF.

T+15:00  First OEE score calculated for CNC-1: 47.2%.
         Earl: "Wait, the Haas is only productive half the time?"
         That single number changes everything.


PHASE 3: FIRST WEEK
────────────────────

Day 2    Earl watches the OEE trend. Setup time between jobs averages 38
         minutes — longer than he thought. He reorganizes tool holders.
         OEE improves to 53%.

Day 3    Earl enables marketplace listing for idle capacity:
         "3-axis CNC milling, aluminum/steel, ±0.002 tolerance."
         Toggle: ON. His idle hours are now visible to the network.

Day 5    First marketplace inquiry: a mid-size shop in Roswell needs
         50 aluminum spacers. 2 hours of CNC time. Earl quotes $180.
         The job is accepted, materials arrive via courier, Earl runs
         the job, ships parts, gets paid via USDC settlement.

Day 7    Earl's dashboard shows: Revenue from marketplace this week: $180.
         Projected monthly marketplace revenue at current utilization: $720.
         TMNL subscription: $29/mo. Net: +$691/mo from previously idle time.

         Earl tells his GaMEP contact: "That box paid for itself in a week."


PHASE 4: FIRST MONTH
─────────────────────

Week 2   A vibration anomaly on the Okuma lathe triggers an alarm.
         Earl's phone buzzes: "Lathe-1: Vibration above baseline. Check
         bearing." Earl schedules a PM for Saturday. Bearing replacement
         costs $85. Unplanned seizure would have cost $3,000+ and 2 weeks.

Week 3   Earl's $TMNL rewards begin. Tier 1 (connectivity): small but
         non-zero. He's earning tokens just for having machines connected.

Week 4   A Boeing supplier qualification analyst queries the commons:
         "3-axis CNC, aluminum, AS9100 traceability." Earl's shop appears
         in results. He doesn't have AS9100 — but he has event-sourced
         quality records that demonstrate traceability. The analyst
         initiates a qualification conversation.

         Earl's world just expanded from "Decatur machine shop" to
         "node in a metropolitan manufacturing network."
```

---

### Journey 2.2: Mid-Size Shop — SCADA Integration to First Boeing Inquiry

**Persona**: Diana (PS.1.2) at Precision Metal Works
**Starting state**: JobBOSS ERP (partial), 22 CNC machines, Excel OEE reports.
**End state**: Real-time OEE, marketplace listing, first enterprise inquiry.

```
PHASE 1: EVALUATION (Weeks 1-2)
───────────────────────────────

Diana attends a Georgia Manufacturing Alliance (GMA) event where TMNL
presents a case study: "How a 20-machine shop improved OEE by 18% in
90 days." Diana's owner sees the ROI math: 1% OEE = $140K/year. He
authorizes a pilot.

TMNL deployment team (or GaMEP consultant) visits Precision Metal Works.

Assessment:
├── 22 CNC machines: 15 Haas (MTConnect), 4 DMG MORI (OPC UA), 3 older Okumas (RS-232)
├── 4 EDM machines: Makino (proprietary serial protocol)
├── 2 CMMs: Zeiss (DMIS export) and Hexagon (Q-DAS output)
├── Network: Ethernet to all CNC machines, separate VLAN from office
├── Existing: JobBOSS ERP, Renishaw probing, Excel everything

Plan:
├── Phase 1: Connect 15 Haas machines via MTConnect (same day)
├── Phase 2: Connect 4 DMG MORI via OPC UA adapter (day 2)
├── Phase 3: Connect 3 Okumas via RS-232 adapters (day 2)
├── Phase 4: EDM machines via serial protocol adapter (week 2)
├── Phase 5: CMM integration via DMIS/Q-DAS bridge (week 2)
├── Phase 6: JobBOSS API integration for work order sync (week 3)
└── Total: 5 edge devices, 3 protocol adapters, 2 CMM bridges


PHASE 2: DEPLOYMENT (Weeks 2-4)
───────────────────────────────

Week 2, Day 1:
  15 Haas machines connected in 3 hours via MTConnect auto-discovery.
  Dashboard shows 15 green tiles. OEE calculation begins immediately.

Week 2, Day 2:
  4 DMG MORI connected via OPC UA. 3 Okumas via RS-232 adapters.
  Total: 22 CNC machines streaming data.

  Diana sees real-time OEE for the first time. Plant average: 52%.
  She expected 65%. The gap is $1.82M/year in unrealized capacity.

Week 3:
  EDM machines connected. CMM data flowing via DMIS bridge.
  Quality events now correlate with machine events.

  SPC alerting enabled: When Cpk on any monitored dimension drops
  below 1.33, Raj (Quality Engineer) gets an alert within 60 seconds.

Week 4:
  JobBOSS integration live. Work orders from JobBOSS create
  WorkOrder entities in TMNL. State transitions (scheduled →
  in-progress → complete) sync bidirectionally.

  Diana's shift reports are now automated. Night shift data
  appears on Diana's dashboard by 5:45 AM — no handwriting.


PHASE 3: OPTIMIZATION (Months 2-3)
───────────────────────────────────

Month 2:
  Diana identifies the top 3 OEE losses:
  1. Setup/changeover time: 22% of available time
  2. Unplanned downtime: 14% of available time
  3. Speed loss: 8% (running below rated speed)

  Actions:
  ├── SMED analysis using TMNL changeover time data → reduce setup by 30%
  ├── Predictive maintenance alerts catch 2 bearing degradations early
  └── Speed optimization on 4 machines running 15% below rated

  OEE improves from 52% to 61% in 60 days. Value: $1.26M annualized.

Month 3:
  Diana enables marketplace listing for idle capacity:
  "3-axis CNC, 5-axis CNC, EDM, aluminum/steel/titanium, AS9100."

  The marketplace knows Precision Metal Works has 5-axis capacity
  available on second shift (utilization: 34% on 2nd shift) because
  EquipmentState entities stream real-time availability.


PHASE 4: NETWORK EFFECTS (Month 4+)
────────────────────────────────────

Month 4:
  First enterprise inquiry. Kim (Boeing supply chain) searches the
  commons: "5-axis CNC, titanium, AS9100, capacity > 200 hours/month."
  Precision Metal Works appears with:
  ├── Verified capabilities (event-sourced machine data)
  ├── Quality score: 94 (from SPC data, delivery performance)
  ├── Available capacity: 380 hours/month on 2nd shift
  └── Location: Marietta, GA (40 miles from Boeing Macon facility)

  Kim initiates qualification. Instead of an 8-week process, she
  reviews 90 days of event-sourced production data, SPC reports,
  and machine capability profiles. Qualification: 2 weeks.

  First Boeing work order: 150 titanium brackets, $47K.
  Diana's world just expanded from "22 machines in Marietta" to
  "node in Boeing's supply chain."
```

---

### Journey 2.3: Boeing Procurement — Discover to Track Fulfillment

**Persona**: Kim (PS.1.5) at Boeing Fabrication
**Starting state**: SAP Ariba procurement, stale supplier list, phone-based capacity discovery.
**End state**: Real-time supplier discovery, live work order tracking, data-driven scorecards.

```
PHASE 1: PLATFORM ONBOARDING (Week 1)
──────────────────────────────────────

Boeing's supply chain innovation team evaluates TMNL as a capacity
discovery tool. IT security reviews NATS account isolation model and
approves: Boeing's data stays in Boeing's account; supplier data is
visible only when suppliers explicitly export it [NATS-ACCOUNTS].

Enterprise tier provisioned:
├── Boeing NATS account with custom export/import rules
├── SAP Ariba webhook integration (work orders sync)
├── Custom dashboard: supplier capacity view, quality scorecard
└── API access for Boeing's internal procurement tools


PHASE 2: SUPPLIER DISCOVERY (Ongoing)
──────────────────────────────────────

Kim receives an urgent requirement: 300 titanium brackets, 4-week lead time.

Traditional approach: 5 phone calls, 3 no-answers, 8-week qualification.

TMNL approach:
  Kim queries: {
    capability: "5-axis CNC",
    material: "titanium Ti-6Al-4V",
    tolerance: "±0.001",
    capacity: "> 150 hours available in next 4 weeks",
    certifications: ["AS9100"],
    location: { within: "100 miles", of: "Macon, GA" }
  }

  Results (within 2 seconds):
  ├── Precision Metal Works (Marietta) — 380 hrs available, quality: 94
  ├── AeroStar Components (Kennesaw) — 220 hrs available, quality: 91
  ├── Elite Machine (Savannah) — 190 hrs available, quality: 88
  └── 4 more shops with partial matches

  Kim reviews quality histories (event-sourced), machine capability
  profiles (verified by sensor data), and delivery performance
  (blockchain-anchored). Qualification that previously took 8 weeks
  is now a data review.


PHASE 3: WORK ORDER & TRACKING (Per Job)
─────────────────────────────────────────

Kim selects Precision Metal Works. Work order created:
├── 300 titanium brackets, Boeing P/N 7J1-41235-001
├── Material: Ti-6Al-4V (AMS 4911)
├── Tolerance: ±0.001" per Boeing D6-54551
├── Delivery: 4 weeks, Boeing Macon receiving dock
├── Price: $156/unit = $46,800 (marketplace quote, not phone negotiation)
├── Payment: USDC escrow on Sui (18.11.1), released on delivery + QC pass

Work order state machine tracks:
  CREATED → ACCEPTED → MATERIAL_PROCURED → IN_PROGRESS → QC_PENDING →
  QC_PASSED → SHIPPED → DELIVERED → SETTLED

Kim sees each transition in real-time:
  Day 3:  Material procured (Ti-6Al-4V bar stock from supplier inventory)
  Day 5:  Production started on Machine-3 (5-axis Haas UMC-750)
  Day 8:  50% complete; SPC data shows Cpk = 1.67 (excellent)
  Day 14: 100% complete; CMM first-article inspection PASSED
  Day 16: Shipped via freight; tracking number linked to work order
  Day 18: Received at Boeing Macon; receiving inspection PASSED
  Day 19: Escrow released; $46,800 settled to Precision Metal Works


PHASE 4: SCORECARD & REPEAT (Quarterly)
────────────────────────────────────────

Quarterly Business Review is now data-driven:
├── On-Time Delivery: 97% (event-sourced; not disputed)
├── Quality: 0 defects in 300 parts (SPC data shared in real-time)
├── Capacity Reliability: 99.2% (available when promised)
└── Both sides reference the same blockchain-anchored timeline

Kim adds Precision Metal Works to her preferred supplier list.
Future orders route automatically when capacity matches.
```

---

### Journey 2.4: Insurance — Fleet Data to Premium Optimization

**Persona**: Priya (PS.1.6) at Hartford Manufacturing Insurance
**Starting state**: Annual inspections, self-reported data, industry-average pricing.
**End state**: Real-time risk scoring, continuous underwriting, premium discounts for data sharers.

```
PHASE 1: DATA LICENSING (Month 1)
──────────────────────────────────

Hartford's actuarial team evaluates TMNL's anonymized fleet intelligence:
├── 2,400 connected shops in Atlanta metro
├── Aggregated data: equipment utilization, PM compliance, alarm frequency,
│   mean time between failure (MTBF) by equipment class
├── No individual shop identification without consent
└── Data access via $TMNL token burn (UTL-6)

Hartford licenses fleet intelligence for $1,500/mo.
Data shows: shops with PM compliance > 85% have 62% fewer breakdown claims.
This is the insight Hartford has never had.


PHASE 2: PREMIUM OPTIMIZATION (Months 2-6)
───────────────────────────────────────────

Hartford introduces "Connected Shop" discount program:
  "Share your TMNL equipment health data → get up to 15% premium reduction."

Policy renewal for SouthTech Industries (Carlos's shop):
├── Current premium: $42,000/year (industry average for 40-machine shop)
├── TMNL data shows: PM compliance 91%, MTBF above industry average,
│   vibration health scores GREEN on 37/40 machines, 3 YELLOW (monitored)
├── Risk score: 23% below industry average
├── New premium: $35,700/year (15% discount)
├── Carlos saves $6,300/year — more than covers his TMNL subscription

Win-win:
  Carlos: lower insurance costs
  Hartford: better risk selection, lower loss ratio
  TMNL: another economic incentive for commons participation


PHASE 3: LOSS PREVENTION (Ongoing)
──────────────────────────────────

Fleet intelligence detects a pattern: Haas VF-2 machines with > 12,000
spindle hours show a 3.2x increase in spindle bearing failure rate.

Hartford issues preventive alert to all policyholders with Haas VF-2
machines approaching 12,000 hours: "Schedule spindle bearing inspection."

Result: 8 shops schedule preventive maintenance. Estimated 3 avoided
claims at $15K-$50K each. Hartford saves $45K-$150K. Shops avoid downtime.

This is predictive insurance powered by anonymized manufacturing commons data.
```

---

## 3. Pricing Model

### 3.1 Design Principles

The TMNL pricing model is designed under five constraints:

| Principle | Rationale |
|-----------|-----------|
| **Earl must be able to afford it** | If the smallest participant can't participate, the commons fails. Target: <$100/mo all-in. |
| **Price must be justified by ROI at every tier** | No faith-based purchasing. Each tier must demonstrate measurable value > cost. |
| **Network contributions reduce cost** | Token rewards (Section 23.3) offset SaaS cost. Active participants can reach net-zero. |
| **Enterprise buyers pay for value extracted** | Boeing extracts more value (supplier discovery, quality verification) and pays accordingly. |
| **Total cost = SaaS + blockchain + hardware amortization** | No hidden costs. Hardware is a one-time purchase amortized over 36 months. |

### 3.2 Competitive Pricing Landscape

Before defining TMNL pricing, we ground it in the actual market:

| Platform | Target Customer | Pricing Model | Estimated Monthly Cost | Source |
|----------|----------------|---------------|----------------------|--------|
| **MachineMetrics** | Mid-large manufacturers | Per-machine SaaS; custom quote | $150-$300/machine/mo (estimated) | [MACHINEMETRICS-AWS] |
| **Sight Machine** | Enterprise (Global 500) | Enterprise license; custom | $10K-$50K+/mo (estimated) | Industry analyst reports |
| **Tulip** | Mid-large; pharma/aero | Per-operator licensing | $50-$150/operator/mo (estimated) | [TULIP-PLANS] |
| **Ignition** | Mid-enterprise | Gateway license (perpetual) + annual maintenance | $5K-$30K one-time + 20% annual | [IGN-PRICING] |
| **Plex (Rockwell)** | Mid-enterprise | Cloud ERP + MES SaaS | $5K-$20K+/mo | [RA-PLEX] |
| **Xometry** | Marketplace buyers/sellers | Transaction fee (margin on jobs) | ~35% take rate on transactions | [XOMETRY-10Q-2025] |
| **AWS IoT SiteWise** | Enterprise (build-your-own) | Consumption-based | $500-$5K+/mo depending on scale | [AWS-SITEWISE] |
| **TMNL** | 2-person shop → enterprise | Tiered SaaS + blockchain + hardware | **$29-$2,212/mo** (see below) | This section |

**Key insight**: No existing platform prices for Earl. MachineMetrics at $150/machine/mo × 3 machines = $450/mo — more than Earl's weekly profit margin. Ignition's $5K gateway license is a non-starter. Tulip, Sight Machine, and Plex don't even have a small-shop offering. The market has a structural pricing gap below $100/month.

### 3.3 TMNL Tiered Pricing

#### Tier 1: Starter ("Earl's Tier")

**Target**: 1-10 machines, 1-5 employees, no IT staff.

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| SaaS subscription | $29/mo | Monitoring, OEE, alarms, basic dashboard |
| Blockchain settlement | $20/mo | Per Section 18.11.8 gas cost estimates |
| Hardware amortization | $12.50/mo | $450 edge device / 36 months |
| **Total** | **$61.50/mo** | |

**What's included**:
- Up to 10 machine connections
- Real-time OEE dashboard (web + mobile)
- Alarm management (acknowledge, escalate)
- Basic equipment state monitoring
- Event-sourced data retention (90 days)
- Marketplace listing (opt-in)
- $TMNL Tier 1 rewards (~$5-15/mo)

**What's NOT included**:
- SPC/quality integration
- ERP integration
- Custom dashboards
- Extended data retention
- API access

**ROI justification**:

| Value Driver | Conservative Estimate |
|-------------|----------------------|
| 1% OEE improvement on 3 machines × $420K revenue | $4,200/year |
| One avoided unplanned breakdown per year | $3,000-$5,000 |
| Marketplace revenue from idle capacity (10 hrs/mo × $50/hr) | $6,000/year |
| $TMNL rewards at Tier 1-2 | $60-$360/year |
| **Total annual value** | **$13,260-$15,560** |
| **Annual cost** | **$738** |
| **ROI** | **18-21x** |
| **Payback period** | **< 30 days** |

#### Tier 2: Professional ("Diana's Tier")

**Target**: 10-100 machines, 20-500 employees, part-time IT support.

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| SaaS subscription | $155/mo | Full monitoring + quality + ERP integration |
| Blockchain settlement | $155/mo | Per Section 18.11.8 |
| Hardware amortization | $62.50/mo | 5 edge devices × $450 / 36 months |
| **Total** | **$372.50/mo** | |

**What's included (Starter +)**:
- Up to 100 machine connections
- SPC integration (CMM data bridge)
- ERP integration (JobBOSS, ProShop, Epicor)
- Custom dashboards and shift reports
- Predictive maintenance alerting
- Event-sourced data retention (1 year)
- Full marketplace participation
- API access (Promise-based client)
- $TMNL Tier 2-3 rewards (~$30-100/mo)

**ROI justification**:

| Value Driver | Conservative Estimate |
|-------------|----------------------|
| 5% OEE improvement on 22 machines × $14M revenue | $700,000/year |
| 2 avoided unplanned breakdowns per year | $36,000 |
| Reduced quality escapes (SPC alerting) | $50,000/year |
| Marketplace revenue from 2nd shift capacity | $120,000/year |
| $TMNL rewards at Tier 2-3 | $360-$1,200/year |
| **Total annual value** | **$906,360-$907,200** |
| **Annual cost** | **$4,470** |
| **ROI** | **~200x** |
| **Payback period** | **< 3 days** |

#### Tier 3: Enterprise ("Boeing's Tier")

**Target**: 100+ machines or enterprise buyer (supply chain visibility).

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| SaaS subscription | $800-$2,000/mo | Custom contract; supplier discovery, quality verification |
| Blockchain settlement | $2,212/mo | Per Section 18.11.8 (high transaction volume) |
| Hardware amortization | Variable | Enterprise deploys own edge infrastructure or uses existing |
| **Total** | **$3,012-$4,212/mo** | |

**What's included (Professional +)**:
- Unlimited machine connections
- Supplier discovery and qualification
- Real-time supply chain visibility
- Custom integrations (SAP, Ariba, Oracle)
- Blockchain-anchored audit trails
- Event-sourced data retention (unlimited)
- Full API access (Effect-native + Promise)
- White-label dashboard options
- Dedicated support
- $TMNL Tier 3-4 rewards (volume-dependent)

**ROI justification (demand-side buyer)**:

| Value Driver | Conservative Estimate |
|-------------|----------------------|
| Avoid 1 supplier-related production stoppage | $100,000+ per incident |
| Reduce supplier qualification time by 80% | $200,000/year in labor |
| Improve on-time delivery through visibility | $500,000/year (reduced expediting) |
| **Total annual value** | **$800,000+** |
| **Annual cost** | **$36,144-$50,544** |
| **ROI** | **16-22x** |

#### Tier 4: Data Licensing ("Priya's Tier")

**Target**: Insurance, finance, government, research institutions.

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Data access license | $500-$5,000/mo | Anonymized fleet intelligence |
| $TMNL token burn | Included in license | Data access requires token burn (UTL-6) |
| **Total** | **$500-$5,000/mo** | |

### 3.4 Pricing Summary Table

| Tier | Name | Target | Machines | Monthly Cost | Blockchain | Hardware (amort.) | Total/mo |
|------|------|--------|----------|-------------|-----------|-------------------|----------|
| 1 | Starter | Earl | 1-10 | $29 | $20 | $12.50 | **$61.50** |
| 2 | Professional | Diana | 10-100 | $155 | $155 | $62.50 | **$372.50** |
| 3 | Enterprise | Boeing | 100+ / buyer | $800-$2,000 | $2,212 | Variable | **$3,012-$4,212** |
| 4 | Data License | Priya | N/A | $500-$5,000 | Included | N/A | **$500-$5,000** |

### 3.5 Token Offset Economics

$TMNL reward tiers (Section 23.3) create a path to net-zero cost for active participants:

| Reward Tier | Contribution Level | Estimated Monthly Reward | Offset vs. Starter |
|-------------|-------------------|------------------------|-------------------|
| Tier 1: Connectivity | Edge connected, heartbeat active | $5-$15 | 8-24% |
| Tier 2: Data Contribution | OEE shared, uptime > 90% | $30-$60 | 49-97% |
| Tier 3: Marketplace | Capacity listed, 1+ work order/quarter | $75-$150 | 122-244% (net positive) |
| Tier 4: Quality Verification | SPC shared, uptime > 97%, quality > 85 | $150-$300 | 244-488% (net positive) |

**Key insight**: A shop at Reward Tier 3 or above earns more in $TMNL rewards than their Starter SaaS subscription costs. **The commons literally pays shops to participate** once they contribute meaningfully.

### 3.6 Free Tier Consideration

A permanently free tier is **not recommended** because:

1. It creates a population of extractors who consume network resources without contributing data
2. Blockchain gas costs ($20/mo minimum) create a real marginal cost per participant
3. The Starter tier at $29/mo is already below any competing platform by 5-10x

However, the following are **recommended**:

| Program | Duration | Mechanism |
|---------|----------|-----------|
| 90-day hardware-included trial | One-time | Ecosystem fund subsidizes edge device + 90 days SaaS |
| GaMEP partnership discount | Permanent | 50% discount for first year via GaMEP referral |
| Early Adopter token grant | First 1,000 shops | $TMNL token allocation (Section 23.2.5) offsets 24 months of cost |

---

## 4. Go-to-Market Cold-Start Strategy

### 4.1 The Cold-Start Problem

The manufacturing commons is a two-sided marketplace. Before Boeing will query for suppliers, suppliers must be connected. Before suppliers invest in an edge device, they need to see demand. This is the classic chicken-and-egg problem [PARKER-PLATFORM].

**Resolution strategy**: Solve the supply side first using standalone value (Phase 1), then activate the demand side.

### 4.2 Phase 1: First 100 Organizations (Months 1-6)

**Objective**: 100 connected shops in Atlanta metro, generating standalone value (OEE, monitoring) before marketplace activates.

#### Channel 1: GaMEP Partnership

GaMEP works with 800+ Georgia manufacturers annually [GAMEP-ABOUT]. It operates from 10 regional offices across the state, including Metro Atlanta.

| Action | Detail |
|--------|--------|
| **Partnership structure** | TMNL becomes a recommended technology partner in GaMEP's Industry 4.0 advisory program |
| **GaMEP consultant training** | Train 15 GaMEP regional managers on TMNL deployment (2-day program) |
| **Joint plant visits** | GaMEP consultants introduce TMNL during routine manufacturing assessments |
| **Co-funded pilot** | GaMEP + TMNL co-fund 25 free pilot deployments (edge device + 90 days SaaS) |
| **Target conversion** | 25 pilots → 20 paid subscribers (80% conversion based on ROI) |
| **Expected reach** | 50-100 referrals in 6 months from GaMEP's existing client base |

**Why GaMEP?**: GaMEP is the only organization in Georgia with trusted, on-the-ground relationships with hundreds of small manufacturers. Earl will not respond to a cold email from a technology startup. Earl WILL listen to his GaMEP consultant who has helped him with lean manufacturing for 3 years.

#### Channel 2: Georgia Manufacturing Alliance (GMA)

GMA is a membership organization connecting Georgia manufacturers through plant tours, networking events, and workforce development programs.

| Action | Detail |
|--------|--------|
| **Sponsor membership** | TMNL sponsors GMA events; presents at quarterly meetings |
| **Case study presentation** | After first 10 deployments, present ROI case study at GMA event |
| **Peer referral program** | Connected shops earn $TMNL bonus for referring other shops |
| **Manufacturing Day** | Deploy 10 live demos during National Manufacturing Day (October) |
| **Expected reach** | 30-50 referrals in 6 months |

#### Channel 3: Direct Outreach — Machine Tool Distributors

Machine tool distributors (Haas Factory Outlet, Okuma dealers) sell to the exact shops TMNL targets. They make recurring revenue from service contracts and want their customers to succeed.

| Action | Detail |
|--------|--------|
| **Haas Factory Outlet (Atlanta)** | Bundle TMNL edge device with new Haas machine purchases |
| **Okuma / DMG MORI distributors** | Referral program: distributor earns $50/connected machine |
| **Value to distributor** | TMNL monitoring data helps distributors offer proactive service contracts |
| **Expected reach** | 20-30 referrals in 6 months |

#### Channel 4: Georgia Tech / UGA SBDC

Georgia's universities provide research credibility and student workforce.

| Action | Detail |
|--------|--------|
| **Georgia Tech ISyE partnership** | Dr. Chen's lab deploys TMNL in 3 partner manufacturing facilities for research |
| **Student capstone program** | ISyE seniors conduct OEE optimization projects at connected shops |
| **UGA SBDC referrals** | SBDC business consultants recommend TMNL to manufacturing clients |
| **Expected reach** | 10-20 referrals in 6 months from academic partnerships |

#### Phase 1 Milestone: First 100 Organizations

| Metric | Target | Timeline |
|--------|--------|----------|
| Connected organizations | 100 | Month 6 |
| Total connected machines | 500-800 | Month 6 |
| Average OEE improvement | 5-10% | Month 6 |
| Marketplace listings (opt-in) | 40+ | Month 6 |
| Monthly revenue (SaaS) | $5K-$10K | Month 6 |
| NPS score | > 50 | Month 6 |

### 4.3 Phase 2: First Enterprise Buyer (Months 4-9)

**Objective**: Onboard 1 enterprise buyer (Boeing, Lockheed Martin, Gulfstream) who generates demand-side marketplace activity.

**Why Boeing?**: Boeing's Macon, GA fabrication facility is within 80 miles of most Atlanta metro machine shops. Boeing routinely subcontracts structural components to local shops. Boeing has documented supply chain challenges (delivery delays, supplier qualification backlogs). Boeing's scale provides sufficient demand to activate the marketplace.

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Build supply base: 100+ connected shops with verified capabilities | Month 6 |
| 2 | Identify Boeing supply chain innovation contact (LinkedIn, GMA network) | Month 4 |
| 3 | Present: "100 pre-qualified Atlanta-area suppliers with real-time capacity data" | Month 5 |
| 4 | Pilot: Boeing queries commons for 3 urgent procurement needs | Month 6-7 |
| 5 | First work order through marketplace escrow | Month 7-8 |
| 6 | Expand: Boeing adds TMNL as approved supplier discovery channel | Month 9 |

**Critical dependency**: Supply side must reach ~100 shops with verified capabilities BEFORE approaching Boeing. An empty marketplace is worse than no marketplace.

### 4.4 Phase 3: Network Effects (Months 9-18)

**Objective**: Cross the critical mass threshold where network effects become self-sustaining.

| Metric | Threshold | Effect |
|--------|-----------|--------|
| Connected shops | 500+ | Sufficient coverage across common capabilities |
| Marketplace transactions | 50+/month | Liquidity attracts more buyers |
| Enterprise buyers | 3-5 | Demand validates supply-side investment |
| Capability coverage | 80% of common operations | Buyers can consistently find what they need |

**Network effect flywheel**:

```
More suppliers connected
    → More capabilities visible to buyers
        → More enterprise buyers query the marketplace
            → More work orders flow to suppliers
                → More suppliers see marketplace revenue
                    → More suppliers connect their machines
                        → (cycle reinforces)
```

**Helium lesson** (from Section 23.1.4): Supply-side incentives alone produce deployed-but-unused infrastructure. TMNL avoids this by ensuring Phase 1 value (monitoring, OEE) exists independently of marketplace demand. Earl's ROI at N=1 is already 18-21x. The marketplace is upside, not the justification.

### 4.5 Phase 4: Metropolitan Scale (Months 18-36)

**Objective**: 1,000+ connected organizations, active marketplace, insurance/finance data licensing, and expansion planning.

| Milestone | Target | Timeline |
|-----------|--------|----------|
| Connected organizations | 1,000 | Month 18 |
| Connected organizations | 5,000 | Month 30 |
| Monthly marketplace GMV | $500K | Month 18 |
| Monthly marketplace GMV | $5M | Month 30 |
| Data licensing customers | 5+ | Month 24 |
| Second metro area evaluation | Begin | Month 24 |
| Token generation event (TGE) | Evaluate | Month 18-24 |

### 4.6 GTM Timeline Summary

```
Month 1-2:   GaMEP training, first 10 pilot deployments
Month 3-4:   25 pilots active; first GMA case study presentation
Month 5-6:   100 connected shops; begin Boeing outreach
Month 7-8:   First Boeing pilot query; first marketplace transaction
Month 9-12:  500 shops; 3-5 enterprise buyers; marketplace achieving liquidity
Month 12-18: 1,000 shops; self-sustaining network effects; insurance data pilots
Month 18-24: 2,500+ shops; TGE evaluation; second metro area scoping
Month 24-36: 5,000+ shops; $5M+/mo GMV; Atlanta is the proof-of-concept city
```

---

## 5. ERP & Accounting Integration

### 5.1 The Integration Landscape

Every persona uses a different accounting/ERP system. TMNL must integrate with all of them — not by replacing them, but by synchronizing work order state and financial transactions.

| Persona | ERP/Accounting System | Integration Priority |
|---------|-----------------------|---------------------|
| Earl (Starter) | QuickBooks Online | P1 — highest volume of users |
| Diana (Professional) | JobBOSS / ProShop / Epicor | P1 — mid-market sweet spot |
| Carlos (Professional) | Same as Diana's shop | Covered by Diana's integration |
| Kim (Enterprise) | SAP S/4HANA + SAP Ariba | P2 — enterprise buyer |
| Raj (Professional) | Qualio (QMS), separate from ERP | P2 — quality system integration |

### 5.2 Work Order → Invoice Flow

When a marketplace work order settles on Sui (Section 18.11), the settlement event must become a financial record in the seller's accounting system.

```
TMNL Work Order State Machine          Accounting System
──────────────────────────────          ──────────────────

  CREATED                               (no entry yet)
       │
  ACCEPTED                              (no entry yet)
       │
  IN_PROGRESS                           (no entry yet)
       │
  QC_PASSED                             (no entry yet)
       │
  SHIPPED                               Create INVOICE (draft)
       │                                ├── Line items from work order
  DELIVERED                             │   (quantity, unit price, material)
       │                                ├── Marketplace fee deducted
  SETTLED (on Sui)                      │── Mark invoice PAID
       │                                └── Record payment (USDC → USD
  COMPLETE                                   via off-ramp, or bank transfer)
```

### 5.3 QuickBooks Integration (Earl's Path)

**Mechanism**: Webhook → Zapier / Make.com → QuickBooks Online API [QUICKBOOKS-API]

| Event | QuickBooks Action |
|-------|-------------------|
| Work order SHIPPED | Create Invoice (draft) |
| Escrow SETTLED | Mark Invoice as Paid; record payment |
| Monthly SaaS billing | Create recurring expense |
| $TMNL reward received | Record as "Other Income" |

**Zero-code path**: Earl connects QuickBooks via OAuth during onboarding. A toggle: "Auto-create invoices from marketplace orders." Done. Earl's wife sees marketplace invoices appear in QuickBooks on Friday afternoons.

### 5.4 JobBOSS / ProShop Integration (Diana's Path)

**Mechanism**: Bidirectional REST API bridge

| Direction | Data Flow |
|-----------|-----------|
| JobBOSS → TMNL | Work orders, job schedules, material requirements |
| TMNL → JobBOSS | Machine state (actual vs. scheduled), cycle times, OEE data |
| TMNL → JobBOSS | Marketplace work orders appear as new jobs |
| TMNL → JobBOSS | Settlement confirmation updates job costing |

**Key requirement**: Diana does NOT want to leave JobBOSS. She wants TMNL data to flow INTO JobBOSS so her existing workflows (scheduling, costing, shipping) continue unchanged with better data.

### 5.5 SAP Integration (Boeing's Path)

**Mechanism**: SAP RFC/BAPI + Ariba cXML integration

| Direction | Data Flow |
|-----------|-----------|
| SAP Ariba → TMNL | Purchase orders, RFQs |
| TMNL → SAP Ariba | Supplier capability profiles, capacity data |
| TMNL → SAP S/4 | Goods receipt confirmation (from work order DELIVERED) |
| TMNL → SAP S/4 | Quality inspection results (from event-sourced quality data) |

### 5.6 CSV Export Fallback

For organizations that cannot or will not use API integration:

| Export | Format | Frequency |
|--------|--------|-----------|
| Work order history | CSV | On-demand or daily email |
| Machine OEE summary | CSV | Weekly automated email |
| Financial transactions | CSV (QuickBooks import format) | On settlement |
| Quality records | CSV + PDF report | On-demand |

---

## 6. Mobile & Factory-Floor UX

### 6.1 The Factory-Floor Reality

A manufacturing floor is NOT an office environment. UX design for the factory floor must account for:

| Constraint | Impact on UX |
|-----------|-------------|
| **Gloves** — operators wear nitrile, leather, or cut-resistant gloves | Touch targets MUST be ≥ 48px × 48px. Swipe gestures unreliable. Prefer tap. |
| **Noise** — 85-110 dB ambient. Hearing protection required. | Audio alerts useless. Use visual (flashing) + haptic (vibration). |
| **Lighting** — fluorescent overhead + task lighting. Glare on screens. | High-contrast UI. No subtle grays. White text on dark background. |
| **Grease/coolant** — screens get coated with cutting fluid | Oleophobic screen film. Capacitive touch that works through thin fluid layer. |
| **Vibration** — machines create constant floor vibration | Mounts must be anti-vibration. No precision touch requirements. |
| **Urgency** — when an alarm fires, operator has 5 seconds to decide | Critical actions: ONE TAP. No confirmation dialogs during alarm response. |

### 6.2 Device Matrix

| Device | Where | Who | Primary Use |
|--------|-------|-----|-------------|
| **Smartphone** (personal) | Pocket / belt clip | Earl, operators | Alarm notification, quick OEE glance, marketplace management |
| **Wall-mounted tablet** (10.1" rugged) | Next to machine or at cell entrance | Diana's operators, Carlos's techs | Machine status, shift dashboard, work order progress |
| **Ruggedized handheld** (Zebra/Honeywell) | Belt holster | Quality inspectors, maintenance techs | Inspection recording, maintenance work orders, barcode scanning |
| **Desktop** (office) | Office | Diana, Raj, Kim | Full dashboards, SPC analysis, reporting, marketplace management |

### 6.3 UI Requirements by Persona

#### Earl (Smartphone)

| Screen | Actions | Design Requirements |
|--------|---------|-------------------|
| **Home** | See machine states (3 machines) | 3 large status tiles: GREEN/YELLOW/RED. Readable at arm's length. |
| **Alarm** | Acknowledge alarm | SINGLE TAP on alarm tile. No confirmation dialog. Timer shows time-to-acknowledge. |
| **OEE** | View daily/weekly OEE | Large number (72pt). Trend arrow. Color: green > 75%, yellow 50-75%, red < 50%. |
| **Marketplace** | Toggle availability ON/OFF | Single toggle per machine. "Your CNC-1 is listed as AVAILABLE." |

**Typography enforcement**: All text ≥ 16px on mobile. Status indicators ≥ 24px. Critical numbers ≥ 48px. Minimum font: `var(--tmnl-text-base, 16px)`. No exceptions.

#### Diana's Operators (Wall Tablet)

| Screen | Actions | Design Requirements |
|--------|---------|-------------------|
| **Cell Overview** | See status of 4-6 machines in a cell | Grid of status tiles. Each tile: machine name, state, current job, time remaining. |
| **Alarm Banner** | See and acknowledge active alarms | Full-width red banner at top. Tap to acknowledge. Auto-dismiss after 30 seconds if acknowledged. |
| **Job Progress** | See current job completion % | Progress bar with part count: "127 / 200 parts complete." |
| **Shift Summary** | Review shift OEE, downtime reasons | Bar chart: OEE by hour. Tap bar to see downtime reason. |

**Interaction model**: Operators do NOT navigate menus. The tablet shows one screen per cell. Swipe left/right to switch between Overview and Shift Summary. That's it. No hamburger menus. No settings. No login — the tablet is authenticated by its physical location.

#### Carlos's Maintenance Techs (Ruggedized Handheld)

| Screen | Actions | Design Requirements |
|--------|---------|-------------------|
| **Work Order List** | See assigned maintenance work orders | List sorted by priority. Tap to open. Swipe to acknowledge. |
| **Work Order Detail** | View instructions, log actions | Large text. Photo upload for documentation. Barcode scan for parts used. |
| **Equipment Health** | View vibration/temperature trends | Sparkline chart with threshold lines. Green/Yellow/Red zones. |

### 6.4 Single-Button Alarm Acknowledgment

**Scenario**: Machine-7 on Line-2 enters FAULT state due to a tool breakage alarm.

```
T+0.0s    EquipmentState entity transitions to FAULT
          Alarm entity created: Tool Breakage on Machine-7

T+0.1s    Reactive cascade: Line-2 status updates to DEGRADED
          Plant status remains RUNNING (other lines unaffected)

T+0.5s    Diana's wall tablet on Line-2 shows RED BANNER:
          ┌──────────────────────────────────────────────────┐
          │  ⚠ ALARM: Machine-7 — Tool Breakage              │
          │                                                    │
          │          [ ACKNOWLEDGE ]                           │
          │                                                    │
          │  Time since alarm: 0:00:05                         │
          └──────────────────────────────────────────────────┘

T+1.0s    Operator taps ACKNOWLEDGE (48px × 48px button, high contrast)
          ├── No confirmation dialog
          ├── Alarm entity transitions: ACTIVE → ACKNOWLEDGED
          ├── Banner changes: RED → YELLOW ("Acknowledged, awaiting clear")
          └── Event logged: operator ID, timestamp, acknowledge method

T+?       Operator clears the tool, resets the machine
          Machine-7 returns to IDLE → operator starts next cycle → RUNNING
          ├── Alarm entity transitions: ACKNOWLEDGED → CLEARED
          ├── Banner disappears
          └── Line-2 status returns to RUNNING
```

**Design rules for alarm UX**:

| Rule | Rationale |
|------|-----------|
| Single tap to acknowledge — NO confirmation dialog | Confirmation dialogs kill response time. The physical action of tapping IS the confirmation. |
| Button ≥ 48px × 48px | Gloved fingers need large targets |
| High contrast: white text on red background | Visible under any lighting condition |
| Timer visible: "Time since alarm: 0:00:15" | Creates urgency; feeds into alarm response KPI |
| No login required on factory-floor devices | Factory devices authenticate by physical location + device certificate |

---

## 7. Competitive Positioning Matrix

### 7.1 Feature Comparison

| Feature | TMNL | MachineMetrics | Sight Machine | Tulip | Ignition | Plex | Xometry |
|---------|------|---------------|--------------|-------|----------|------|---------|
| **Smallest customer** | 1-person shop | 20+ machine plants | Global 500 only | Mid-enterprise | Mid-enterprise | Mid-enterprise | Any (buyer/seller) |
| **Monthly cost (small shop)** | $61.50 | $450+/mo (est.) | N/A | N/A | $5K+ one-time | N/A | Transaction fee |
| **Onboarding time** | 15 minutes | Hours-days | Weeks-months | Days-weeks | 1-4 weeks | Weeks-months | Minutes (buyer) |
| **Real-time OEE** | Yes (streaming) | Yes | Yes | Limited | Via modules | Yes | No |
| **Event sourcing** | Yes (3 entity types) | No | No | No | No | No | No |
| **SPC integration** | Yes (CMM bridge) | Limited | Yes | Yes | Via modules | Limited | No |
| **Predictive maintenance** | Yes (vibration) | Yes | Yes | No | Via third-party | No | No |
| **Multi-org marketplace** | Yes (core feature) | No | No | No | No | No | Yes (centralized) |
| **Blockchain settlement** | Yes (Sui escrow) | No | No | No | No | No | No |
| **Data sovereignty** | NATS account isolation | Vendor cloud | Vendor cloud | Vendor cloud | Self-hosted option | Vendor cloud | Vendor cloud |
| **Network effects** | Yes (Metcalfe's Law) | No | No | No | No | No | Limited |
| **Token rewards** | Yes ($TMNL DePIN) | No | No | No | No | No | No |
| **ISA-95 hierarchy** | Telescoping (1-8 levels) | Flat | Limited | Flat | Configurable | ISA-95 aware | N/A |
| **Open protocols** | NATS, MQTT, Sparkplug-B, OPC UA | MTConnect + proprietary | Proprietary | Proprietary | OPC UA + MQTT | Proprietary | REST API |

### 7.2 Pricing Comparison

| Platform | Small Shop (3 machines) | Mid-Size (25 machines) | Enterprise (100+ machines) | Notes |
|----------|----------------------|----------------------|--------------------------|-------|
| **TMNL** | $61.50/mo | $372.50/mo | $3,012-$4,212/mo | Includes blockchain + hardware amortization |
| **MachineMetrics** | $450-$900/mo (est.) | $3,750-$7,500/mo (est.) | Custom | Per-machine pricing; custom quotes only |
| **Sight Machine** | Not available | Not available | $10,000-$50,000+/mo | Enterprise only |
| **Tulip** | Not available | $1,250-$7,500/mo (est.) | Custom | Per-operator; requires Tulip hardware |
| **Ignition** | $5,000+ one-time | $10,000-$30,000 one-time | $30,000+ one-time | + 20% annual maintenance |
| **Plex** | Not available | $5,000-$20,000/mo | Custom | Full cloud ERP+MES |
| **Xometry** | Free (marketplace) | N/A | N/A | ~35% margin on transactions |

### 7.3 Deployment Model Comparison

| Dimension | TMNL | Incumbents | Xometry |
|-----------|------|-----------|---------|
| **Who deploys** | Self-service (Earl) or lightweight assist (Diana) | Systems integrator ($50K-$200K engagement) | No deployment (web platform) |
| **Hardware** | $450 edge device + commodity sensors | Proprietary gateway ($5K-$50K) | None |
| **Cloud model** | Federated (NATS per-org accounts) | Centralized vendor cloud | Centralized vendor cloud |
| **Data ownership** | Organization owns; NATS account isolation | Vendor controls | Vendor controls |
| **Multi-org** | Native (commons model) | Not designed for multi-org | Yes (marketplace only) |
| **Offline capability** | NATS leaf node operates locally | Varies; most require connectivity | N/A (web-only) |

### 7.4 The Positioning Statement

> TMNL is the only IIoT platform where a 2-person machine shop and a Fortune 50 aerospace manufacturer participate as peers in a federated manufacturing network — with equipment monitoring at every scale, real-time marketplace matching, blockchain-secured settlement, and data sovereignty by design.

**Versus each competitor**:

| Competitor | TMNL Differentiator |
|-----------|-------------------|
| MachineMetrics | TMNL serves shops 10x smaller at 7x lower cost, with marketplace and network effects MachineMetrics cannot offer |
| Sight Machine | TMNL democratizes manufacturing analytics for the 98% of manufacturers Sight Machine cannot serve |
| Tulip | TMNL provides real-time equipment monitoring and cross-org marketplace; Tulip is a no-code MES without network effects |
| Ignition | TMNL is a commons, not a gateway. Ignition is self-hosted monitoring; TMNL is a manufacturing operating system with DePIN economics |
| Plex | TMNL does not replace ERP — it provides the real-time data layer and marketplace that Plex lacks |
| Xometry | TMNL matches based on real-time equipment state, not manual capacity declaration. TMNL charges 5%, not 35%. TMNL provides monitoring value even without marketplace participation. |

---

## 8. Codebase Grounding

This section identifies which existing codebase paths implement or will implement the product strategy capabilities described above. File paths are relative to `packages/tmnl/src/`.

| Product Capability | Codebase Path | Status |
|-------------------|---------------|--------|
| Equipment state monitoring (all personas) | `lib/iiot/entity/EquipmentStateEntity.ts` | Implemented |
| Alarm management (Earl, Diana) | `lib/iiot/entity/AlarmEntity.ts` | Implemented |
| Work order lifecycle (marketplace) | `lib/iiot/entity/WorkOrderEntity.ts` | Implemented |
| ISA-95 hierarchy (telescoping) | `lib/iiot/schemas/assets/*/schema.ts` | Implemented |
| 12 state machine graphs | `lib/iiot/machines/graphs/*.ts` | Implemented |
| 12 machine actors | `lib/iiot/machines/*.ts` | Implemented |
| Entity composition stack | `lib/iiot/entity/EntityStack.ts:54-67` | Implemented |
| Reactive hierarchy cascade | `lib/iiot/state/*.ts` | Implemented |
| Real-time streaming RPCs | `lib/iiot/rpc/RealtimeRpcs.ts` | Implemented |
| WebSocket event distribution | `lib/iiot/realtime/event-distribution.ts:136-157` | Implemented |
| NATS integration (HolonetBridge) | `lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| Sparkplug-B adapter (onboarding) | `lib/iiot/adapters/sparkplug-adapter.ts` | Implemented |
| Ingestion pipeline | `lib/iiot/adapters/ingestion-service.ts:297-322` | Implemented |
| 17 RPC groups (IIoTRpcs barrel) | `lib/iiot/rpc/index.ts:91-112` | Implemented |
| Sui escrow settlement | Move contracts (Section 18.11) | Specified |
| $TMNL token economics | Move contracts (Section 23) | Specified |
| QuickBooks integration bridge | Extension needed | Not started |
| JobBOSS/ProShop API bridge | Extension needed | Not started |
| SAP Ariba integration | Extension needed | Not started |
| Mobile factory-floor app | Extension needed | Not started |
| Marketplace matching algorithm | Extension needed | Not started |
| Insurance data licensing API | Extension needed | Not started |

---

## 9. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **Earl won't pay $450 for an edge device** | High | Critical | 90-day hardware-included trial; ecosystem fund subsidy; $TMNL early adopter grant |
| **GaMEP partnership fails to materialize** | Medium | High | Direct outreach via machine tool distributors and GMA events as backup |
| **Boeing (or equivalent enterprise) won't onboard** | Medium | High | Target Gulfstream, Lockheed Martin, or Tier 1 aerospace suppliers as alternatives; ensure supply base is compelling before approach |
| **Marketplace liquidity is thin** | High | High | Standalone value (monitoring, OEE) retains users even without marketplace; marketplace is upside, not foundation |
| **Blockchain costs increase beyond projections** | Medium | Medium | Batched settlement reduces per-transaction cost; monitor Sui gas trends; fallback to centralized settlement with blockchain anchoring |
| **Competitor (MachineMetrics, Tulip) launches marketplace feature** | Low | Medium | Network effects create lock-in; event sourcing + DePIN economics are 2+ year moats; open-protocol federation is not replicable by centralized platforms |
| **Insurance underwriters see no value in manufacturing data** | Medium | Low | Insurance is a Tier 4 revenue stream, not core; validate with 1-2 pilot customers before scaling |
| **Small manufacturers resist sharing data** | High | Medium | Demonstrate NATS account isolation; start with anonymous/aggregate only; let trust build with participation |
| **$TMNL token regulatory issues** | Medium | High | Engage securities counsel early; design for utility-first (Section 23.2.6); feature-flag token functionality by jurisdiction |

---

## 10. References

Citations reference entries in `docs/specifications/bibliography.md`.

| Key | Description |
|-----|-------------|
| [MACHINEMETRICS-AWS] | MachineMetrics AWS Marketplace listing, pricing page |
| [TULIP-PLANS] | Tulip Plans & Pricing page (tulip.co/plans/) |
| [IGN-PRICING] | Ignition Software Pricing (inductiveautomation.com/pricing/ignition) |
| [RA-PLEX] | Rockwell Automation Plex Smart Manufacturing Platform |
| [XOMETRY-10Q-2025] | Xometry Inc. Form 10-Q, Q3 2025, SEC filing |
| [GA-MFG-STATS-2024] | Georgia Manufacturing Statistics (manufacturinggeorgia.org) |
| [GAMEP-ABOUT] | Georgia Manufacturing Extension Partnership (gamep.org) |
| [UGA-SBDC-2025] | UGA SBDC 2025 Impact Report on Small Business in Georgia |
| [QUICKBOOKS-API] | QuickBooks Online API documentation |
| [NIST-MEP] | NIST Manufacturing Extension Partnership program |
| [PARKER-PLATFORM] | Parker, Van Alstyne, and Choudary. Platform Revolution (2016) |
| [TWO-SIDED] | Rochet and Tirole. Two-Sided Markets: A Progress Report (2006) |
| [OSTROM-COMMONS] | Ostrom. Governing the Commons (1990) |
| [SHAPIRO-VARIAN] | Shapiro and Varian. Information Rules (1999) |
| [COASE-FIRM] | Coase. The Nature of the Firm (1937) |
| [WILLIAMSON-TCE] | Williamson. Transaction Cost Economics (1979) |
| [METCALFE-LAW] | Metcalfe's Law and Network Value |
| [FDA-CFR11] | FDA 21 CFR Part 11 — Electronic Records and Signatures |
| [NATS-ACCOUNTS] | NATS Account-Based Multi-Tenancy |
| [NATS-DECENTRALIZED] | NATS Decentralized JWT Authentication |
| [SPARKPLUG-B] | Eclipse Sparkplug-B Specification |
| [EFFECT-TS] | Effect-TS Library |
| [EFFECT-CLUSTER] | @effect/cluster Entity Sharding |
| [EVENT-SOURCING] | Fowler. Event Sourcing Pattern |
| [ISA-95-1] | ISA-95 Part 1: Models and Terminology |
| [TEDALDI-MAAS-2023] | Tedaldi and Miragliotta. MaaS Platforms: A Systematic Review (2023) |
| [SIEMENS-INSIGHTS] | Siemens Insights Hub (formerly MindSphere) |
| [TWX-ALWAYSON] | PTC ThingWorx AlwaysOn Protocol |
| [AVEVA-SP] | AVEVA System Platform |
| [AWS-SITEWISE] | AWS IoT SiteWise |
| [AZURE-DT] | Azure Digital Twins |
| [IEEE-DEPIN-2024] | IEEE DePIN Taxonomy and Classification (2024) |

---

<!-- END OF SECTION -->
