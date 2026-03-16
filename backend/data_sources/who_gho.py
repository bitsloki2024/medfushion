"""
WHO Global Health Observatory (GHO) OData API
Source  : https://ghoapi.azureedge.net/api/
Auth    : None (completely free, no key required)
Covers  : Malaria, Tuberculosis (TB), Dengue — global, 190+ countries, 2000-present
Cache   : cache/who_gho.json  (TTL = 24 hours)

Useful indicator codes:
  MALARIA_EST_CASES   — Estimated malaria cases
  MDG_0000000020      — TB incidence rate per 100k population
  DENGUE_CASES        — Reported dengue fever cases
"""

import json
import time

import httpx

from config import WHO_GHO_BASE, WHO_INDICATORS, CACHE_DIR, COUNTRY_COORDS, ISO3_TO_NAME

CACHE_FILE  = CACHE_DIR / "who_gho.json"
TTL_SECONDS = 86400  # 24 hours


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


# ─── Internal helpers ───────────────────────────────────────────────────────────

def _fetch_indicator(indicator: str) -> list[dict]:
    """
    Call the GHO OData endpoint for a single indicator.
    Filters to years >= 2015 and fetches up to 2000 records.
    """
    try:
        # Note: OData $filter with spaces gets URL-encoded by httpx → 400 error.
        # Instead, fetch latest 2000 records sorted descending and filter in Python.
        url  = f"{WHO_GHO_BASE}/{indicator}?$top=1000&$orderby=TimeDim%20desc"
        resp = httpx.get(url, timeout=20)
        resp.raise_for_status()
        rows = resp.json().get("value", [])
        return [r for r in rows if (r.get("TimeDim") or 0) >= 2010]
    except Exception:
        return []


def _to_heatmap(raw: list[dict], disease: str) -> list[dict]:
    """
    Convert raw GHO records to standard heatmap-ready format.
    Keeps only the most-recent year per country (ISO3 → country name).
    """
    # Latest value per ISO3 country code
    best: dict[str, dict] = {}
    for row in raw:
        iso3 = row.get("SpatialDim", "")
        year = row.get("TimeDim") or 0
        val  = row.get("NumericValue") or row.get("Value", 0)
        try:
            val = float(val)
        except (TypeError, ValueError):
            continue
        if iso3 not in best or year > best[iso3]["year"]:
            best[iso3] = {"year": int(year), "value": val}

    if not best:
        return []

    max_val = max(v["value"] for v in best.values()) or 1

    points = []
    for iso3, info in best.items():
        country = ISO3_TO_NAME.get(iso3, "")
        if not country:
            continue
        coords = COUNTRY_COORDS.get(country)
        if not coords:
            continue
        lat, lng, pop = coords
        cases = int(info["value"])
        points.append({
            "country":    country,
            "lat":        lat,
            "lng":        lng,
            "iso2":       iso3[:2],
            "iso3":       iso3,
            "cases":      cases,
            "deaths":     0,
            "population": pop,
            "region":     "WHO Region",
            "risk_score": round(min(1.0, info["value"] / max(max_val * 0.8, 1)), 3),
            "year":       info["year"],
            "source":     f"WHO GHO — {disease}",
        })

    return sorted(points, key=lambda x: x["cases"], reverse=True)


def _fetch_history_for_country(indicator: str, iso3: str) -> list[dict]:
    """Fetch multi-year data for a single country (ISO3 code)."""
    try:
        # Fetch all records for this indicator, filter by country in Python
        url  = f"{WHO_GHO_BASE}/{indicator}?$top=1000&$orderby=TimeDim%20asc"
        resp = httpx.get(url, timeout=15)
        resp.raise_for_status()
        rows = resp.json().get("value", [])
        return [r for r in rows if r.get("SpatialDim") == iso3]
    except Exception:
        return []


# ─── Public fetch functions ─────────────────────────────────────────────────────

def fetch_malaria() -> list[dict]:
    """Return latest estimated malaria cases per country (WHO GHO)."""
    cached = _load_cache()
    if cached and "malaria" in cached:
        return cached["malaria"]

    raw    = _fetch_indicator(WHO_INDICATORS["malaria"])
    points = _to_heatmap(raw, "malaria")

    existing = _load_cache() or {}
    existing["malaria"] = points
    _save_cache(existing)
    return points


def fetch_tb() -> list[dict]:
    """Return TB incidence rate per 100k by country (WHO GHO)."""
    cached = _load_cache()
    if cached and "tb" in cached:
        return cached["tb"]

    raw    = _fetch_indicator(WHO_INDICATORS["tb"])
    points = _to_heatmap(raw, "tb")

    existing = _load_cache() or {}
    existing["tb"] = points
    _save_cache(existing)
    return points


def fetch_dengue() -> list[dict]:
    """Return reported dengue cases per country (WHO GHO)."""
    cached = _load_cache()
    if cached and "dengue" in cached:
        return cached["dengue"]

    raw    = _fetch_indicator(WHO_INDICATORS["dengue"])
    points = _to_heatmap(raw, "dengue")

    existing = _load_cache() or {}
    existing["dengue"] = points
    _save_cache(existing)
    return points


def fetch_history(country: str, disease: str = "malaria") -> dict:
    """
    Return annual case series for a country (for trend charts).
    country : display name, e.g. "Nigeria"
    disease : "malaria" | "tb" | "dengue"
    """
    cache_key = f"hist_{disease}_{country}"
    cached = _load_cache()
    if cached and cache_key in cached:
        return cached[cache_key]

    # Reverse-lookup ISO3
    iso3 = next((k for k, v in ISO3_TO_NAME.items() if v == country), None)
    if not iso3:
        return {}

    indicator = WHO_INDICATORS.get(disease, WHO_INDICATORS["malaria"])
    raw       = _fetch_history_for_country(indicator, iso3)

    years, cases = [], []
    for row in raw:
        year = row.get("TimeDim")
        val  = row.get("NumericValue") or row.get("Value", 0)
        try:
            val = float(val)
        except (TypeError, ValueError):
            val = 0.0
        if year:
            years.append(int(year))
            cases.append(int(val))

    result = {
        "country": country,
        "disease": disease,
        "years":   years,
        "cases":   cases,
        "source":  "WHO GHO",
    }

    existing = _load_cache() or {}
    existing[cache_key] = result
    _save_cache(existing)
    return result
