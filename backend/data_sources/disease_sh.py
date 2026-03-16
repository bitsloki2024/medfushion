"""
Disease.sh REST API — COVID-19 and Influenza Data
Source  : https://disease.sh
Auth    : None (completely free, no key required)
Updates : Every 15 minutes
Covers  : 200+ countries — COVID-19 cases, deaths, recoveries; US flu weekly stats
Cache   : cache/disease_sh.json  (TTL = 1 hour)
"""

import json
import time
from pathlib import Path

import httpx

from config import DISEASE_SH_BASE, CACHE_DIR, COUNTRY_COORDS

CACHE_FILE = CACHE_DIR / "disease_sh.json"
TTL_SECONDS = 3600  # 1 hour


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


# ─── COVID-19 ───────────────────────────────────────────────────────────────────

def fetch_covid() -> list[dict]:
    """
    Fetch live COVID-19 data for every country.
    Endpoint: GET /v3/covid-19/countries
    Returns list of heatmap-ready dicts with lat/lng/cases/deaths/risk_score.
    """
    cached = _load_cache()
    if cached and "covid" in cached:
        return cached["covid"]

    try:
        resp = httpx.get(f"{DISEASE_SH_BASE}/covid-19/countries", timeout=12)
        resp.raise_for_status()
        raw: list[dict] = resp.json()
    except Exception:
        return []

    max_cases = max((item.get("cases") or 0 for item in raw), default=1)

    points = []
    for item in raw:
        country = item.get("country", "")
        coords  = COUNTRY_COORDS.get(country)
        if not coords:
            continue
        lat, lng, pop = coords
        cases    = int(item.get("cases", 0) or 0)
        deaths   = int(item.get("deaths", 0) or 0)
        risk     = round(min(1.0, cases / max(max_cases * 0.8, 1)), 3)
        iso2     = (item.get("countryInfo") or {}).get("iso2") or country[:2].upper()

        points.append({
            "country":    country,
            "lat":        lat,
            "lng":        lng,
            "iso2":       iso2,
            "cases":      cases,
            "deaths":     deaths,
            "recovered":  int(item.get("recovered", 0) or 0),
            "active":     int(item.get("active", 0) or 0),
            "population": int(item.get("population") or pop),
            "region":     "Global",
            "risk_score": risk,
            "source":     "Disease.sh",
        })

    existing = _load_cache() or {}
    existing["covid"] = points
    _save_cache(existing)
    return points


def fetch_covid_history(country: str, last_days: int = 365) -> dict:
    """
    Fetch historical COVID timeline for a single country.
    Endpoint: GET /v3/covid-19/historical/{country}?lastdays={n}
    Returns: { years: [...], cases: [...], deaths: [...] }
    """
    cache_key = f"covid_hist_{country}"
    cached = _load_cache()
    if cached and cache_key in cached:
        return cached[cache_key]

    try:
        url  = f"{DISEASE_SH_BASE}/covid-19/historical/{country}?lastdays={last_days}"
        resp = httpx.get(url, timeout=12)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return {}

    timeline = data.get("timeline") or {}
    cases_raw  = timeline.get("cases", {})
    deaths_raw = timeline.get("deaths", {})

    # Aggregate to monthly for cleaner chart
    monthly_cases: dict[str, int] = {}
    for date_str, val in cases_raw.items():
        month = date_str[:7] if len(date_str) >= 7 else date_str
        monthly_cases[month] = int(val or 0)

    monthly_deaths: dict[str, int] = {}
    for date_str, val in deaths_raw.items():
        month = date_str[:7] if len(date_str) >= 7 else date_str
        monthly_deaths[month] = int(val or 0)

    sorted_months = sorted(monthly_cases.keys())
    result = {
        "country": country,
        "months":  sorted_months,
        "cases":   [monthly_cases.get(m, 0) for m in sorted_months],
        "deaths":  [monthly_deaths.get(m, 0) for m in sorted_months],
        "source":  "Disease.sh",
    }

    existing = _load_cache() or {}
    existing[cache_key] = result
    _save_cache(existing)
    return result


# ─── Influenza ──────────────────────────────────────────────────────────────────

def fetch_flu() -> list[dict]:
    """
    Fetch influenza data from Disease.sh.
    Endpoint: GET /v3/flu
    Returns raw flu stats (US-centric weekly ILI data).
    """
    cached = _load_cache()
    if cached and "flu" in cached:
        return cached["flu"]

    try:
        resp = httpx.get(f"{DISEASE_SH_BASE}/flu", timeout=10)
        resp.raise_for_status()
        raw = resp.json()
    except Exception:
        return []

    result = raw if isinstance(raw, list) else [raw]

    existing = _load_cache() or {}
    existing["flu"] = result
    _save_cache(existing)
    return result
