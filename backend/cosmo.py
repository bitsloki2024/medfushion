"""
Cosmo — AI Disease Intelligence Assistant for CosmoSentinel.

Two-tier approach:
  1. If ANTHROPIC_API_KEY or GROQ_API_KEY is set → use LLM for rich natural language
  2. Otherwise → smart backend-powered fallback (real data, formatted responses)

The fallback is fully functional and requires NO external API key.
"""

import json
import os
import re
import logging
from datetime import datetime

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_port = os.getenv("PORT", "8000")
BASE_URL = os.getenv("API_BASE_URL", f"http://localhost:{_port}")

DISEASE_NAMES = {
    "covid":   "COVID-19",
    "flu":     "Influenza",
    "malaria": "Malaria",
    "tb":      "Tuberculosis (TB)",
    "dengue":  "Dengue Fever",
}

DISEASE_KEYWORDS = {
    "covid":   ["covid", "coronavirus", "sars", "covid-19"],
    "flu":     ["flu", "influenza", "h1n1", "h3n2"],
    "malaria": ["malaria", "plasmodium", "falciparum"],
    "tb":      ["tuberculosis", "tb", "mycobacterium"],
    "dengue":  ["dengue", "dengue fever", "denv"],
}

# ── Backend API helpers ────────────────────────────────────────────────────────

