"""
analyzers.py

Contrat abstrait TrajectoryAnalyzer + trois implémentations concrètes.
Même philosophie que côté TypeScript : l'abstraction définit la forme,
les implémentations concrètes fournissent la logique.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Mapping

import numpy as np
from numpy.typing import NDArray
from scipy.signal import find_peaks


# --- Résultats typés ---

@dataclass(frozen=True, slots=True)
class Vec3Stats:
    mean: tuple[float, float, float]
    std: tuple[float, float, float]
    min: tuple[float, float, float]
    max: tuple[float, float, float]


# --- Contrat abstrait ---

class TrajectoryAnalyzer(ABC):
    """Analyse une trajectoire 3D (N, 3) avec un pas temporel dt."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def analyze(self, trajectory: NDArray[np.float64], dt: float) -> Mapping[str, Any]: ...


# --- Implémentations concrètes ---

class StatsAnalyzer(TrajectoryAnalyzer):
    """Moyenne, écart-type, min, max par axe. Trivial mais utile."""

    @property
    def name(self) -> str:
        return "stats"

    def analyze(self, trajectory: NDArray[np.float64], dt: float) -> Mapping[str, Any]:
        means = trajectory.mean(axis=0)
        stds = trajectory.std(axis=0)
        mins = trajectory.min(axis=0)
        maxs = trajectory.max(axis=0)
        return {
            "mean": {"x": float(means[0]), "y": float(means[1]), "z": float(means[2])},
            "std":  {"x": float(stds[0]),  "y": float(stds[1]),  "z": float(stds[2])},
            "min":  {"x": float(mins[0]),  "y": float(mins[1]),  "z": float(mins[2])},
            "max":  {"x": float(maxs[0]),  "y": float(maxs[1]),  "z": float(maxs[2])},
        }


class SpectralAnalyzer(TrajectoryAnalyzer):
    """
    FFT de la composante x, centrée. Retourne les top-K pics en amplitude.
    Suffisant pour repérer les fréquences dominantes d'un système périodique
    ou quasi-périodique (Rössler a un pic net ; Lorenz chaotique n'a quasi
    que du bruit spectral — ce qui est aussi une info).
    """

    def __init__(self, top_k: int = 5) -> None:
        self.top_k = top_k

    @property
    def name(self) -> str:
        return "spectral"

    def analyze(self, trajectory: NDArray[np.float64], dt: float) -> Mapping[str, Any]:
        signal = trajectory[:, 0] - trajectory[:, 0].mean()
        n = signal.size
        # rfft = FFT pour signaux réels (moitié de spectre, plus rapide)
        spectrum = np.abs(np.fft.rfft(signal)) / n
        freqs = np.fft.rfftfreq(n, d=dt)
        # On ignore le DC (index 0)
        idx_peaks, _ = find_peaks(spectrum[1:], height=spectrum[1:].max() * 0.05)
        idx_peaks = idx_peaks + 1  # recaler (on avait décalé de 1)
        # Trier par amplitude décroissante, prendre top_k
        order = np.argsort(spectrum[idx_peaks])[::-1][: self.top_k]
        peaks = [
            {"frequency": float(freqs[i]), "amplitude": float(spectrum[i])}
            for i in idx_peaks[order]
        ]

        # Spectre complet downsamplé à ~256 bins pour rester léger en réseau.
        # On garde le DC pour que le graph commence à 0 Hz proprement.
        target = 256
        if spectrum.size > target:
            # Agrégation par moyennes de blocs — préserve les pics mieux que le subsample.
            edges = np.linspace(0, spectrum.size, target + 1, dtype=int)
            down_amp = np.array([spectrum[edges[i]:edges[i + 1]].mean() for i in range(target)])
            down_freq = np.array([freqs[edges[i]:edges[i + 1]].mean() for i in range(target)])
        else:
            down_amp = spectrum
            down_freq = freqs

        return {
            "peaks": peaks,
            "spectrum": {
                "frequencies": down_freq.tolist(),
                "amplitudes": down_amp.tolist(),
            },
        }


