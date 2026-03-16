"""
CosmoSentinel — Shared Configuration
API base URLs, country coordinates, ISO code mappings, and constants.
"""

from pathlib import Path

# ─── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent
CACHE_DIR = BASE_DIR / "cache"

# ─── API Base URLs ─────────────────────────────────────────────────────────────
DISEASE_SH_BASE = "https://disease.sh/v3"
WHO_GHO_BASE    = "https://ghoapi.azureedge.net/api"
CDC_BASE        = "https://data.cdc.gov/resource"
ECDC_BASE       = "https://opendata.ecdc.europa.eu"
FLUVIEW_RSS     = "https://tools.cdc.gov/api/v2/resources/media/277634.rss"
PROMED_RSS      = "https://www.promedmail.org/feed/"
HEALTHMAP_API   = "https://healthmap.org/HMapi.php"

# ─── WHO GHO Indicator Codes ───────────────────────────────────────────────────
WHO_INDICATORS = {
    "malaria": "MALARIA_EST_CASES",
    "tb":      "MDG_0000000020",   # TB incidence per 100k population
    "dengue":  "DENGUE_CASES",
}

# ─── CDC Socrata Dataset IDs ───────────────────────────────────────────────────
CDC_DATASETS = {
    "covid_deaths": "r8kw-7aab",   # COVID-19 Deaths by State and Cause
    "flu_ili":      "pk44-trjp",   # US ILI Weekly Surveillance
    "nndss":        "x9gk-5huc",   # National Notifiable Disease Surveillance
}

