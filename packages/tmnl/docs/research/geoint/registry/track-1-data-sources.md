# Track 1 — OSINT-First Near-Real-Time GEOINT Data Source Registry

Date: 2026-02-24  
Scope: Reliable OSINT-capable sources for seconds-to-minutes operations across flights (ADS-B), maritime (AIS), weather, wildfire/disaster, and EO catalogs.

---

## 1) Method + scoring model

### Evaluation criteria (weighted)
- **Timeliness fit (35%)**: how well the source supports seconds/minutes use.
- **Access model (20%)**: open/free/hybrid friction, keying, and cost constraints.
- **Reliability signals (20%)**: official operator docs, stated operational status, transparent limits/changelog.
- **Coverage/completeness (15%)**: geographic/sensor breadth for operational value.
- **Legal/usage clarity (10%)**: explicit usage terms and predictable constraints.

**Score formula (0-100):**  
`Total = Σ((criterion_score_1_to_5 / 5) * criterion_weight)`

Interpretation:
- **80-100**: Primary ingest candidate
- **65-79**: Secondary/corroboration candidate
- **<65**: Contextual/supporting layer (not primary live trigger)

---

## 2) Registry (by domain)

| Domain | Source | URL | Access model | Practical update cadence | Reliability signals | Caveats |
|---|---|---|---|---|---|---|
| Flights (ADS-B) | OpenSky Network REST API | https://openskynetwork.github.io/opensky-api/rest.html | **Free/Open (rate-limited)** | ~10s anonymous resolution; ~5s authenticated; state vector position validity window ~15s | Public API docs with explicit limits/semantics; widely used in research | Tight quotas/credits; higher-fidelity use may require auth/privileges |
| Flights (ADS-B) | ADS-B Exchange API / Enterprise | https://www.adsbexchange.com/data/ | **Hybrid** (hobby + paid enterprise) | Enterprise feed cites up to ~2 Hz for in-flight updates | Commercial docs, explicit enterprise product claims | Lowest-latency/coverage quality is paywalled; redistribution restrictions |
| Flights (ADS-B) | Airplanes.live | https://airplanes.live/api-guide/ | **Free** (non-commercial/open access posture) | Near-real-time feed, API request rate limit 1 req/sec | Public API guide and limits | Explicit no-SLA/no uptime guarantees; policy may change |
| Maritime (AIS) | MarineTraffic API + support docs | https://servicedocs.marinetraffic.com/ | **Hybrid** (free account + paid API/enterprise) | In-range vessels commonly downsampled to ~60s; varies by AIS class/speed | Extensive support docs + API docs + operational notes | Terrestrial vs satellite latency differs; paid plans for robust use |
| Maritime (AIS) | AISStream WebSocket API | https://aisstream.io/documentation | **Free** (API key) | Event-driven push stream (near-real-time) | Simple websocket model and open docs | Beta/no strong SLA commitments; schema evolution risk |
| Maritime (AIS) | AISHub | https://www.aishub.net/api | **Free (contributor model)** | API pull rate effectively ~1/min; contributor quality constraints include low delay targets | Transparent participation criteria and feed quality requirements | Access tied to contributing AIS feed; not turnkey for non-contributors |
| Weather | NWS API (weather.gov) | https://www.weather.gov/documentation/services-web-api | **Open/Free** | Alert/forecast endpoints are near-real-time with cache semantics; observations may lag up to ~20 min | Official NOAA/NWS service, User-Agent requirement, documented behavior | No single hard global latency SLA; product-dependent delay |
| Weather | NOAA NEXRAD (WSR-88D) | https://www.roc.noaa.gov/public-documents/wsr88d/NEXRAD-Technical-Information.pdf | **Open/Free data ecosystem** | Typical scan refresh ~2–6 min (precip modes), ~10 min (clear air); can be faster in specific scan modes | Authoritative technical docs and operational weather infrastructure | Cadence depends on VCP mode and regional operations |
| Weather | Open-Meteo API | https://open-meteo.com/en/docs | **Free for non-commercial + commercial options** | Model-dependent refresh cycles (hourly to multi-hour), not strict seconds/minutes telemetry | Transparent model tables and update pages | Great for forecasts/analysis, not best as primary second-level trigger stream |
| Wildfire/Disaster | NASA FIRMS API | https://firms.modaps.eosdis.nasa.gov/api/ | **Free** (MAP_KEY for API limits) | Map views update ~5 min; downloadable datasets ~60 min; global NRT often up to ~3h (URT faster in limited regions) | NASA-backed system, published limits (`5000/10 min`) and sensor metadata | Not a perimeter/tactical fireline truth source; latency varies by region/sensor |
| Wildfire/Disaster | GDACS feeds | https://www.gdacs.org/feed_reference.aspx | **Open/Free** | RSS feeds documented as updating ~every 6 min | UN OCHA + EU JRC governance; explicit feed references | Early-event impacts are model-based and can materially revise |
| Wildfire/Disaster | USGS Earthquake real-time feeds | https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php | **Open/Free** | Initial public posting commonly in minutes (often ~1.5–20 min depending network/location) | Official USGS feed policy and event lifecycle docs | Magnitude/location revisions are normal in hours/days |
| Wildfire/Disaster | NASA EONET | https://eonet.gsfc.nasa.gov/docs/v3 | **Open/Free** | Near-real-time aggregation from upstream providers | Source-attributed event aggregation API | Aggregator latency inherits upstream providers |
| EO Catalogs | Copernicus Data Space STAC | https://stac.dataspace.copernicus.eu/v1 | **Open search + account-based download workflows** | Collection-dependent; includes NRT/STC/NTC classes (typically not seconds-level) | Official CDSE STAC endpoint and collection taxonomy | Great for catalog/discovery; not a direct seconds-minutes telemetry feed |
| EO Catalogs | Sentinel Hub Catalog API (STAC) | https://docs.sentinel-hub.com/api/latest/api/catalog/ | **Hybrid** (auth + paid/commercial pathways) | Near-real-time archive ingestion for supported collections; hard minute SLA typically collection-specific | Mature API docs, item-level metadata including timeliness fields | Access and timeliness vary by collection/license/plan |
| EO Catalogs | Microsoft Planetary Computer STAC | https://planetarycomputer.microsoft.com/docs/quickstarts/stac/ | **Open/Free discovery (auth for some assets/workflows)** | Rolling ingestion/catalog updates; no universal seconds/minutes SLA | Strong STAC compliance docs + enterprise ops posture | Excellent analytic catalog; not a primary second-level alert stream |

