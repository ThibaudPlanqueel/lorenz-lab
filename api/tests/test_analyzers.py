"""
test_analyzers.py

Tests sur signaux synthétiques aux propriétés connues :
- constantes → moyenne = valeur, std = 0
- sinusoïde pure → pic spectral à la fréquence connue, λ ≈ 0
- trajectoire de Lorenz (intégrée ici en Python) → λ > 0

L'idée : vérifier que les analyseurs captent des propriétés
mesurables, pas juste qu'ils renvoient un dict.
"""

from __future__ import annotations

import numpy as np
import pytest

from src.analysis import (
    CompositeAnalyzer,
    LyapunovAnalyzer,
    SpectralAnalyzer,
    StatsAnalyzer,
)

# ---------- Fixtures ----------

@pytest.fixture
def constant_trajectory() -> np.ndarray:
    """1000 points constants à (1, 2, 3)."""
    return np.tile(np.array([1.0, 2.0, 3.0]), (1000, 1))


@pytest.fixture
def sine_trajectory() -> tuple[np.ndarray, float, float]:
    """Sinusoïde pure à 2 Hz pendant 10 secondes."""
    dt = 0.001
    f = 2.0
    t = np.arange(0, 10, dt)
    x = np.sin(2 * np.pi * f * t)
    traj = np.column_stack([x, np.cos(2 * np.pi * f * t), np.zeros_like(t)])
    return traj, dt, f


@pytest.fixture
def lorenz_trajectory() -> tuple[np.ndarray, float]:
    """Intègre Lorenz en RK4 côté Python pour avoir une trajectoire chaotique."""
    sigma, rho, beta = 10.0, 28.0, 8 / 3
    dt = 0.008
    n = 3000
    state = np.array([0.1, 0.0, 0.0])
    traj = np.zeros((n, 3))

    def deriv(p: np.ndarray) -> np.ndarray:
        return np.array([
            sigma * (p[1] - p[0]),
            p[0] * (rho - p[2]) - p[1],
            p[0] * p[1] - beta * p[2],
        ])

    for i in range(n):
        k1 = deriv(state)
        k2 = deriv(state + dt * k1 / 2)
        k3 = deriv(state + dt * k2 / 2)
        k4 = deriv(state + dt * k3)
        state = state + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        traj[i] = state
    return traj, dt


# ---------- StatsAnalyzer ----------

class TestStatsAnalyzer:
    def test_constant_signal(self, constant_trajectory: np.ndarray) -> None:
        result = StatsAnalyzer().analyze(constant_trajectory, dt=0.01)
        assert result["mean"] == {"x": 1.0, "y": 2.0, "z": 3.0}
        assert result["std"]["x"] == pytest.approx(0.0, abs=1e-12)
        assert result["std"]["y"] == pytest.approx(0.0, abs=1e-12)
        assert result["min"]["x"] == 1.0
        assert result["max"]["z"] == 3.0

    def test_output_shape(self, lorenz_trajectory: tuple[np.ndarray, float]) -> None:
        traj, dt = lorenz_trajectory
        result = StatsAnalyzer().analyze(traj, dt)
        assert set(result.keys()) == {"mean", "std", "min", "max"}
        for k in result:
            assert set(result[k].keys()) == {"x", "y", "z"}


# ---------- SpectralAnalyzer ----------

class TestSpectralAnalyzer:
    def test_pure_sine_finds_right_frequency(
        self, sine_trajectory: tuple[np.ndarray, float, float]
    ) -> None:
        traj, dt, f = sine_trajectory
        result = SpectralAnalyzer(top_k=3).analyze(traj, dt)
        peaks = result["peaks"]
        assert len(peaks) >= 1
        # Le pic dominant doit être à la fréquence connue, à 0.5 Hz près.
        dominant = peaks[0]
        assert dominant["frequency"] == pytest.approx(f, abs=0.5)

    def test_returns_at_most_top_k(
        self, lorenz_trajectory: tuple[np.ndarray, float]
    ) -> None:
        traj, dt = lorenz_trajectory
        result = SpectralAnalyzer(top_k=3).analyze(traj, dt)
        assert len(result["peaks"]) <= 3

    def test_returns_full_spectrum(
        self, lorenz_trajectory: tuple[np.ndarray, float]
    ) -> None:
        traj, dt = lorenz_trajectory
        result = SpectralAnalyzer().analyze(traj, dt)
        assert "spectrum" in result
        spec = result["spectrum"]
        assert len(spec["frequencies"]) == len(spec["amplitudes"])
        assert len(spec["frequencies"]) <= 256


# ---------- LyapunovAnalyzer ----------

class TestLyapunovAnalyzer:
    def test_periodic_signal_near_zero(
        self, sine_trajectory: tuple[np.ndarray, float, float]
    ) -> None:
        traj, dt, _ = sine_trajectory
        # Sous-échantillon pour rester dans le budget O(N²).
        sub = traj[::5][:2000]
        result = LyapunovAnalyzer().analyze(sub, dt * 5)
        # Pour un système périodique, λ doit être quasi-nul (|λ| < 0.5).
        assert abs(result["value"]) < 0.5

    def test_lorenz_positive(
        self, lorenz_trajectory: tuple[np.ndarray, float]
    ) -> None:
        traj, dt = lorenz_trajectory
        result = LyapunovAnalyzer().analyze(traj, dt)
        # Lorenz canonique : λ ≈ 0.9 (Wolf et al. 1985). On tolère large.
        assert result["value"] > 0.2
        assert result["r_squared"] > 0.5  # fit linéaire correct
        # La courbe de divergence et le fit doivent être présents.
        assert len(result["divergence"]["t"]) > 0
        assert result["fit"]["t_end"] > result["fit"]["t_start"]

    def test_short_trajectory_returns_nan(self) -> None:
        short = np.random.rand(30, 3)
        result = LyapunovAnalyzer().analyze(short, dt=0.01)
        assert np.isnan(result["value"])


# ---------- CompositeAnalyzer ----------

class TestCompositeAnalyzer:
    def test_aggregates_all_analyzers(
        self, lorenz_trajectory: tuple[np.ndarray, float]
    ) -> None:
        traj, dt = lorenz_trajectory
        composite = CompositeAnalyzer([
            StatsAnalyzer(),
            SpectralAnalyzer(),
            LyapunovAnalyzer(),
        ])
        result = composite.analyze(traj, dt)
        assert set(result.keys()) == {"stats", "spectral", "lyapunov"}
