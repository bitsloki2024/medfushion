"""
CDC FluView — Weekly US Influenza Surveillance via RSS
Source  : https://www.cdc.gov/flu/weekly/
Auth    : None (public RSS feed)
Covers  : United States — weekly ILI %, flu positivity rates, HHS regions
Cache   : cache/fluview.json  (TTL = 1 hour)

CDC publishes weekly influenza surveillance reports every Friday.
This module parses the RSS feed for the latest report metadata,
and supplements it with data from the CDC Open Data Socrata API.
"""

import json
import time
from datetime import datetime

import feedparser
import httpx

from config import FLUVIEW_RSS, CDC_BASE, CACHE_DIR

CACHE_FILE  = CACHE_DIR / "fluview.json"
TTL_SECONDS = 3600  # 1 hour

# Backup: CDC Socrata endpoint for FluView ILI data
FLUVIEW_SOCRATA = f"{CDC_BASE}/dqgw-76uj.json"


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


# ─── RSS parse ──────────────────────────────────────────────────────────────────

def _parse_rss() -> list[dict]:
    """
    Parse CDC FluView RSS feed.
    Each entry is a weekly flu surveillance report with title + link + date.
    """
    try:
        feed = feedparser.parse(FLUVIEW_RSS)
        entries = []
        for entry in feed.entries[:20]:
            published = ""
            if hasattr(entry, "published"):
                published = entry.published
            elif hasattr(entry, "updated"):
                published = entry.updated
            entries.append({
                "title":     entry.get("title", ""),
                "link":      entry.get("link", ""),
                "summary":   entry.get("summary", "")[:300],
                "published": published,
                "source":    "CDC FluView RSS",
            })
        return entries
    except Exception:
        return []


def _fetch_socrata_ili() -> list[dict]:
    """Fallback: fetch ILI data from CDC Socrata API."""
    try:
        resp = httpx.get(
            FLUVIEW_SOCRATA,
            params={"$limit": 52, "$order": "week_start DESC"},
            timeout=12,
        )
        resp.raise_for_status()
        rows = resp.json()
        result = []
        for r in rows:
            try:
                result.append({
                    "week":           r.get("week_start", "")[:10],
                    "ili_pct":        float(r.get("pct_ili") or r.get("percent_ili") or 0),
                    "total_patients": int(r.get("total_patients") or 0),
                    "source":         "CDC FluView (Socrata)",
                })
            except (ValueError, TypeError):
                continue
        return result
    except Exception:
        return []


# ─── Public fetch function ──────────────────────────────────────────────────────

def fetch_fluview() -> dict:
    """
    Return CDC FluView surveillance data: recent report headlines + ILI stats.
    {
      "reports": [ { title, link, published } ... ],   ← from RSS
      "ili_weekly": [ { week, ili_pct, total_patients } ... ],  ← from Socrata
    }
    """
    cached = _load_cache()
    if cached and "fluview" in cached:
        return cached["fluview"]

    reports   = _parse_rss()
    ili_stats = _fetch_socrata_ili()

    result = {
        "reports":    reports,
        "ili_weekly": ili_stats,
        "fetched_at": datetime.utcnow().isoformat(),
        "source":     "CDC FluView",
    }

    existing = _load_cache() or {}
    existing["fluview"] = result
    _save_cache(existing)
    return result
