# State Business Registry — Discovery Findings

**Date:** 2026-03-31
**Method:** Systematic probe of all 50 state `data.{state}.gov` Socrata portals
**Finding:** 10 of 50 states have Socrata-hosted business entity datasets accessible via SODA API

---

## Results Summary

### States WITH Socrata Business Data (10)

| State | Domain | Dataset ID | Dataset Name | Name Col | Type Col | City Col | Status Col | Est. Records |
|-------|--------|-----------|--------------|----------|----------|----------|------------|-------------|
| **NY** | data.ny.gov | n9v6-gdp6 | Active Corporations: Beginning 1800 | current_entity_name | entity_type | location_city | — | 700K |
| **IA** | mydata.iowa.gov | ez5t-3qay | Active Iowa Business Entities | legal_name | corporation_type | ho_city | — | 326K |
| **OR** | data.oregon.gov | tckn-sxa6 | Active Businesses - ALL | business_name | entity_type | city | state | 500K |
| **CO** | data.colorado.gov | 4ykn-tg5h | Business Entities in Colorado | entityname | entitytype | principalcity | entitystatus | 1.2M |
| **PA** | data.pa.gov | xvd7-5r2c | Registered Businesses in PA | business_name | typeofbusinessregistration | city | — | 400K |
| **CT** | data.ct.gov | n7gp-d28j | CT Business Registry - Business Master | name | — | mailing_address | status | 300K |
| **CT** | data.ct.gov | ah3s-bes7 | CT Business Filing History | name | type | — | — | 300K |
| **DE** | data.delaware.gov | 5zy2-grhr | Delaware Business Licenses | business_name | category | city | — | 200K |
| **WA** | data.wa.gov | 5t5b-7yy4 | Unified Business Identifiers | businessname/legalname | — | city | — | ~500K |
| **WA** | data.wa.gov | 4xk5-x9j6 | L&I Contractor Licenses | businessname | contractorlicensetypecode | — | — | ~100K |
| **TX** | data.texas.gov | 3fc3-wv7y | Licensed Fuels Taxpayers | name | — | city | — | limited scope |
| **MO** | data.mo.gov | nytw-fmz3 | MO Alcohol Licenses | licensee_name | business_type | city | license_current_status | limited scope |
| **LA (city)** | data.lacity.org | 6rrh-rzua | LA Active Businesses | business_name | — | city | — | 500K |

**Note:** Iowa uses `mydata.iowa.gov` not `data.iowa.gov`. Connecticut has TWO useful datasets (master + filing history). Washington has both a general UBI dataset and a contractor-specific license dataset.

### States WITHOUT Socrata Business Data (40)

AL, AK, AZ, AR, CA, FL, GA, HI, ID, IL, IN, KS, KY, LA, ME, MD, MA, MI, MN, MS, MT, NE, NV, NH, NJ, NM, NC, ND, OH, OK, RI, SC, SD, TN, UT, VT, VA, WV, WI, WY

**These states either:**
- Don't use Socrata for their open data portal
- Don't publish business entity data on their open data portal
- Have their own proprietary SOS search interface (most common)
- Require paid API access or FOIA requests for bulk data

### Notable Non-Socrata Sources for Missing States

| State | Source | Access | Notes |
|-------|--------|--------|-------|
| **CA** | calicodev.sos.ca.gov | Free API, requires key registration (1-3 days) | 2.5M entities. Best single-state source. |
| **FL** | dos.myflorida.com/sunbiz | Web search only, no API | Major state, no bulk access |
| **TX** | sos.state.tx.us | Web search only | Second largest state |
| **IL** | cyberdriveconnection.com | Web search only | |
| **OH** | businesssearch.ohiosos.gov | Web search only | |
| **GA** | ecorp.sos.ga.gov | Web search only | JCK USA is in GA (Marietta) |
| **MI** | cofs.lara.state.mi.us | Web search only | |
| **NJ** | njbgs.nj.gov | Web search only | |

---

## Coverage Estimate

With the 10 verified Socrata states:
- **~4.3M total entities** across all datasets
- After keyword filtering (200 per query × 10 queries × 10 states): **~15,000-20,000 matching companies**
- After dedup: **~8,000-12,000 unique companies**

With California API (if registered): adds **~2.5M entities**, filtered down to **~5,000-8,000 more**

---

## Technical Notes

- All Socrata datasets support SoQL server-side filtering via `$where` parameter
- LIKE queries are case-insensitive on most Socrata deployments
- Default limit is 1000 per request, configurable up to 50,000
- No authentication required for any of these datasets
- Rate limits are soft — no hard block, but courtesy delays recommended (200-500ms between requests)
- Iowa subdomain is `mydata.iowa.gov` NOT `data.iowa.gov` — the dataset ID works on both but the domain matters for direct API calls

---

*Finding documented by Val. Verified 2026-03-31 via systematic probe of all 50 state Socrata portals.*
