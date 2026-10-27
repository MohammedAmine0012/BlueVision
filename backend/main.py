"""
BlueVision Dakhla – FastAPI data engine (demo mode).

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import engine

app = FastAPI(
    title="BlueVision Dakhla API",
    description="Météo des risques marins – prévision HAB à 72 h (mode démo, données simulées).",
    version="0.3.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "demo", "model": "HAB-UNet-Forecast v0.3"}


@app.get("/api/bundle")
def bundle():
    """Everything the dashboard needs in one call (zones, coastline, 25 grid frames, KPIs)."""
    return engine.full_bundle()


@app.get("/api/zones")
def zones():
    return engine.ZONES


@app.get("/api/forecast")
def forecast(hour: int = Query(0, ge=0, le=72, description="Horizon de prévision en heures")):
    """Risk scores, alerts and conditions for a given horizon (0, 24, 48, 72 …)."""
    return engine.forecast_frame(hour)


@app.get("/api/zones/{zone_id}")
def zone(zone_id: str, hour: int = Query(0, ge=0, le=72)):
    z = next((z for z in engine.ZONES if z["id"] == zone_id), None)
    if not z:
        raise HTTPException(404, "Zone inconnue")
    return engine.zone_status(z, hour)


@app.post("/api/alerts/{zone_id}")
def send_alert(zone_id: str, hour: int = 0):
    """Simulates dispatching SMS / WhatsApp / e-mail alerts to the zone's stakeholders."""
    z = next((z for z in engine.ZONES if z["id"] == zone_id), None)
    if not z:
        raise HTTPException(404, "Zone inconnue")
    st = engine.zone_status(z, hour)
    return {
        "sent": True,
        "zone": z["name"],
        "recipients": z["stakeholders"],
        "channels": ["SMS", "WhatsApp", "E-mail"],
        "level": st["level"],
    }
