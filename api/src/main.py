"""
main.py

API d'analyse de trajectoires. Trois routes : /health, /systems, /analyze.
Toute la logique métier est dans `analysis.analyzers` — ce fichier ne
fait que le routing et l'orchestration.
"""

import math

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .analysis import (
    CompositeAnalyzer,
    LyapunovAnalyzer,
    SpectralAnalyzer,
    StatsAnalyzer,
)
from .schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    DivergenceCurve,
    HealthResponse,
    LyapunovEstimate,
    LyapunovFit,
    SpectralPeak,
    SpectralResult,
    Spectrum,
    Stats,
    Vec3Out,
)

app = FastAPI(
    title="Lorenz Lab — Analysis API",
    version="1.0.0",
    description="Analyse de trajectoires de systèmes dynamiques chaotiques.",
)

# CORS permissif pour la démo (en prod, restreindre au domaine du front).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# Instanciation unique du composite — les analyseurs sont stateless, donc
# on peut les partager entre requêtes sans problème.
_analyzer = CompositeAnalyzer([
    StatsAnalyzer(),
    SpectralAnalyzer(top_k=5),
    LyapunovAnalyzer(),
])


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="lorenz-lab-api")


@app.get("/systems")
def systems() -> dict[str, list[dict[str, object]]]:
    """Miroir des systèmes supportés côté front. Sert surtout à documenter."""
    return {
        "systems": [
            {"name": "lorenz",  "params": ["sigma", "rho", "beta"],   "projection": "xz"},
            {"name": "rossler", "params": ["a", "b", "c"],            "projection": "xy"},
            {"name": "chua",    "params": ["alpha", "beta", "m0", "m1"], "projection": "xy"},
        ]
    }


def _sanitize(x: float) -> float:
    """NaN / ±inf ne sont pas JSON-serializable — on les convertit en 0.0."""
    return float(x) if math.isfinite(x) else 0.0


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    arr = np.array([[p.x, p.y, p.z] for p in req.points], dtype=np.float64)
    if arr.shape[0] < 100:
        raise HTTPException(status_code=422, detail="Need at least 100 points.")

    result = _analyzer.analyze(arr, req.dt)

    stats = result["stats"]
    spectral = result["spectral"]
    lyap = result["lyapunov"]

    return AnalyzeResponse(
        stats=Stats(
            mean=Vec3Out(**stats["mean"]),
            std=Vec3Out(**stats["std"]),
            min=Vec3Out(**stats["min"]),
            max=Vec3Out(**stats["max"]),
        ),
        spectral=SpectralResult(
            peaks=[SpectralPeak(**p) for p in spectral["peaks"]],
            spectrum=Spectrum(**spectral["spectrum"]),
        ),
        lyapunov=LyapunovEstimate(
            value=_sanitize(lyap["value"]),
            r_squared=_sanitize(lyap["r_squared"]),
            divergence=DivergenceCurve(**lyap["divergence"]),
            fit=LyapunovFit(**lyap["fit"]),
        ),
        n_points=arr.shape[0],
        dt=req.dt,
    )