---

## 3) Scored shortlist (near-real-time suitability)

### Balanced shortlist (cross-domain, operationally useful)

| Rank | Source | Domain | Score (100) | Tier | Why it made shortlist |
|---:|---|---|---:|---|---|
| 1 | NOAA NEXRAD | Weather | **85** | Primary ingest | Minute-level radar cadence, official operational backbone |
| 2 | USGS Earthquake feeds | Disaster | **81** | Primary ingest | Open/public, fast initial posting, high trust source |
| 3 | OpenSky Network | Flights | **80** | Primary ingest | Strong timeliness + open access path + explicit semantics |
| 4 | ADS-B Exchange (Enterprise) | Flights | **80** | Primary ingest | Best practical flight latency for high-tempo use |
| 5 | NWS API | Weather | **78** | Secondary/Primary (product-dependent) | Official and robust; excellent alerts/forecasts |
| 6 | GDACS | Disaster | **77** | Secondary/corroboration | Reliable global disaster meta-alerting every ~6 min |
| 7 | NASA FIRMS | Wildfire | **69** | Secondary/corroboration | High-value wildfire detection, but global latency often hours |
| 8 | AISStream | Maritime | **67** | Secondary/corroboration | Real-time push AIS with low entry friction |
| 9 | MarineTraffic | Maritime | **63** | Context/secondary | Strong coverage but update/licensing often plan-dependent |
| 10 | Copernicus STAC | EO Catalog | **62** | Context | Essential EO discovery layer, not trigger-speed telemetry |

### Sources intentionally not top-ranked for second-level triggering
- Planetary Computer STAC, Sentinel Hub Catalog, Open-Meteo: high value for context/analysis, lower fit for strict seconds-minutes trigger loops.
- Airplanes.live, AISHub: useful OSINT augmenters with reliability/access caveats.