# ─── Country Coordinates + Population ─────────────────────────────────────────
# Format: "Country Name": (lat, lng, population)
COUNTRY_COORDS: dict[str, tuple[float, float, int]] = {
    "Afghanistan": (33.93, 67.71, 40099462),
    "Algeria": (28.03, 1.66, 44903225),
    "Angola": (-11.20, 17.87, 34503774),
    "Bangladesh": (23.68, 90.35, 166303498),
    "Brazil": (-14.24, -51.93, 214326223),
    "Burkina Faso": (12.36, -1.53, 21497096),
    "Burundi": (-3.37, 29.92, 12255433),
    "Cambodia": (12.57, 104.99, 16589023),
    "Cameroon": (7.37, 12.35, 27224265),
    "Central African Republic": (6.61, 20.94, 4829767),
    "Chad": (15.45, 18.73, 17413580),
    "China": (35.86, 104.19, 1411750000),
    "Colombia": (4.57, -74.30, 51197000),
    "Democratic Republic of the Congo": (-4.04, 21.76, 99010212),
    "Ethiopia": (9.14, 40.49, 120283026),
    "Ghana": (7.95, -1.02, 32395450),
    "Guinea": (9.95, -9.70, 13531906),
    "India": (20.59, 78.96, 1393409038),
    "Indonesia": (-0.79, 113.92, 277534122),
    "Kenya": (-0.02, 37.91, 54985698),
    "Madagascar": (-18.77, 46.87, 27691019),
    "Malawi": (-13.25, 34.30, 19129952),
    "Mali": (17.57, -3.99, 22414000),
    "Mozambique": (-18.67, 35.53, 32163047),
    "Myanmar": (21.91, 95.96, 54417000),
    "Niger": (17.61, 8.08, 25252000),
    "Nigeria": (9.08, 8.68, 213401323),
    "Pakistan": (30.38, 69.35, 225199937),
    "Philippines": (12.88, 121.77, 111046913),
    "Papua New Guinea": (-6.31, 143.96, 9119896),
    "Rwanda": (-1.94, 29.87, 13461888),
    "Senegal": (14.50, -14.45, 17196301),
    "Sierra Leone": (8.46, -11.78, 8141343),
    "Somalia": (5.15, 46.20, 17065581),
    "South Africa": (-30.56, 22.94, 60041995),
    "South Sudan": (7.86, 29.69, 11381000),
    "Sudan": (12.86, 30.22, 44909353),
    "Tanzania": (-6.37, 34.89, 63298550),
    "Thailand": (15.87, 100.99, 71601103),
    "Uganda": (1.37, 32.29, 47123531),
    "United States": (37.09, -95.71, 332915073),
    "USA": (37.09, -95.71, 332915073),
    "Vietnam": (14.06, 108.28, 97338583),
    "Zambia": (-13.13, 27.85, 18920651),
    "Zimbabwe": (-19.02, 29.15, 15092171),
    # European countries (for ECDC data)
    "Austria": (47.52, 14.55, 9006398),
    "Belgium": (50.50, 4.47, 11589623),
    "Bulgaria": (42.73, 25.49, 6520314),
    "Croatia": (45.10, 15.20, 4047200),
    "Cyprus": (35.13, 33.43, 1207359),
    "Czechia": (49.82, 15.47, 10708981),
    "Czech Republic": (49.82, 15.47, 10708981),
    "Denmark": (56.26, 9.50, 5792202),
    "Estonia": (58.60, 25.01, 1326535),
    "Finland": (61.92, 25.75, 5540720),
    "France": (46.23, 2.21, 67391582),
    "Germany": (51.17, 10.45, 83883596),
    "Greece": (39.07, 21.82, 10718565),
    "Hungary": (47.16, 19.50, 9660351),
    "Iceland": (64.96, -19.02, 341243),
    "Ireland": (53.41, -8.24, 4937786),
    "Italy": (41.87, 12.57, 60367477),
    "Latvia": (56.88, 24.60, 1886198),
    "Liechtenstein": (47.14, 9.55, 38128),
    "Lithuania": (55.17, 23.88, 2722289),
    "Luxembourg": (49.82, 6.13, 625978),
    "Malta": (35.94, 14.38, 441543),
    "Netherlands": (52.13, 5.29, 17134872),
    "Norway": (60.47, 8.47, 5379475),
    "Poland": (51.92, 19.15, 37950802),
    "Portugal": (39.40, -8.22, 10196709),
    "Romania": (45.94, 24.97, 19237691),
    "Slovakia": (48.67, 19.70, 5459642),
    "Slovenia": (46.15, 14.99, 2078938),
    "Spain": (40.46, -3.75, 46754778),
    "Sweden": (60.13, 18.64, 10099265),
    "United Kingdom": (55.38, -3.44, 67886011),
    "UK": (55.38, -3.44, 67886011),
    # Additional countries for broader coverage
    "Mexico": (23.63, -102.55, 130262216),
    "Argentina": (-38.42, -63.62, 45195774),
    "Peru": (-9.19, -75.02, 32971854),
    "Venezuela": (6.42, -66.59, 28435943),
    "Ecuador": (-1.83, -78.18, 17993166),
    "Bolivia": (-16.29, -63.59, 11673021),
    "Chile": (-35.68, -71.54, 19116201),
    "Egypt": (26.82, 30.80, 104258327),
    "Morocco": (31.79, -7.09, 37344795),
    "Tunisia": (33.89, 9.54, 11818619),
    "Turkey": (38.96, 35.24, 84339067),
    "Iran": (32.43, 53.69, 85028759),
    "Iraq": (33.22, 43.68, 40222493),
    "Saudi Arabia": (23.89, 45.08, 35340683),
    "Yemen": (15.55, 48.52, 32981641),
    "Japan": (36.20, 138.25, 125681593),
    "South Korea": (35.91, 127.77, 51269185),
    "Malaysia": (4.21, 101.98, 32365999),
    "Sri Lanka": (7.87, 80.77, 21413249),
    "Nepal": (28.39, 84.12, 29136808),
    "Australia": (-25.27, 133.78, 25499884),
    "Russia": (61.52, 105.32, 145912025),
    "Ukraine": (48.38, 31.17, 44134693),
    "Kazakhstan": (48.02, 66.92, 19196765),
}

