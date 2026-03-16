"""
CDC Open Data Portal — Socrata API
Source  : https://data.cdc.gov
Auth    : None (no API key required for read access, 1000-row default limit)
Covers  : United States — COVID-19 deaths, weekly ILI surveillance
Cache   : cache/cdc.json  (TTL = 24 hours)

Datasets used:
  r8kw-7aab  — COVID-19 Deaths by State (NCHS)
  pk44-trjp  — FluView ILI weekly data
"""

import json
import time

import httpx

from config import CDC_BASE, CDC_DATASETS, CACHE_DIR

CACHE_FILE  = CACHE_DIR / "cdc.json"
TTL_SECONDS = 86400  # 24 hours

US_COORDS = (37.09, -95.71, 332915073)


# ─── Cache helpers ──────────────────────────────────────────────────────────────

def _load_cache() -> dict | None:
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text())
            if time.time() - data.get("_fetched_at", 0) < TTL_SECONDS:
                return data
        except Exception:
            pass
    return None


def _save_cache(data: dict):
    data["_fetched_at"] = time.time()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, default=str))


# ─── COVID deaths (NCHS) ────────────────────────────────────────────────────────

def fetch_covid_deaths() -> list[dict]:
    """
    Fetch national COVID-19 death totals from CDC NCHS dataset.
    Endpoint: data.cdc.gov/resource/r8kw-7aab.json
    Returns aggregated US-level stats suitable for the globe.
    """
    cached = _load_cache()
    if cached and "covid_deaths" in cached:
        return cached["covid_deaths"]

    try:
        url  = f"{CDC_BASE}/{CDC_DATASETS['covid_deaths']}.json"
        params = {
            "$limit": 1000,
            "$order": "end_date DESC",
            "state":  "United States",
        }
        resp = httpx.get(url, params=params, timeout=15)
        resp.raise_for_status()
        rows: list[dict] = resp.json()
    except Exception:
        return []

    # Sum total COVID deaths across all returned rows
    total_deaths = sum(int(r.get("covid_19_deaths") or 0) for r in rows)
    total_cases  = sum(int(r.get("total_deaths") or 0) for r in rows)

    result = [{
        "country":    "United States",
        "lat":        US_COORDS[0],
        "lng":        US_COORDS[1],
        "iso2":       "US",
        "cases":      total_cases,
        "deaths":     total_deaths,
        "population": US_COORDS[2],
        "region":     "Americas",
        "risk_score": round(min(1.0, total_deaths / 1_200_000), 3),
        "source":     "CDC NCHS (data.cdc.gov)",
    }]

    existing = _load_cache() or {}
    existing["covid_deaths"] = result
    _save_cache(existing)
    return result


# ─── FluView ILI data ───────────────────────────────────────────────────────────

def fetch_flu_ili() -> list[dict]:
    """
    Fetch weekly ILI (influenza-like illness) surveillance data from CDC FluView.
    Endpoint: data.cdc.gov/resource/pk44-trjp.json
    Returns weekly % ILI and total patient visits.
    """
    cached = _load_cache()
    if cached and "flu_ili" in cached:
        return cached["flu_ili"]

    try:
        url    = f"{CDC_BASE}/{CDC_DATASETS['flu_ili']}.json"
        params = {"$limit": 200, "$order": "week_start DESC"}
        resp   = httpx.get(url, params=params, timeout=15)
        resp.raise_for_status()
        rows: list[dict] = resp.json()
    except Exception:
        return []

    result = []
    for r in rows:
        try:
            result.append({
                "week":          r.get("week_start", ""),
                "ili_pct":       float(r.get("percent_ili") or 0),
                "total_patients": int(r.get("total_patients") or 0),
                "ili_total":     int(r.get("ili_total") or 0),
                "region":        r.get("region", "National"),
                "source":        "CDC FluView (data.cdc.gov)",
            })
        except (ValueError, TypeError):
            continue

    existing = _load_cache() or {}
    existing["flu_ili"] = result
    _save_cache(existing)
    return result