async def _get(path: str, params: dict) -> dict | None:
    """Call a backend endpoint, return parsed JSON or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(f"{BASE_URL}{path}", params=params)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.warning("Backend call %s failed: %s", path, e)
        return None


# ── Intent detection ───────────────────────────────────────────────────────────

def _detect_disease(text: str) -> str | None:
    """Pick the disease most mentioned in text."""
    text_l = text.lower()
    for key, kws in DISEASE_KEYWORDS.items():
        if any(kw in text_l for kw in kws):
            return key
    return None


def _detect_countries(text: str, current_country: str) -> list[str]:
    """
    Extract country names from text.
    - Splits on vs/v/versus/and/against separators (case-insensitive, handles lowercase names)
    - Falls back to capitalised tokens
    """
    DISEASE_WORDS = {"covid", "flu", "malaria", "tb", "dengue", "influenza",
                     "coronavirus", "tuberculosis", "fever", "all"}
    SKIP_WORDS   = {"i", "compare", "show", "what", "how", "is", "are", "does", "the",
                    "a", "an", "and", "or", "for", "in", "of", "to", "with", "give",
                    "tell", "me", "us", "any", "all", "from", "between", "countrywise",
                    "country", "countries", "statistics", "data", "global", "get", "give",
                    "please", "provide", "comparison", "between",
                    # Descriptors that look like countries but aren't
                    "top", "affected", "similar", "other", "major", "comparable",
                    "highest", "worst", "leading", "emerging", "high", "low", "risk",
                    "cases", "mortality", "trends", "counts", "scores", "rates"}

    # Split around separator words into segments
    segments = re.split(r"\s+(?:vs?\.?|versus|against|compared?\s+to)\s+", text, flags=re.IGNORECASE)

    if len(segments) >= 2:
        results = []
        for seg in segments:
            # Take last 1-2 words of each segment (likely the country name)
            words = [w.strip(".,?!") for w in seg.strip().split()]
            # Remove common skip/disease words from the end
            while words and words[-1].lower() in (DISEASE_WORDS | SKIP_WORDS):
                words.pop()
            if words:
                # Use last 1-3 meaningful words as country name
                country_words = words[-3:] if len(words) > 3 else words
                # Drop leading disease/skip words
                while country_words and country_words[0].lower() in (DISEASE_WORDS | SKIP_WORDS):
                    country_words.pop(0)
                if country_words:
                    name = " ".join(country_words).title()
                    if name.lower() not in DISEASE_WORDS and len(name) > 2:
                        results.append(name)
        if len(results) >= 2:
            return results

    # Fall back to capitalised tokens
    words = re.split(r"\s+", text)
    candidates = [
        w.strip(".,?!")
        for w in words
        if w and w[0].isupper() and w.strip(".,?!").lower() not in (DISEASE_WORDS | SKIP_WORDS)
    ]
    return candidates if candidates else [current_country]


def _classify_intent(msg: str) -> str:
    """Return one of: greet | compare | hotspot | alert | forecast | risk | navigate_disease | navigate_country | genomic | platform | unknown."""
    m = msg.lower()

    # Greet (check early — simple keywords)
    if any(w in m for w in ["hi", "hello", "hey", "howdy", "greetings", "good morning", "good evening"]):
        return "greet"

    # Hotspot MUST come before navigation (avoid "show me malaria hotspots" → navigate)
    if any(w in m for w in ["hotspot", "hotspots", "spike", "spikes", "worst", "highest", "top countries",
                             "most affected", "hardest hit", "emerging hotspot", "global hotspot"]):
        return "hotspot"

    # Navigation — disease switch
    nav_disease = re.search(
        r"\b(switch|change|navigate|go|show\s+me)\s+(?:to\s+|the\s+)?"
        r"(covid[-\s]?19?|coronavirus|flu|influenza|malaria|tb|tuberculosis|dengue(?:\s+fever)?)\b",
        m
    )
    if nav_disease:
        return "navigate_disease"
    nav_country = re.search(
        r"\b(go to|fly to|navigate to|take me to|open panel for|show me)\s+([a-zA-Z][a-zA-Z\s]{1,29}?)\s*$",
        msg, re.IGNORECASE
    )
    if nav_country:
        potential = nav_country.group(2).strip().lower()
        all_disease_kws = {kw for kws in DISEASE_KEYWORDS.values() for kw in kws}
        if potential not in all_disease_kws:
            return "navigate_country"

    if any(w in m for w in ["compare", " vs ", " v ", "versus", "difference", "comparison", "between"]):
        return "compare"

    if any(w in m for w in ["alert", "alerts", "warning", "warnings", "promed", "surveillance feed", "global outbreak"]):
        return "alert"

    if any(w in m for w in ["forecast", "predict", "projection", "future", "next year", "trend"]):
        return "forecast"

    if any(w in m for w in ["risk", "risk score", "risk level", "dangerous", "severity", "how bad"]):
        return "risk"

    if any(w in m for w in ["genomic", "strain", "variant", "gene", "mutation", "dna", "sequence", "clade"]):
        return "genomic"

    if any(w in m for w in ["tab", "dashboard", "what does", "how do i", "how to", "navigate", "feature", "classification", "therapeutics", "surveillance"]):
        return "platform"

    return "unknown"


# ── Response builders ──────────────────────────────────────────────────────────

def _risk_badge(score: float | None, scale100: bool = False) -> str:
    """score can be 0-1 (heatmap) or 0-100 (country_stats/risk endpoint). scale100=True for the latter."""
    if score is None:
        return "Unknown"
    s = float(score)
    # Normalise to 0-1
    if scale100 or s > 1:
        s = s / 100.0
    if s >= 0.75:
        return f"CRITICAL ({s*100:.0f}/100)"
    if s >= 0.5:
        return f"HIGH ({s*100:.0f}/100)"
    if s >= 0.25:
        return f"MODERATE ({s*100:.0f}/100)"
    return f"LOW ({s*100:.0f}/100)"


def _fmt_cases(n) -> str:
    try:
        v = int(n)
        if v >= 1_000_000:
            return f"{v/1_000_000:.1f}M"
        if v >= 1_000:
            return f"{v/1_000:.0f}K"
        return str(v)
    except Exception:
        return str(n)


async def _build_compare(countries: list[str], disease: str, ctx: dict) -> dict:
    """Fetch stats for up to 3 countries and format a comparison table."""
    disease = disease or ctx.get("disease", "covid")
    # Limit to first 3 unique
    targets = []
    seen = set()
    for c in countries:
        if c.lower() not in seen and len(targets) < 3:
            targets.append(c)
            seen.add(c.lower())

    # If only 1 country, auto-add top 2 from heatmap for a meaningful comparison
    if len(targets) <= 1:
        heatmap = await _get("/api/v1/globe/heatmap", {"disease": disease})
        if heatmap:
            points_raw = heatmap if isinstance(heatmap, list) else heatmap.get("points", [])
            top_countries = [p["country"] for p in sorted(points_raw, key=lambda p: p.get("cases", 0), reverse=True)
                             if p.get("country", "").lower() not in seen][:2]
            for tc in top_countries:
                if tc.lower() not in seen and len(targets) < 3:
                    targets.append(tc)
                    seen.add(tc.lower())

    rows = []
    for country in targets:
        data = await _get("/api/v1/country/stats", {"country": country, "disease": disease})
        if not data:
            continue
        rows.append({
            "country":    data.get("country", country),
            "cases":      data.get("total_cases", data.get("latest_cases", 0)),
            "deaths":     data.get("total_deaths", 0),
            "population": data.get("population", 1),
            "risk_score": data.get("risk_score"),          # 0-100 scale
            "risk_label": data.get("risk_label", data.get("risk_level", "?")),
            "growth_rate": data.get("growth_rate", 0),
        })

    if not rows:
        return {"reply": "I couldn't retrieve comparison data from the backend right now. Please ensure the backend server is running."}

    dname = DISEASE_NAMES.get(disease, disease.upper())
    lines = [f"{dname} — Country Comparison\n"]
    lines.append(f"{'Country':<22} {'Latest Cases':>14} {'Deaths':>9} {'Growth':>8}  Risk")
    lines.append("─" * 72)
    for r in rows:
        growth_str = f"{r['growth_rate']*100:+.1f}%" if r["growth_rate"] is not None else "N/A"
        lines.append(
            f"{r['country']:<22} {_fmt_cases(r['cases']):>14} {_fmt_cases(r['deaths']):>9} "
            f"{growth_str:>8}  {_risk_badge(r['risk_score'])}"
        )

    # Insight
    if len(rows) >= 2:
        top = max(rows, key=lambda x: (x.get("risk_score") or 0))
        low = min(rows, key=lambda x: (x.get("risk_score") or 0))
        lines.append(
            f"\nInsight: {top['country']} carries the highest {dname} risk score in this comparison. "
            f"{low['country']} shows a relatively lower burden."
        )

    return {"reply": "\n".join(lines)}


async def _build_hotspot(disease: str, ctx: dict) -> dict:
    disease = disease or ctx.get("disease", "covid")
    data = await _get("/api/v1/globe/heatmap", {"disease": disease})
    if not data:
        return {"reply": "Unable to retrieve hotspot data from the backend right now."}

    # Heatmap returns a list directly
    points_raw = data if isinstance(data, list) else data.get("points", [])
    points = sorted(points_raw, key=lambda p: p.get("cases", 0), reverse=True)
    top = points[:8]
    dname = DISEASE_NAMES.get(disease, disease.upper())

    lines = [f"Top {dname} Hotspots Globally\n"]
    lines.append(f"{'Rank':<5} {'Country':<28} {'Cases':>12}  Risk")
    lines.append("─" * 60)
    for i, p in enumerate(top, 1):
        # Heatmap risk_score is on 0-1 scale
        rs = p.get("risk_score", 0)
        label = "CRITICAL" if rs >= 0.75 else "HIGH" if rs >= 0.5 else "MODERATE" if rs >= 0.25 else "LOW"
        lines.append(
            f"{i:<5} {p.get('country', '?'):<28} {_fmt_cases(p.get('cases', 0)):>12}  {label}"
        )

    if top:
        leader = top[0]
        growth = leader.get("growth_rate")
        growth_str = f", growth {growth*100:+.1f}%/yr" if growth is not None else ""
        lines.append(
            f"\nEmerging concern: {leader.get('country')} leads with "
            f"{_fmt_cases(leader.get('cases', 0))} cases{growth_str}. "
            f"This region warrants close epidemiological monitoring."
        )

    return {"reply": "\n".join(lines)}


async def _build_alert(disease: str, ctx: dict) -> dict:
    disease = disease or ctx.get("disease", "all")
    data = await _get("/api/v1/alerts", {"disease": disease})
    if not data:
        return {"reply": "Unable to fetch outbreak alerts from surveillance feeds right now."}

    alerts = data.get("alerts", [])[:8]
    if not alerts:
        return {"reply": "No active outbreak alerts found for the selected disease at this time."}

    lines = [f"**⚠️ Active Outbreak Alerts** ({data.get('total', len(alerts))} total)\n"]
    for a in alerts:
        sev = a.get("severity", "?").upper()
        icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}.get(sev, "⚪")
        lines.append(f"{icon} **{sev}** — {a.get('title', 'Unknown alert')}")
        if a.get("country"):
            lines.append(f"   📍 {a['country']}")
        lines.append("")

    return {"reply": "\n".join(lines).strip()}


async def _build_forecast(country: str, disease: str, ctx: dict) -> dict:
    country = country or ctx.get("country", "India")
    disease = disease or ctx.get("disease", "covid")
    if disease == "flu":
        return {"reply": "Multi-year forecasting is not available for Influenza in this dataset. Try COVID-19, Malaria, TB, or Dengue for forecasts."}

    data = await _get("/api/v1/forecast", {"country": country, "disease": disease, "periods": 5})
    if not data:
        return {"reply": f"Forecast data for {country} is unavailable right now. The backend forecasting module may require more historical data."}

    dname = DISEASE_NAMES.get(disease, disease.upper())
    forecasts = data.get("forecast", [])
    method = data.get("method", "ML model")

    lines = [f"**📈 {dname} Forecast — {country}** (via {method})\n"]
    if forecasts:
        lines.append(f"{'Year':<8} {'Projected Cases':>18}")
        lines.append("─" * 28)
        for f in forecasts[:5]:
            year = f.get("ds", f.get("year", "?"))
            val  = f.get("yhat", f.get("cases", f.get("value", "?")))
            lines.append(f"{str(year):<8} {_fmt_cases(val):>18}")

        first = forecasts[0].get("yhat", forecasts[0].get("cases", 0))
        last  = forecasts[-1].get("yhat", forecasts[-1].get("cases", 0))
        if first and last:
            pct = ((last - first) / max(first, 1)) * 100
            direction = "increase" if pct > 0 else "decrease"
            lines.append(f"\n📊 **Trend:** Projected {abs(pct):.0f}% {direction} over the forecast window.")
            if pct > 20:
                lines.append("⚠️ This trajectory suggests escalating public health pressure — early intervention is recommended.")
    else:
        lines.append("No forecast data points returned.")

    return {"reply": "\n".join(lines)}


async def _build_risk(country: str, disease: str, ctx: dict) -> dict:
    country = country or ctx.get("country", "Unknown")
    disease = disease or ctx.get("disease", "covid")
    data = await _get("/api/v1/risk/score", {"country": country, "disease": disease})
    if not data:
        return {"reply": f"Risk score data for {country} is not available right now."}

    dname = DISEASE_NAMES.get(disease, disease.upper())
    # risk/score endpoint returns: score (0-100), label, latest_cases, growth_rate, prevalence_per_100k
    score_raw = data.get("score", data.get("risk_score", 0))
    label = data.get("label", data.get("risk_label", "?"))
    latest = data.get("latest_cases", 0)
    growth = data.get("growth_rate")
    prevalence = data.get("prevalence_per_100k")

    score_norm = float(score_raw) / 100.0

    lines = [f"{dname} Risk Assessment — {country}\n"]
    lines.append(f"Risk Score:  {score_raw}/100  ({label})")
    lines.append(f"Latest Cases: {_fmt_cases(latest)}")
    if growth is not None:
        trend_word = "rising" if growth > 0.05 else "declining" if growth < -0.05 else "stable"
        lines.append(f"Case Trend:  {trend_word} ({growth*100:+.1f}% YoY)")
    if prevalence is not None:
        lines.append(f"Prevalence:  {prevalence:.1f} per 100,000 population")

    if score_norm >= 0.75:
        lines.append("\nCritical-level risk. Immediate public health surveillance and resource mobilisation is advised.")
    elif score_norm >= 0.5:
        lines.append("\nHigh risk. Enhanced monitoring and preparedness measures are recommended.")
    elif score_norm >= 0.25:
        lines.append("\nModerate risk. Routine surveillance protocols are sufficient at this time.")
    else:
        lines.append("\nLow risk. Standard monitoring in place.")

    return {"reply": "\n".join(lines)}


def _build_greet(ctx: dict) -> dict:
    country = ctx.get("country", "the selected region")
    disease = DISEASE_NAMES.get(ctx.get("disease", ""), ctx.get("disease", "disease"))
    return {
        "reply": (
            f"Hello! I'm **Cosmo**, your AI Disease Intelligence Assistant on CosmoSentinel.\n\n"
            f"I can see you're currently viewing **{country}** for **{disease}**. "
            f"Here's what I can help you with:\n\n"
            f"• 🧭 **Navigate the dashboard** — Say 'Go to Japan' or 'Switch to dengue' to jump anywhere. For forecasting, open the **Surveillance** tab and scroll down to the Forecast section.\n"
            f"• 🌍 **Country comparisons** — Compare case counts, mortality, and risk scores\n"
            f"• 🔥 **Hotspot detection** — Find emerging disease hotspots globally\n"
            f"• 🧬 **Genomic analysis** — Strain and variant insights\n\n"
            f"What would you like to explore?"
        )
    }


def _build_genomic(ctx: dict) -> dict:
    disease = ctx.get("disease", "covid")
    country = ctx.get("country", "the selected region")
    dname = DISEASE_NAMES.get(disease, disease.upper())

    info = {
        "covid": (
            "**SARS-CoV-2 Genomic Landscape**\n\n"
            "Major variants of concern include Alpha (B.1.1.7), Delta (B.1.617.2), and Omicron (B.1.1.529) and its sub-lineages (XBB, BQ.1, JN.1). "
            "Key mutation sites: Spike protein (S), especially positions 484, 501, 614, and 681.\n\n"
            "**Impact:** Omicron sub-variants show significantly higher transmissibility but reduced severity vs Delta. "
            "Escape mutations at receptor-binding domain (RBD) reduce vaccine neutralisation efficiency.\n\n"
            "📊 For the Genomics tab in CosmoSentinel, key genes tracked include: ACE2, TMPRSS2, ORF1ab, S gene, N gene."
        ),
        "malaria": (
            "**Plasmodium Genomic Landscape**\n\n"
            "P. falciparum (most lethal) and P. vivax are the dominant species. "
            "Drug resistance is driven by mutations in: PfCRT (chloroquine resistance), PfKelch13 (artemisinin resistance — particularly C580Y in Southeast Asia), and DHFR/DHPS (antifolate resistance).\n\n"
            "**Regional impact:** Kelch13 mutations are most prevalent in Southeast Asia, including in the region you're viewing. "
            "This reduces first-line artemisinin combination therapy (ACT) efficacy."
        ),
        "tb": (
            "**Mycobacterium tuberculosis Genomic Landscape**\n\n"
            "Drug resistance is tracked via mutations in: rpoB (rifampicin resistance), katG & inhA (isoniazid resistance), gyrA/gyrB (fluoroquinolone resistance).\n\n"
            "**MDR-TB** (multidrug-resistant) and **XDR-TB** (extensively drug-resistant) strains are a critical global health threat. "
            "Whole-genome sequencing (WGS) is now the gold standard for resistance profiling."
        ),
        "dengue": (
            "**Dengue Virus (DENV) Genomic Landscape**\n\n"
            "Four serotypes (DENV-1 to DENV-4) circulate globally. Secondary infection with a different serotype carries risk of severe dengue (antibody-dependent enhancement — ADE).\n\n"
            "**Key genes:** E (envelope protein — serotype antigen), NS1 (diagnostic marker), NS3/NS5 (replication targets). "
            "Phylogenetic tracking of lineage shifts helps predict epidemic waves."
        ),
        "flu": (
            "**Influenza Genomic Landscape**\n\n"
            "Influenza A subtypes H1N1 and H3N2 dominate seasonal epidemics. Key surface antigens: Haemagglutinin (HA) and Neuraminidase (NA) — responsible for antigenic drift and shift.\n\n"
            "**Surveillance note:** Annual vaccine composition is updated based on global WHO flu surveillance data (FluNet) tracking dominant clades. "
            "Oseltamivir resistance is monitored via NA H274Y mutation."
        ),
    }

    base = info.get(disease, f"Genomic surveillance data for {dname} is tracked through disease-specific sequencing programmes.")
    return {
        "reply": f"{base}\n\n📍 *You are viewing {country}. For detailed gene-level data, check the **Genomics** tab in this panel.*"
    }


def _build_platform(msg: str) -> dict:
    m = msg.lower()

    if "surveillance" in m:
        return {"reply": (
            "**📡 Surveillance Tab**\n\n"
            "Displays real-time epidemiological data for the selected country and disease:\n"
            "• **Case count, deaths, and population** at a glance\n"
            "• **Trend chart** — historical case trajectory over time\n"
            "• **Anomaly detection** — IsolationForest ML model flags unusual spikes\n"
            "• **Spread simulator** — toggle public health interventions (masks, lockdowns, vaccines) and see projected impact on case counts\n\n"
            "Data sources: Disease.sh (COVID/Flu), WHO GHO (Malaria, TB, Dengue)"
        )}

    if "classification" in m:
        return {"reply": (
            "**🔬 Classification Tab**\n\n"
            "Provides standardised disease identity information:\n"
            "• **ICD-10 codes** — international diagnostic classification\n"
            "• **Taxonomy** — pathogen kingdom, genus, species\n"
            "• **Disease subtypes** — e.g. COVID variants, TB MDR/XDR\n"
            "• **Ontology references** — OMIM, MeSH, SNOMED-CT, ORDO links\n\n"
            "Useful for cross-referencing with clinical and research databases."
        )}

    if "genomic" in m:
        return {"reply": (
            "**🧬 Genomics Tab**\n\n"
            "Shows disease-associated genetic information:\n"
            "• **Gene list** with evidence scores from curated databases\n"
            "• **Gene-disease network graph** — interactive visualisation of gene relationships\n"
            "• Evidence tiers: Definitive / Strong / Moderate / Limited\n\n"
            "Based on data from DisGeNET, OMIM, and ClinVar."
        )}

    if "therapeut" in m:
        return {"reply": (
            "**💊 Therapeutics Tab**\n\n"
            "Lists treatment options for the selected disease:\n"
            "• **Approved drugs** with mechanism of action and approval status\n"
            "• **WHO essential medicines** designation\n"
            "• **Treatment summary** — first-line and second-line protocols\n"
            "• **Clinical trial status** where applicable\n\n"
            "Based on WHO, FDA, and EMA drug approval data."
        )}

    if "globe" in m or "heatmap" in m:
        return {"reply": (
            "**🌍 Globe View**\n\n"
            "The 3D interactive globe is CosmoSentinel's main view:\n"
            "• **Colour heatmap** — red = high risk, blue = low risk, intensity = case volume\n"
            "• **Click any country** → opens the detailed panel on the right\n"
            "• **Disease selector** — top-left dropdown switches between COVID, Flu, Malaria, TB, Dengue\n"
            "• **Region filter** — narrows the heatmap to a specific WHO region\n"
            "• **Arc overlays** — show disease spread pathways when active"
        )}

    # Generic platform help
    return {"reply": (
        "**CosmoSentinel — Dashboard Guide**\n\n"
        "**Main sections:**\n"
        "• 🌍 **Globe** — Interactive 3D heatmap (click a country to open its panel)\n"
        "• 📡 **Surveillance** — Cases, trends, anomaly detection, spread simulator\n"
        "• 🔬 **Classification** — ICD codes, taxonomy, ontology references\n"
        "• 🧬 **Genomics** — Gene associations, evidence scores, network graph\n"
        "• 💊 **Therapeutics** — Approved drugs, WHO medicines, treatment protocols\n"
        "• 🤖 **AI Chatbot** (here) — Natural language queries and navigation\n\n"
        "Ask me about any specific tab or feature for more detail!"
    )}


# ── Navigation helpers ─────────────────────────────────────────────────────────

def _extract_nav_disease(msg: str) -> str | None:
    m = msg.lower()
    for key, kws in DISEASE_KEYWORDS.items():
        if any(kw in m for kw in kws):
            return key
    return None


def _extract_nav_country(msg: str) -> str | None:
    """Extract country name from a 'show me X' / 'go to X' type message."""
    match = re.search(
        r"\b(?:go to|show me|fly to|open|navigate to|take me to|view)\s+([a-zA-Z][a-zA-Z\s]{1,29}?)\s*(?:panel|data|stats|statistics|dashboard)?\s*$",
        msg,
        re.IGNORECASE,
    )
    if match:
        candidate = match.group(1).strip().title()
        # Exclude disease names
        all_disease_kws = {kw for kws in DISEASE_KEYWORDS.values() for kw in kws}
        if candidate.lower() in all_disease_kws:
            return None
        return candidate
    return None


# ── Optional LLM layer ─────────────────────────────────────────────────────────

def _try_get_llm_client():
    """Return (client_type, client) tuple or (None, None) if no key available."""
    # Try Anthropic
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if key and len(key) > 10:
        try:
            import anthropic
            return "anthropic", anthropic.Anthropic(api_key=key)
        except Exception:
            pass

    # Try Groq
    key = os.getenv("GROQ_API_KEY", "")
    if key and len(key) > 10:
        try:
            from groq import Groq  # type: ignore
            return "groq", Groq(api_key=key)
        except Exception:
            pass

    return None, None


# ── Main chat function ─────────────────────────────────────────────────────────

async def chat(message: str, context: dict) -> dict:
    """
    Process a user message and return Cosmo's reply.

    Args:
        message: The user's question / request
        context: Dict with keys: country, disease, cases, riskScore, region

    Returns:
        Dict with keys: reply (str), action? (dict with optional disease/country keys)
    """
    country  = context.get("country", "Unknown")
    disease  = context.get("disease", "covid")
    region   = context.get("region", "Unknown")

    intent = _classify_intent(message)
    detected_disease = _detect_disease(message) or disease

    # ── Navigation: disease switch ─────────────────────────────────────────────
    if intent == "navigate_disease":
        nav_d = _extract_nav_disease(message) or detected_disease
        dname = DISEASE_NAMES.get(nav_d, nav_d.upper())
        return {
            "reply": f"🌍 Switching the globe to **{dname}**...",
            "action": {"disease": nav_d},
        }

    # ── Navigation: fly to country ─────────────────────────────────────────────
    if intent == "navigate_country":
        nav_c = _extract_nav_country(message)
        if nav_c:
            return {
                "reply": f"🌍 Navigating to **{nav_c}**...",
                "action": {"country": nav_c},
            }

    # ── Greeting ───────────────────────────────────────────────────────────────
    if intent == "greet":
        return _build_greet(context)

    # ── Platform / dashboard help ──────────────────────────────────────────────
    if intent == "platform":
        return _build_platform(message)

    # ── Genomic / strain analysis ──────────────────────────────────────────────
    if intent == "genomic":
        return _build_genomic(context)

    # ── Data-driven intents (require backend) ──────────────────────────────────
    if intent == "compare":
        countries = _detect_countries(message, country)
        return await _build_compare(countries, detected_disease, context)

    if intent == "hotspot":
        return await _build_hotspot(detected_disease, context)

    if intent == "alert":
        return await _build_alert(detected_disease, context)

    if intent == "forecast":
        countries = _detect_countries(message, country)
        target = countries[0] if countries else country
        return await _build_forecast(target, detected_disease, context)

    if intent == "risk":
        countries = _detect_countries(message, country)
        target = countries[0] if countries else country
        return await _build_risk(target, detected_disease, context)

    # ── Unknown intent: try LLM if key available, else inform ─────────────────
    llm_type, llm_client = _try_get_llm_client()

    if llm_type == "anthropic":
        try:
            resp = llm_client.messages.create(
                model="claude-3-5-haiku-20241022",
                system=(
                    f"You are Cosmo, an AI assistant on CosmoSentinel disease dashboard. "
                    f"Currently viewing: {country} · {disease}. Region: {region}. "
                    f"Answer concisely in plain text. No markdown headers. Be analytical."
                ),
                messages=[{"role": "user", "content": message}],
                max_tokens=512,
            )
            text = ""
            for block in resp.content:
                if hasattr(block, "text"):
                    text = block.text.strip()
                    break
            if text:
                return {"reply": text}
        except Exception as e:
            logger.warning("Anthropic LLM fallback failed: %s", e)

    if llm_type == "groq":
        try:
            resp = llm_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": (
                        f"You are Cosmo, an AI assistant on CosmoSentinel disease dashboard. "
                        f"Currently viewing: {country} · {disease}. Region: {region}. "
                        f"Answer concisely and analytically."
                    )},
                    {"role": "user", "content": message},
                ],
                max_tokens=512,
                temperature=0.3,
            )
            text = resp.choices[0].message.content or ""
            if text.strip():
                return {"reply": text.strip()}
        except Exception as e:
            logger.warning("Groq LLM fallback failed: %s", e)

    # ── Final fallback: try to be helpful with what we know ───────────────────
    # Maybe the question relates to the current country — fetch its stats and offer insight
    data = await _get("/api/v1/country/stats", {"country": country, "disease": disease})
    if data:
        dname = DISEASE_NAMES.get(disease, disease.upper())
        cases = data.get("total_cases", data.get("latest_cases", 0))
        deaths = data.get("total_deaths", 0)
        rs = data.get("risk_score")
        return {
            "reply": (
                f"Here's what I can share about {country} for {dname}:\n\n"
                f"Cases: {_fmt_cases(cases)}  |  Deaths: {_fmt_cases(deaths)}  |  "
                f"Risk: {_risk_badge(rs)}\n\n"
                f"For deeper analysis, try:\n"
                f'- "Compare {country} vs [another country]"\n'
                f'- "Show hotspots for {dname}"\n'
                f'- "Forecast for {country}"\n'
                f'- "Any outbreak alerts?"'
            )
        }

    return {
        "reply": (
            'I\'m not sure how to answer that specific query right now. Try one of these:\n\n'
            '• Navigate: "Switch to dengue" or "Show me Japan"\n'
            '• Compare: "Compare India vs Malaysia for malaria"\n'
            '• Hotspots: "Show hotspots for malaria"\n'
            '• Forecast: "Forecast for India"\n'
            '• Alerts: "Any outbreak alerts?"'
        )
    }