# ─── ISO3 → Country Name mapping (for WHO GHO) ────────────────────────────────
ISO3_TO_NAME: dict[str, str] = {
    "AFG": "Afghanistan", "ALB": "Albania", "DZA": "Algeria",
    "AGO": "Angola", "ARG": "Argentina", "ARM": "Armenia",
    "AUS": "Australia", "AUT": "Austria", "AZE": "Azerbaijan",
    "BGD": "Bangladesh", "BLR": "Belarus", "BEL": "Belgium",
    "BLZ": "Belize", "BEN": "Benin", "BTN": "Bhutan",
    "BOL": "Bolivia", "BIH": "Bosnia and Herzegovina", "BWA": "Botswana",
    "BRA": "Brazil", "BRN": "Brunei", "BGR": "Bulgaria",
    "BFA": "Burkina Faso", "BDI": "Burundi", "CPV": "Cape Verde",
    "KHM": "Cambodia", "CMR": "Cameroon", "CAN": "Canada",
    "CAF": "Central African Republic", "TCD": "Chad", "CHL": "Chile",
    "CHN": "China", "COL": "Colombia", "COD": "Democratic Republic of the Congo",
    "COG": "Republic of Congo", "CRI": "Costa Rica", "CIV": "Ivory Coast",
    "HRV": "Croatia", "CUB": "Cuba", "CYP": "Cyprus",
    "CZE": "Czechia", "DNK": "Denmark", "DJI": "Djibouti",
    "DOM": "Dominican Republic", "ECU": "Ecuador", "EGY": "Egypt",
    "SLV": "El Salvador", "GNQ": "Equatorial Guinea", "ERI": "Eritrea",
    "EST": "Estonia", "SWZ": "Eswatini", "ETH": "Ethiopia",
    "FIN": "Finland", "FRA": "France", "GAB": "Gabon",
    "GMB": "Gambia", "GEO": "Georgia", "DEU": "Germany",
    "GHA": "Ghana", "GRC": "Greece", "GTM": "Guatemala",
    "GIN": "Guinea", "GNB": "Guinea-Bissau", "HTI": "Haiti",
    "HND": "Honduras", "HUN": "Hungary", "ISL": "Iceland",
    "IND": "India", "IDN": "Indonesia", "IRN": "Iran",
    "IRQ": "Iraq", "IRL": "Ireland", "ISR": "Israel",
    "ITA": "Italy", "JAM": "Jamaica", "JPN": "Japan",
    "JOR": "Jordan", "KAZ": "Kazakhstan", "KEN": "Kenya",
    "PRK": "North Korea", "KOR": "South Korea", "KWT": "Kuwait",
    "KGZ": "Kyrgyzstan", "LAO": "Laos", "LVA": "Latvia",
    "LBN": "Lebanon", "LSO": "Lesotho", "LBR": "Liberia",
    "LBY": "Libya", "LIE": "Liechtenstein", "LTU": "Lithuania",
    "LUX": "Luxembourg", "MDG": "Madagascar", "MWI": "Malawi",
    "MYS": "Malaysia", "MDV": "Maldives", "MLI": "Mali",
    "MLT": "Malta", "MRT": "Mauritania", "MUS": "Mauritius",
    "MEX": "Mexico", "MDA": "Moldova", "MNG": "Mongolia",
    "MNE": "Montenegro", "MAR": "Morocco", "MOZ": "Mozambique",
    "MMR": "Myanmar", "NAM": "Namibia", "NPL": "Nepal",
    "NLD": "Netherlands", "NZL": "New Zealand", "NIC": "Nicaragua",
    "NER": "Niger", "NGA": "Nigeria", "MKD": "North Macedonia",
    "NOR": "Norway", "OMN": "Oman", "PAK": "Pakistan",
    "PAN": "Panama", "PNG": "Papua New Guinea", "PRY": "Paraguay",
    "PER": "Peru", "PHL": "Philippines", "POL": "Poland",
    "PRT": "Portugal", "QAT": "Qatar", "ROU": "Romania",
    "RUS": "Russia", "RWA": "Rwanda", "SAU": "Saudi Arabia",
    "SEN": "Senegal", "SRB": "Serbia", "SLE": "Sierra Leone",
    "SOM": "Somalia", "ZAF": "South Africa", "SSD": "South Sudan",
    "ESP": "Spain", "LKA": "Sri Lanka", "SDN": "Sudan",
    "SWE": "Sweden", "CHE": "Switzerland", "SYR": "Syria",
    "TWN": "Taiwan", "TJK": "Tajikistan", "TZA": "Tanzania",
    "THA": "Thailand", "TLS": "Timor-Leste", "TGO": "Togo",
    "TTO": "Trinidad and Tobago", "TUN": "Tunisia", "TUR": "Turkey",
    "TKM": "Turkmenistan", "UGA": "Uganda", "UKR": "Ukraine",
    "ARE": "United Arab Emirates", "GBR": "United Kingdom",
    "USA": "United States", "URY": "Uruguay", "UZB": "Uzbekistan",
    "VEN": "Venezuela", "VNM": "Vietnam", "YEM": "Yemen",
    "ZMB": "Zambia", "ZWE": "Zimbabwe",
}
