"""
schemas.py

Schémas Pydantic pour l'API. Isolés ici pour que main.py reste focalisé
sur le routing et ne se mélange pas avec la validation.
"""

from pydantic import BaseModel, Field


class Vec3(BaseModel):
    x: float
    y: float
    z: float


class AnalyzeRequest(BaseModel):
    points: list[Vec3] = Field(
        ...,
        min_length=100,
        description="Trajectoire 3D à analyser (minimum 100 points).",
    )
    dt: float = Field(..., gt=0, description="Pas temporel de la trajectoire.")


class Vec3Out(BaseModel):
    x: float
    y: float
    z: float


class Stats(BaseModel):
    mean: Vec3Out
    std: Vec3Out
    min: Vec3Out
    max: Vec3Out


class SpectralPeak(BaseModel):
    frequency: float
    amplitude: float


class Spectrum(BaseModel):
    frequencies: list[float]
    amplitudes: list[float]


class SpectralResult(BaseModel):
    peaks: list[SpectralPeak]
    spectrum: Spectrum


class DivergenceCurve(BaseModel):
    t: list[float]
    log_d: list[float]


class LyapunovFit(BaseModel):
    slope: float
    intercept: float
    t_start: float
    t_end: float


class LyapunovEstimate(BaseModel):
    value: float
    r_squared: float
    divergence: DivergenceCurve
    fit: LyapunovFit


class AnalyzeResponse(BaseModel):
    stats: Stats
    spectral: SpectralResult
    lyapunov: LyapunovEstimate
    n_points: int
    dt: float


class HealthResponse(BaseModel):
    status: str
    service: str