---

## 4) Recommendation rubric (paste into architecture decision)

Use this rubric to select source mix by mission criticality:

### Step A — classify mission tempo
- **Tempo A (seconds-critical):** collision risk, dynamic intercept, immediate hazard notification.
- **Tempo B (minutes-critical):** tactical planning, rerouting, incident triage.
- **Tempo C (analysis-context):** post-event analysis, planning, catalog search.

### Step B — source admission rules
A source is admitted to **Primary ingest** only if:
1. Timeliness score >= 4/5, and
2. Reliability score >= 4/5, and
3. Legal clarity >= 3/5.

Else:
- If total >= 65: **Secondary/corroboration**
- If total < 65: **Contextual layer only**

### Step C — recommended stack by domain
- **Flights:** OpenSky (baseline) + ADS-B Exchange Enterprise (low-latency upgrade).
- **Maritime:** AISStream (live push baseline) + MarineTraffic (coverage/commercial fallback).
- **Weather:** NEXRAD + NWS API as core.
- **Wildfire/Disaster:** USGS + GDACS core; FIRMS as wildfire corroboration.
- **EO catalogs:** Copernicus STAC as catalog backbone; Sentinel Hub / Planetary Computer for enrichment.

### Step D — operational guardrails
- Never trigger critical action from a single source class; require **cross-source corroboration** for Tempo A/B.
- Treat aggregator products (EONET/GDACS) as event indicators, not final ground truth.
- Persist source metadata (`source`, `collection`, `timestamp`, `updated`, `access_tier`) for provenance and replay.

---

## 5) Key caveats (decision-critical)

1. **EO catalogs are rarely seconds/minutes triggers.** They are vital for discovery/context, not usually for immediate telemetry response.
2. **Access model drives reliability.** The best latency often sits in hybrid/commercial tiers (ADS-B Exchange, MarineTraffic, Sentinel Hub).
3. **“Near-real-time” is not uniform.** It can mean sub-second streaming (AIS/ADS-B push), 2–10 minute products (radar/disaster feeds), or multi-hour satellite NRT.
4. **Legal restrictions matter operationally.** Redistribution/caching terms can block intended downstream use unless contractually cleared.

---

## 6) Source URL index

- OpenSky REST API docs: https://openskynetwork.github.io/opensky-api/rest.html
- ADS-B Exchange data/API pages: https://www.adsbexchange.com/data/
- Airplanes.live API guide: https://airplanes.live/api-guide/
- MarineTraffic API docs: https://servicedocs.marinetraffic.com/
- MarineTraffic update frequency note: https://support.marinetraffic.com/en/articles/9552905-how-often-do-the-positions-of-the-vessels-get-updated-on-marinetraffic
- AISStream docs: https://aisstream.io/documentation
- AISHub API: https://www.aishub.net/api
- NWS API docs: https://www.weather.gov/documentation/services-web-api
- NEXRAD technical info: https://www.roc.noaa.gov/public-documents/wsr88d/NEXRAD-Technical-Information.pdf
- Open-Meteo docs: https://open-meteo.com/en/docs
- NASA FIRMS API: https://firms.modaps.eosdis.nasa.gov/api/
- NASA FIRMS data availability endpoint: https://firms.modaps.eosdis.nasa.gov/api/data_availability/
- GDACS feed reference: https://www.gdacs.org/feed_reference.aspx
- USGS earthquake GeoJSON feeds: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- USGS event web service: https://earthquake.usgs.gov/fdsnws/event/1/
- NASA EONET docs: https://eonet.gsfc.nasa.gov/docs/v3
- Copernicus STAC docs: https://documentation.dataspace.copernicus.eu/APIs/STAC.html
- Copernicus STAC endpoint: https://stac.dataspace.copernicus.eu/v1
- Sentinel Hub Catalog API docs: https://docs.sentinel-hub.com/api/latest/api/catalog/
- Microsoft Planetary Computer STAC quickstart: https://planetarycomputer.microsoft.com/docs/quickstarts/stac/
