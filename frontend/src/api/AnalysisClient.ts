/**
 * AnalysisClient.ts
 *
 * Wrapper HTTP typé pour l'API d'analyse. Centralise la gestion d'erreurs
 * et les types de payload pour que le reste du code n'ait jamais à toucher
 * `fetch` directement.
 */

import { Vec3 } from "../systems/DynamicalSystem.js";

export interface Stats {
  mean: Vec3;
  std: Vec3;
  min: Vec3;
  max: Vec3;
}

export interface SpectralPeak {
  frequency: number;
  amplitude: number;
}

export interface Spectrum {
  frequencies: number[];
  amplitudes: number[];
}

export interface SpectralResult {
  peaks: SpectralPeak[];
  spectrum: Spectrum;
}

export interface DivergenceCurve {
  t: number[];
  log_d: number[];
}

export interface LyapunovFit {
  slope: number;
  intercept: number;
  t_start: number;
  t_end: number;
}

export interface LyapunovEstimate {
  value: number;
  r_squared: number;
  divergence: DivergenceCurve;
  fit: LyapunovFit;
}

export interface AnalysisResult {
  stats: Stats;
  spectral: SpectralResult;
  lyapunov: LyapunovEstimate;
  n_points: number;
  dt: number;
}

export class AnalysisClient {
  constructor(private readonly baseUrl: string) {}

  public async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  public async analyze(points: Vec3[], dt: number): Promise<AnalysisResult> {
    const res = await fetch(`${this.baseUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, dt }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Analysis failed (${res.status}): ${text}`);
    }
    return (await res.json()) as AnalysisResult;
  }
}
