"""
AquaGuard Dakhla – mock forecast engine.

For the hackathon demo we do NOT run live inference. This module produces a
deterministic, physically plausible 72-hour HAB (harmful algal bloom) scenario:
an offshore bloom born in the Canary-current upwelling zone, drifting south-east
toward the peninsula, then entering the Dakhla lagoon through its southern mouth.

Same inputs -> same outputs, every time. The demo cannot crash or drift.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent

# ---- Grid --------------------------------------------------------------------
LAT_MIN, LAT_MAX = 23.30, 24.25
LON_MIN, LON_MAX = -16.50, -15.45
STEP = 0.01                     # ~1.1 km cells
HOURS = list(range(0, 73, 3))   # 0, 3, ... 72

LATS = np.round(np.arange(LAT_MAX, LAT_MIN - 1e-9, -STEP), 4)  # north -> south (image rows)
LONS = np.round(np.arange(LON_MIN, LON_MAX + 1e-9, STEP), 4)   # west -> east (image cols)

# ---- Economic zones ----------------------------------------------------------
ZONES = [
    {
        "id": "aquaculture",
        "name": "Zone Aquacole de Boutalha",
        "short": "Boutalha",
        "sector": "aquaculture",
        "lat": 23.742, "lon": -15.866,
        "description": "Parcs ostréicoles et conchylicoles de la lagune.",
        "stakeholders": 38,
        "asset_value_mdh": 210,
    },
    {
        "id": "fishcages",
        "name": "Cages Piscicoles Atlantique",
        "short": "Cages offshore",
        "sector": "aquaculture",
        "lat": 23.590, "lon": -16.060,
        "description": "Fermes de bars et dorades en cages offshore.",
        "stakeholders": 6,
        "asset_value_mdh": 145,
    },
    {
        "id": "desalination",
        "name": "Station de Dessalement de Dakhla",
        "short": "Dessalement",
        "sector": "water",
        "lat": 23.700, "lon": -15.995,
        "description": "Prise d'eau de mer – filtres à osmose inverse.",
        "stakeholders": 1,
        "asset_value_mdh": 1300,
    },
    {
        "id": "tourism",
        "name": "Baie Touristique & Kitesurf",
        "short": "Baie Kitesurf",
        "sector": "tourism",
        "lat": 23.872, "lon": -15.800,
        "description": "Spots de kitesurf, hôtels et plages de la lagune.",
        "stakeholders": 24,
        "asset_value_mdh": 380,
    },
    {
        "id": "port",
        "name": "Port Dakhla Atlantique",
        "short": "Port Atlantique",
        "sector": "logistics",
        "lat": 24.105, "lon": -15.575,   # approximate (N'Tireft area)
        "description": "Hub logistique et halieutique en développement.",
        "stakeholders": 12,
        "asset_value_mdh": 10000,
    },
]

SECTOR_LABEL = {
    "aquaculture": "Aquaculture & Pêche",
    "water": "Eau & Transition Verte",
    "tourism": "Tourisme",
    "logistics": "Port & Logistique",
}

# ---- Land mask -----------------------------------------------------------------
def _point_in_poly(x: np.ndarray, y: np.ndarray, poly: list[list[float]]) -> np.ndarray:
    """Vectorised ray casting. poly = [[lon, lat], ...]."""
    inside = np.zeros(x.shape, dtype=bool)
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        cond = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi)
        inside ^= cond
        j = i
    return inside


@lru_cache
def land_geojson() -> dict:
    return json.loads((HERE / "dakhla_land.json").read_text())


@lru_cache
def grids():
    lon2d, lat2d = np.meshgrid(LONS, LATS)
    ring = land_geojson()["coordinates"][0]
    land = _point_in_poly(lon2d, lat2d, ring)
    return lat2d, lon2d, land


# ---- Bloom physics (scripted) --------------------------------------------------
def _lerp(a, b, t):
    return a + (b - a) * t


def _smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


@lru_cache
def _texture():
    """Fixed fractal noise so the bloom looks filamentary, not like a perfect blob."""
    rng = np.random.default_rng(42)
    lat2d, _, _ = grids()
    h, w = lat2d.shape
    acc = np.zeros((h, w))
    for scale, amp in [(4, 1.0), (8, 0.5), (16, 0.25), (32, 0.12)]:
        coarse = rng.random((h // scale + 2, w // scale + 2))
        ys = np.linspace(0, coarse.shape[0] - 1.001, h)
        xs = np.linspace(0, coarse.shape[1] - 1.001, w)
        y0 = ys.astype(int); x0 = xs.astype(int)
        fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
        c = coarse
        v = (c[y0][:, x0] * (1 - fx) * (1 - fy) + c[y0][:, x0 + 1] * fx * (1 - fy)
             + c[y0 + 1][:, x0] * (1 - fx) * fy + c[y0 + 1][:, x0 + 1] * fx * fy)
        acc += amp * v
    acc = (acc - acc.min()) / (acc.max() - acc.min())
    return acc


def _gauss(lat2d, lon2d, clat, clon, sy, sx, angle_deg=0.0):
    a = math.radians(angle_deg)
    dy = (lat2d - clat)
    dx = (lon2d - clon) * math.cos(math.radians(clat))
    u = dx * math.cos(a) + dy * math.sin(a)
    v = -dx * math.sin(a) + dy * math.cos(a)
    return np.exp(-(u ** 2 / (2 * sx ** 2) + v ** 2 / (2 * sy ** 2)))


def _blur(a: np.ndarray, passes: int = 2) -> np.ndarray:
    """Cheap separable 1-2-1 smoothing (keeps the backend numpy-only)."""
    for _ in range(passes):
        a = np.pad(a, 1, mode="edge")
        a = (a[:-2] + 2 * a[1:-1] + a[2:]) / 4
        a = (a[:, :-2] + 2 * a[:, 1:-1] + a[:, 2:]) / 4
    return a


@lru_cache(maxsize=128)
def risk_field(hour: float) -> np.ndarray:
    """Risk index 0..100 for every grid cell at `hour` (0..72)."""
    hour = float(min(max(hour, 0), 72))
    lat2d, lon2d, land = grids()
    t = hour / 72.0
    tex = _texture()

    # 1) Main offshore bloom: upwelling filament drifting SE toward the peninsula.
    c1 = (_lerp(23.98, 23.72, _smooth(t)), _lerp(-16.36, -16.05, _smooth(t)))
    f1 = (0.55 + 0.45 * t) * _gauss(lat2d, lon2d, *c1, sy=0.10 + 0.03 * t, sx=0.06 + 0.02 * t, angle_deg=-35)

    # 2) Southern lobe heading for the lagoon mouth (fish cages on the way).
    c2 = (_lerp(23.42, 23.60, _smooth(t)), _lerp(-16.25, -15.99, _smooth(t)))
    f2 = (0.35 + 0.55 * t) * _gauss(lat2d, lon2d, *c2, sy=0.06, sx=0.08 + 0.02 * t, angle_deg=30)

    # 3) Intrusion inside the lagoon, carried by the flood tide (starts ~ +30h).
    t3 = _smooth((hour - 30) / 42)
    # Elongated along the lagoon axis (~68° from east).
    c3 = (_lerp(23.60, 23.775, t3), _lerp(-15.93, -15.85, t3))
    f3 = 1.05 * t3 * _gauss(lat2d, lon2d, *c3, sy=0.03, sx=0.04 + 0.05 * t3, angle_deg=68)

    # 4) Background chlorophyll along the upwelling front.
    bg = 0.18 * _gauss(lat2d, lon2d, 23.8, -16.40, sy=0.4, sx=0.08)

    field = np.maximum.reduce([f1, f2, f3]) + bg
    # Filament texture, advected slightly with time
    shift = int(round(t * 6))
    tx = np.roll(np.roll(tex, shift, axis=0), shift, axis=1)
    field = field * (0.65 + 0.55 * tx)
    field = _blur(np.clip(field * 100, 0, 100), passes=2)
    field[land] = 0
    return field


# ---- Derived products ------------------------------------------------------------
def level(score: float) -> str:
    if score >= 65:
        return "high"
    if score >= 35:
        return "moderate"
    return "low"


def zone_score(zone: dict, hour: float, radius_km: float = 4.0) -> float:
    lat2d, lon2d, land = grids()
    f = risk_field(hour)
    dy = (lat2d - zone["lat"]) * 111
    dx = (lon2d - zone["lon"]) * 111 * math.cos(math.radians(zone["lat"]))
    m = (dx ** 2 + dy ** 2 <= radius_km ** 2) & ~land
    if not m.any():
        return 0.0
    vals = f[m]
    return float(round(0.6 * vals.max() + 0.4 * vals.mean(), 1))


def confidence(hour: float) -> int:
    return int(round(95 - 0.30 * hour))


RECOMMENDATIONS = {
    "aquaculture": {
        "high": ["Récolter en urgence les lots commercialisables",
                 "Suspendre les ventes – analyses toxines (ONSSA)",
                 "Immerger / déplacer les cages hors de la trajectoire"],
        "moderate": ["Avancer le calendrier de récolte",
                     "Renforcer l'échantillonnage phytoplancton",
                     "Préparer le plan de repli des cages"],
        "low": ["Surveillance de routine", "Aucune action requise"],
    },
    "water": {
        "high": ["Réduire le débit de pompage de 40 %",
                 "Activer la pré-filtration renforcée (DAF / coagulation)",
                 "Programmer un nettoyage préventif des membranes RO"],
        "moderate": ["Augmenter la fréquence de mesure du SDI",
                     "Pré-positionner les produits de coagulation"],
        "low": ["Fonctionnement nominal"],
    },
    "tourism": {
        "high": ["Fermer temporairement les spots de kitesurf",
                 "Afficher le drapeau sanitaire sur les plages",
                 "Notifier hôtels et écoles de kite"],
        "moderate": ["Informer les clubs et visiteurs",
                     "Déconseiller la baignade prolongée"],
        "low": ["Conditions sanitaires normales"],
    },
    "logistics": {
        "high": ["Contrôler les eaux de ballast entrantes",
                 "Informer la capitainerie et les armateurs"],
        "moderate": ["Surveillance renforcée des rejets portuaires"],
        "low": ["Opérations normales"],
    },
}


def zone_status(zone: dict, hour: float) -> dict:
    s = zone_score(zone, hour)
    lvl = level(s)
    eta = None
    for h in HOURS:
        if zone_score(zone, h) >= 65:
            eta = h
            break
    trend = [zone_score(zone, h) for h in HOURS]
    return {
        **zone,
        "sector_label": SECTOR_LABEL[zone["sector"]],
        "score": s,
        "level": lvl,
        "eta_high_hours": eta,
        "trend": trend,
        "actions": RECOMMENDATIONS[zone["sector"]][lvl],
    }


def conditions(hour: float) -> dict:
    """Mock oceanographic readings (buoys + Sentinel-3 OLCI/SLSTR)."""
    f = risk_field(hour)
    _, _, land = grids()
    water = f[~land]
    mean_r = float(water.mean())
    return {
        "chlorophyll_mg_m3": round(0.8 + float(np.percentile(water, 99)) * 0.14, 1),
        "sst_c": round(19.4 + 0.012 * hour + 0.6 * math.sin(hour / 12 * math.pi), 1),
        "salinity_psu": round(36.4 - 0.002 * hour, 2),
        "current_speed_ms": round(0.28 + 0.06 * math.sin(hour / 6.2 * math.pi), 2),
        "current_dir_deg": 145,
        "wind_speed_kt": round(18 + 4 * math.sin(hour / 9 * math.pi), 0),
        "wind_dir_deg": 20,
        "bloom_area_km2": int((water >= 35).sum() * (STEP * 111) ** 2 * math.cos(math.radians(23.8))),
        "mean_risk": round(mean_r, 1),
    }


def forecast_frame(hour: float) -> dict:
    zones = [zone_status(z, hour) for z in ZONES]
    return {
        "hour": hour,
        "confidence": confidence(hour),
        "conditions": conditions(hour),
        "zones": zones,
        "global_index": round(max(z["score"] for z in zones), 1),
    }


def grid_payload() -> dict:
    """All 25 frames as compact int arrays (row-major, north->south, west->east)."""
    return {
        "bounds": {"lat_min": float(LATS.min()), "lat_max": float(LATS.max()),
                   "lon_min": float(LONS.min()), "lon_max": float(LONS.max())},
        "rows": int(len(LATS)),
        "cols": int(len(LONS)),
        "hours": HOURS,
        "frames": [risk_field(h).round().astype(int).ravel().tolist() for h in HOURS],
    }


def full_bundle() -> dict:
    return {
        "meta": {
            "project": "AquaGuard Dakhla",
            "model": "HAB-UNet-Forecast v0.3 (demo scenario)",
            "sources": ["Copernicus Sentinel-3 OLCI", "Sentinel-2 MSI", "CMEMS courants", "Bouées locales"],
            "issued_at": "2026-10-28T06:00:00Z",
        },
        "zones": ZONES,
        "land": land_geojson(),
        "grid": grid_payload(),
        "frames": [forecast_frame(h) for h in HOURS],
    }
