#!/usr/bin/env python3
"""
Signal Hunter — External Python agent that discovers and writes signals
through the Prospect Pipeline HTTP API.

This simulates what a real agent (LLM, scraper, CRON job) would do:
  1. Query the API for companies lacking signals
  2. Analyze company data to derive signals
  3. Write new signals back through entity RPCs

Signal strategies:
  - Name-based industry signals (company name contains industry keywords)
  - State registration age signals (old companies = established, new = growth)
  - Multi-keyword match strength (matched on 3+ search queries = high interest)
  - Company size inference from entity type (LLC vs Corp vs Inc)
  - Federal contract value tiers from USASpending descriptions
  - Geographic clustering (multiple companies in same city = market density)

Usage:
    # Start the API server first:
    bun run prospects:api

    # Run the signal hunter:
    python3 src/lib/prospects/agents/signal_hunter.py
"""

import json
import re
import requests
import sys
import time
from collections import Counter, defaultdict
from uuid import uuid4

BASE = "http://localhost:3100"

# ─── API Helpers ─────────────────────────────────────────────────────

def tag_to_path(tag: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9]+', '-', tag)
    s = re.sub(r'([a-z])([A-Z])', r'\1-\2', s)
    return s.lower()

def query(path: str, params: dict = None) -> dict:
    r = requests.get(f"{BASE}/api/{path}", params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def create_signal(company_id: str, signal_type: str, title: str,
                   description: str, weight: int = 1, source_url: str = None) -> dict:
    sig_id = f"agent-sig-{uuid4().hex[:12]}"
    kebab = tag_to_path("Signal.Create")
    r = requests.post(
        f"{BASE}/api/signals/{kebab}/{sig_id}",
        json={
            "id": sig_id,
            "companyId": company_id,
            "signalType": signal_type,
            "title": title,
            "description": description,
            "weight": weight,
            "sourceUrl": source_url,
        },
        timeout=10,
    )
    if r.status_code != 200:
        return None
    return r.json()

def update_company_stage(company_id: str, stage: str) -> dict:
    kebab = tag_to_path("Company.UpdateStage")
    r = requests.post(
        f"{BASE}/api/companies/{kebab}/{company_id}",
        json={"id": company_id, "stage": stage},
        timeout=10,
    )
    return r.json() if r.status_code == 200 else None


# ─── Signal Strategies ───────────────────────────────────────────────

def strategy_contract_value_tiers(companies: list) -> list:
    """
    Parse signal titles for dollar amounts and create tiered contract signals.
    USASpending signals have titles like "$267.6M federal award: ..."
    """
    signals = []
    existing_sigs = query("queries/signals/recent", {"limit": "500"})
    
    for sig in existing_sigs:
        if sig.get("signalType") != "rfp":
            continue
        
        title = sig.get("title", "")
        # Extract dollar amount
        match = re.search(r'\$(\d+(?:\.\d+)?)\s*([MBK])', title, re.IGNORECASE)
        if not match:
            continue
        
        amount = float(match.group(1))
        unit = match.group(2).upper()
        if unit == 'K':
            amount *= 1_000
        elif unit == 'M':
            amount *= 1_000_000
        elif unit == 'B':
            amount *= 1_000_000_000
        
        # Tier the contract
        if amount >= 100_000_000:
            tier = "mega_contract"
            weight = 3
            tier_label = ">$100M"
        elif amount >= 10_000_000:
            tier = "large_contract"
            weight = 2
            tier_label = "$10M-$100M"
        elif amount >= 1_000_000:
            tier = "mid_contract"
            weight = 1
            tier_label = "$1M-$10M"
        else:
            continue  # too small to signal
        
        signals.append({
            "company_id": sig["companyId"],
            "signal_type": "contract_value",
            "title": f"{tier_label} federal contract ({sig['title'][:60]}...)",
            "description": f"Contract value tier: {tier_label}. Derived from USASpending award data.",
            "weight": weight,
        })
    
    return signals


def strategy_geographic_clustering(companies: list) -> list:
    """
    Companies in the same city with same industry = market density signal.
    Good for: "there are 5 construction companies in Denver" → that's a market.
    """
    signals = []
    
    # Group by city (from location_json or description)
    city_groups = defaultdict(list)
    for co in companies:
        desc = co.get("description", "") or ""
        # Extract city from "Registry: State" or location hints
        city_match = re.search(r'(?:city|located in|based in)\s+(\w[\w\s]+)', desc, re.IGNORECASE)
        if not city_match:
            # Try tags for state code
            continue
        city = city_match.group(1).strip()
        if len(city) > 2:
            city_groups[f"{city}:{co['industry']}"].append(co)
    
    for key, group in city_groups.items():
        if len(group) >= 3:
            city, industry = key.split(":", 1)
            for co in group:
                signals.append({
                    "company_id": co["id"],
                    "signal_type": "market_density",
                    "title": f"Market cluster: {len(group)} {industry} companies in {city}",
                    "description": f"Geographic clustering detected. {len(group)} companies in same city+industry suggests active market.",
                    "weight": 1,
                })
    
    return signals


def strategy_name_complexity(companies: list) -> list:
    """
    Company name analysis:
    - Names with "Inc" / "Corp" / "Corporation" → established (weight 1)
    - Names with "Solutions" / "Systems" / "Technologies" → tech-forward (weight 2)
    - Names with "Group" / "Holdings" / "International" → large scope (weight 2)
    """
    signals = []
    tech_patterns = re.compile(
        r'\b(solutions|systems|technologies|digital|automation|tech)\b', re.IGNORECASE
    )
    scale_patterns = re.compile(
        r'\b(group|holdings|international|global|enterprise|national)\b', re.IGNORECASE
    )
    
    for co in companies:
        name = co.get("name", "")
        
        if tech_patterns.search(name):
            signals.append({
                "company_id": co["id"],
                "signal_type": "tech_interest",
                "title": f"Tech-forward naming: {name}",
                "description": "Company name contains technology-oriented keywords (solutions/systems/technologies), suggesting tech adoption mindset.",
                "weight": 1,
            })
        
        if scale_patterns.search(name):
            signals.append({
                "company_id": co["id"],
                "signal_type": "company_scale",
                "title": f"Enterprise-scale naming: {name}",
                "description": "Company name suggests multi-site or international operations (group/holdings/international).",
                "weight": 1,
            })
    
    return signals


# ─── Main Agent Loop ─────────────────────────────────────────────────

def main():
    print("\n🔍 Signal Hunter — External Python Agent")
    print(f"   Target: {BASE}")
    print(f"   Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Get current state
    summary = query("queries/pipeline/summary")
    print(f"📊 Current: {summary['totalCompanies']} companies, {summary['totalSignals']} signals")
    
    # Fetch companies by industry for analysis
    all_signals_to_create = []
    
    # Strategy 1: Contract value tiers
    print("\n🎯 Strategy 1: Federal contract value tiers")
    contract_signals = strategy_contract_value_tiers([])
    print(f"   Found {len(contract_signals)} contract value signals")
    all_signals_to_create.extend(contract_signals)
    
    # Strategy 2: Name complexity analysis (sample manufacturing + construction)
    print("\n🎯 Strategy 2: Company name analysis")
    for industry in ["manufacturing", "construction", "logistics"]:
        companies = query("queries/companies/by-industry", {"industry": industry})
        name_signals = strategy_name_complexity(companies)
        print(f"   {industry}: {len(name_signals)} name-based signals from {len(companies)} companies")
        all_signals_to_create.extend(name_signals)
    
    # Strategy 3: Geographic clustering
    print("\n🎯 Strategy 3: Geographic clustering")
    all_companies = []
    for industry in ["manufacturing", "construction"]:
        all_companies.extend(query("queries/companies/by-industry", {"industry": industry}))
    geo_signals = strategy_geographic_clustering(all_companies)
    print(f"   Found {len(geo_signals)} geographic cluster signals")
    all_signals_to_create.extend(geo_signals)
    
    # Deduplicate by company_id + signal_type
    seen = set()
    unique_signals = []
    for sig in all_signals_to_create:
        key = f"{sig['company_id']}:{sig['signal_type']}"
        if key not in seen:
            seen.add(key)
            unique_signals.append(sig)
    
    print(f"\n📝 Total unique signals to create: {len(unique_signals)}")
    
    # Write signals through the API
    created = 0
    errors = 0
    by_type = Counter()
    
    for sig in unique_signals:
        result = create_signal(
            company_id=sig["company_id"],
            signal_type=sig["signal_type"],
            title=sig["title"],
            description=sig["description"],
            weight=sig["weight"],
        )
        if result:
            created += 1
            by_type[sig["signal_type"]] += 1
        else:
            errors += 1
    
    # Report
    print(f"\n✅ Created {created} signals ({errors} errors)")
    for sig_type, count in by_type.most_common():
        print(f"   {sig_type}: {count}")
    
    # Verify via API
    new_summary = query("queries/pipeline/summary")
    delta = new_summary["totalSignals"] - summary["totalSignals"]
    print(f"\n📊 After: {new_summary['totalSignals']} signals (+{delta})")
    print(f"   Provenance: {new_summary['totalProvenance']} entries")
    
    print(f"\n🏁 Signal Hunter complete\n")


if __name__ == "__main__":
    main()
