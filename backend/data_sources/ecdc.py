"""
ECDC (European Centre for Disease Prevention and Control) — Open Data
Source  : https://opendata.ecdc.europa.eu
Auth    : None (completely free, no key required)
Covers  : European Union / EEA countries — COVID-19, Influenza, Mpox
Cache   : cache/ecdc.json  (TTL = 24 hours)

CSV endpoints used:
  COVID-19 national case/death data for EU/EEA countries
  Weekly influenza surveillance (EISN network)
"""

import csv
import io
import json
import time

import httpx

from config import ECDC_BASE, CACHE_DIR, COUNTRY_COORDS

CACHE_FILE  = CACHE_DIR / "ecdc.json"
TTL_SECONDS = 86400  # 24 hours

# ECDC CSV download URLs
COVID_CSV_URL = f"{ECDC_BASE}/covid19/nationalcasedeath_eueea_daily_ei/csv/data.csv"
FLU_CSV_URL   = f"{ECDC_BASE}/influenza/nationalinfluenzasurveillance/csv/data.csv"


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


# ─── CSV fetcher ────────────────────────────────────────────────────────────────

def _fetch_csv(url: str) -> list[dict]:
    """Download a CSV URL and return list of row dicts."""
    try:
        resp = httpx.get(url, timeout=20, follow_redirects=True)
        resp.raise_for_status()
        reader = csv.DictReader(io.StringIO(resp.text))
        return [row for row in reader]
    except Exception:
        return []


# ─── COVID-19 (EU/EEA) ─────────────────────────────────────────────────────────

def fetch_covid_europe() -> list[dict]:
    """
    Latest COVID-19 case and death counts per European country.
    Data: ECDC nationalcasedeath_eueea_daily_ei CSV
    Returns heatmap-ready list.
    """
    cached = _load_cache()
    if cached and "covid_europe" in cached:
        return cached["covid_europe"]

    rows = _fetch_csv(COVID_CSV_URL)
    if not rows:
        return []

    # Aggregate total cases/deaths per country
    country_totals: dict[str, dict] = {}
    for row in rows:
        country = row.get("countriesAndTerritories", "").replace("_", " ")
        try:
            cases  = int(row.get("cases", 0) or 0)
            deaths = int(row.get("deaths", 0) or 0)
        except (ValueError, TypeError):
            continue
        if country not in country_totals:
            country_totals[country] = {"cases": 0, "deaths": 0,
                                        "iso2": row.get("countryterritoryCode", "")[:2]}
        country_totals[country]["cases"]  += cases
        country_totals[country]["deaths"] += deaths

    max_cases = max((v["cases"] for v in country_totals.values()), default=1)

    points = []
    for country, totals in country_totals.items():
        coords = COUNTRY_COORDS.get(country)
        if not coords:
            continue
        lat, lng, pop = coords
        risk = round(min(1.0, totals["cases"] / max(max_cases * 0.8, 1)), 3)
        points.append({
            "country":    country,
            "lat":        lat,
            "lng":        lng,
            "iso2":       totals["iso2"],
            "cases":      totals["cases"],
            "deaths":     totals["deaths"],
            "population": pop,
            "region":     "Europe",
            "risk_score": risk,
            "source":     "ECDC",
        })

    existing = _load_cache() or {}
    existing["covid_europe"] = points
    _save_cache(existing)
    return points


# ─── Influenza (EU/EEA) ─────────────────────────────────────────────────────────

def fetch_flu_europe() -> list[dict]:
    """
    Weekly influenza surveillance data across European countries (EISN).
    Data: ECDC nationalinfluenzasurveillance CSV
    Returns list of weekly records.
    """
    cached = _load_cache()
    if cached and "flu_europe" in cached:
        return cached["flu_europe"]

    rows = _fetch_csv(FLU_CSV_URL)
    if not rows:
        return []

    result = []
    for row in rows:
        try:
            result.append({
                "country":     row.get("ReportingCountry", ""),
                "week":        row.get("YearWeekISO", ""),
                "ili_rate":    float(row.get("ILIRatePer100000", 0) or 0),
                "positive_pct": float(row.get("PercentPositive", 0) or 0),
                "source":      "ECDC EISN",
            })
        except (ValueError, TypeError):
            continue

    existing = _load_cache() or {}
    existing["flu_europe"] = result
    _save_cache(existing)
    return result
