"""
IHME Global Burden of Disease (GBD) — India Focus
Source  : https://ghdx.healthdata.org/gbd-results-tool
Auth    : None (free download, but requires manual export from the website)
Covers  : India — disease burden estimates (malaria, TB, dengue, etc.)
Cache   : cache/ihme_india.csv  (manually placed by user — see README below)

─── HOW TO GET THE DATA (one-time setup, ~2 minutes) ───────────────────────────
1. Go to: https://vizhub.healthdata.org/gbd-results/
2. Set filters:
     - Measure      : Incidence
     - Age          : All Ages
     - Sex          : Both
     - Location     : India
     - Cause        : Malaria, Tuberculosis, Dengue, COVID-19, Influenza
     - Year         : 2010-2021
3. Click "Download" → select CSV
4. Rename the file to  ihme_india.csv
5. Place it at:  backend/cache/ihme_india.csv
─────────────────────────────────────────────────────────────────────────────────

If the file is not found, this module returns gracefully with an empty result
(the dashboard will fall back to WHO GHO data for India).
"""

import csv
from pathlib import Path

from config import CACHE_DIR, COUNTRY_COORDS

IHME_CSV = CACHE_DIR / "ihme_india.csv"

INDIA_COORDS = COUNTRY_COORDS.get("India", (20.59, 78.96, 1393409038))


def is_available() -> bool:
    """Returns True if the IHME CSV has been manually downloaded."""
    return IHME_CSV.exists()


def fetch_india_burden() -> list[dict]:
    """
    Load IHME GBD India disease burden data from the pre-downloaded CSV.
    Returns list of records: { disease, year, cases, metric, source }.
    Returns empty list if CSV has not been downloaded yet.
    """
    if not IHME_CSV.exists():
        return []

    try:
        records = []
        with open(IHME_CSV, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    # IHME CSV column names vary by export — handle common formats
                    cause  = row.get("cause_name") or row.get("Cause") or row.get("cause") or ""
                    year   = int(row.get("year") or row.get("year_id") or row.get("Year") or 0)
                    val    = float(row.get("val") or row.get("Value") or row.get("mean") or 0)
                    metric = row.get("metric_name") or row.get("measure_name") or row.get("Metric") or "Incidence"

                    if not cause or not year:
                        continue

                    records.append({
                        "country":  "India",
                        "lat":      INDIA_COORDS[0],
                        "lng":      INDIA_COORDS[1],
                        "iso2":     "IN",
                        "disease":  cause.lower().replace(" ", "_"),
                        "year":     year,
                        "cases":    int(val),
                        "metric":   metric,
                        "source":   "IHME GBD (India)",
                    })
                except (ValueError, TypeError):
                    continue

        return records

    except Exception:
        return []


def fetch_india_heatmap_point(disease: str = "malaria") -> list[dict]:
    """
    Return a single India heatmap point from IHME data (latest year available).
    Falls back gracefully if CSV not present.
    """
    records = fetch_india_burden()
    if not records:
        return []

    # Filter to requested disease, get latest year
    dis_lower = disease.lower()
    matching  = [r for r in records if dis_lower in r["disease"]]
    if not matching:
        return []

    latest = max(matching, key=lambda r: r["year"])
    return [{
        "country":    "India",
        "lat":        INDIA_COORDS[0],
        "lng":        INDIA_COORDS[1],
        "iso2":       "IN",
        "cases":      latest["cases"],
        "deaths":     0,
        "population": INDIA_COORDS[2],
        "region":     "South-East Asia",
        "risk_score": round(min(1.0, latest["cases"] / 5_000_000), 3),
        "year":       latest["year"],
        "source":     "IHME GBD (India)",
    }]