class LyapunovAnalyzer(TrajectoryAnalyzer):
    """
    Estimation de l'exposant de Lyapunov maximal par la méthode de
    Rosenstein (1993) — simple, rapide et robuste pour des trajectoires
    courtes.

    Principe : pour chaque point, trouver le plus proche voisin (non
    adjacent temporellement) ; suivre la divergence des deux trajectoires
    dans le temps ; ajuster log(d(t)) = λ·t + const.
    """

    def __init__(self, fit_fraction: float = 0.35, min_separation: int = 20) -> None:
        self.fit_fraction = fit_fraction
        self.min_separation = min_separation

    @property
    def name(self) -> str:
        return "lyapunov"

    def analyze(self, trajectory: NDArray[np.float64], dt: float) -> Mapping[str, Any]:
        n = trajectory.shape[0]
        horizon = min(int(n * self.fit_fraction), 200)

        def empty_result(value: float = float("nan")) -> Mapping[str, Any]:
            return {
                "value": value,
                "r_squared": 0.0,
                "divergence": {"t": [], "log_d": []},
                "fit": {"slope": 0.0, "intercept": 0.0, "t_start": 0.0, "t_end": 0.0},
            }

        if n < 4 * self.min_separation or horizon < 10:
            return empty_result()

        # Plus proche voisin temporellement séparé de chaque point
        # (force brute O(N²) — OK pour N ≤ 3000, ce qui est notre cas)
        sq = np.sum(trajectory**2, axis=1)
        # dist²(i, j) = |xi|² + |xj|² − 2 xi·xj
        d2 = sq[:, None] + sq[None, :] - 2 * trajectory @ trajectory.T
        # Masquer les voisins temporels trop proches
        mask = np.abs(np.arange(n)[:, None] - np.arange(n)[None, :]) < self.min_separation
        d2[mask] = np.inf
        neighbors = np.argmin(d2, axis=1)

        # Pour chaque paire (i, j=neighbors[i]), suivre ||x_{i+k} − x_{j+k}||
        usable = np.arange(n - horizon)
        j = neighbors[usable]
        # Ne garder que les paires dont le voisin peut aussi avancer de `horizon`
        ok = j + horizon < n
        usable = usable[ok]
        j = j[ok]
        if usable.size < 20:
            return empty_result()

        log_d = np.zeros(horizon)
        for k in range(horizon):
            diff = trajectory[usable + k] - trajectory[j + k]
            d = np.linalg.norm(diff, axis=1)
            d = d[d > 0]  # éviter log(0)
            log_d[k] = np.mean(np.log(d)) if d.size else 0.0

        t = np.arange(horizon) * dt
        # Fit linéaire sur la partie centrale (régime de divergence franche)
        i0, i1 = horizon // 6, horizon // 2
        slope, intercept = np.polyfit(t[i0:i1], log_d[i0:i1], 1)
        # R² du fit
        pred = slope * t[i0:i1] + intercept
        ss_res = float(np.sum((log_d[i0:i1] - pred) ** 2))
        ss_tot = float(np.sum((log_d[i0:i1] - log_d[i0:i1].mean()) ** 2))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

        return {
            "value": float(slope),
            "r_squared": float(max(0.0, min(1.0, r2))),
            "divergence": {
                "t": t.tolist(),
                "log_d": log_d.tolist(),
            },
            "fit": {
                "slope": float(slope),
                "intercept": float(intercept),
                "t_start": float(t[i0]),
                "t_end": float(t[i1 - 1]),
            },
        }


# --- Composition ---

class CompositeAnalyzer(TrajectoryAnalyzer):
    """Applique plusieurs analyseurs et fusionne leurs résultats."""

    def __init__(self, analyzers: list[TrajectoryAnalyzer]) -> None:
        self._analyzers = analyzers

    @property
    def name(self) -> str:
        return "composite"

    def analyze(self, trajectory: NDArray[np.float64], dt: float) -> Mapping[str, Any]:
        return {a.name: a.analyze(trajectory, dt) for a in self._analyzers}
