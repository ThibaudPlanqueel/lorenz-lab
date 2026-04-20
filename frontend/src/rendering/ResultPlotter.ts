/**
 * ResultPlotter.ts
 *
 * Trace les résultats d'analyse en graphs interactifs avec Plotly.
 * Dégrade proprement si Plotly n'est pas disponible (CDN bloqué, hors-ligne) :
 * les conteneurs cibles affichent alors un message discret, mais la page
 * reste fonctionnelle et le bloc texte des stats reste visible.
 */

import type { AnalysisResult } from "../api/AnalysisClient.js";

// Surface minimale du SDK Plotly.js qu'on utilise ici. On ne dépend pas
// des types complets pour garder le bundle léger et éviter les casses
// sur changement de version mineure.
interface PlotlyLike {
  newPlot(
    target: HTMLElement,
    data: PlotTrace[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<void>;
  purge(target: HTMLElement): void;
}

interface PlotTrace {
  x: number[];
  y: number[];
  type?: string;
  mode?: string;
  name?: string;
  line?: Record<string, unknown>;
  marker?: Record<string, unknown>;
  fill?: string;
  hovertemplate?: string;
}

declare global {
  interface Window {
    Plotly?: PlotlyLike;
  }
}

// Palette cohérente avec le reste du site.
const AMBER = "#b84a10";
const INK = "#1c1917";
const MUTED = "#78716c";
const PAPER = "#faf7f2";

export class ResultPlotter {
  constructor(
    private readonly spectrumTarget: HTMLElement,
    private readonly lyapunovTarget: HTMLElement,
  ) {}

  // API publique : trace l'ensemble des résultats. Retourne false si Plotly
  // n'est pas disponible pour que l'appelant sache qu'il doit fallback.
  public render(result: AnalysisResult): boolean {
    const plotly = window.Plotly;
    if (!plotly) {
      this.showFallback();
      return false;
    }
    this.renderSpectrum(plotly, result);
    this.renderLyapunov(plotly, result);
    return true;
  }

  public clear(): void {
    const plotly = window.Plotly;
    if (plotly) {
      plotly.purge(this.spectrumTarget);
      plotly.purge(this.lyapunovTarget);
    }
    this.spectrumTarget.innerHTML = "";
    this.lyapunovTarget.innerHTML = "";
  }

  // ---------- Graphs ----------

  private renderSpectrum(plotly: PlotlyLike, result: AnalysisResult): void {
    const { frequencies, amplitudes } = result.spectral.spectrum;
    const peaks = result.spectral.peaks.slice(0, 3);

    const traces: PlotTrace[] = [
      {
        x: frequencies,
        y: amplitudes,
        type: "scatter",
        mode: "lines",
        name: "Spectre",
        line: { color: AMBER, width: 1.3 },
        hovertemplate: "f = %{x:.3f} Hz<br>|X| = %{y:.3f}<extra></extra>",
      },
      {
        x: peaks.map((p) => p.frequency),
        y: peaks.map((p) => p.amplitude),
        type: "scatter",
        mode: "markers",
        name: "Pics",
        marker: { color: INK, size: 8, symbol: "circle-open", line: { width: 1.5 } },
        hovertemplate: "pic à %{x:.4f} Hz<br>amp %{y:.3f}<extra></extra>",
      },
    ];

    void plotly.newPlot(this.spectrumTarget, traces, this.baseLayout({
      xaxis: { title: { text: "Fréquence (Hz)" }, zeroline: false },
      yaxis: { title: { text: "|X(f)|" }, zeroline: false, rangemode: "tozero" },
    }), this.baseConfig());
  }

  private renderLyapunov(plotly: PlotlyLike, result: AnalysisResult): void {
    const { divergence, fit, value, r_squared } = result.lyapunov;
    // Droite de régression pour la fenêtre de fit.
    const fitX = divergence.t.filter((t) => t >= fit.t_start && t <= fit.t_end);
    const fitY = fitX.map((t) => fit.slope * t + fit.intercept);

    const traces: PlotTrace[] = [
      {
        x: divergence.t,
        y: divergence.log_d,
        type: "scatter",
        mode: "lines",
        name: "⟨ln ‖δₖ‖⟩",
        line: { color: AMBER, width: 1.3 },
        hovertemplate: "t = %{x:.3f}<br>ln d = %{y:.3f}<extra></extra>",
      },
      {
        x: fitX,
        y: fitY,
        type: "scatter",
        mode: "lines",
        name: `fit : λ ≈ ${value.toFixed(3)}  (R² = ${r_squared.toFixed(2)})`,
        line: { color: INK, width: 2, dash: "dash" },
        hovertemplate: "fit linéaire<extra></extra>",
      },
    ];

    void plotly.newPlot(this.lyapunovTarget, traces, this.baseLayout({
      xaxis: { title: { text: "t" }, zeroline: false },
      yaxis: { title: { text: "⟨ln ‖δₖ‖⟩" }, zeroline: false },
    }), this.baseConfig());
  }

  // ---------- Fallback ----------

  private showFallback(): void {
    const msg = "Graphiques non disponibles (Plotly non chargé). Les valeurs numériques restent ci-dessus.";
    for (const target of [this.spectrumTarget, this.lyapunovTarget]) {
      target.innerHTML = "";
      const note = document.createElement("p");
      note.textContent = msg;
      note.style.cssText =
        `color:${MUTED};font-style:italic;font-size:0.9rem;padding:1rem;margin:0;`;
      target.appendChild(note);
    }
  }

  // ---------- Helpers ----------

  private baseLayout(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      autosize: true,
      margin: { l: 55, r: 20, t: 15, b: 45 },
      paper_bgcolor: PAPER,
      plot_bgcolor: PAPER,
      font: {
        family: "ui-sans-serif, system-ui, sans-serif",
        size: 12,
        color: INK,
      },
      showlegend: true,
      legend: { orientation: "h", y: -0.25, font: { size: 11 } },
      height: 260,
      ...extra,
    };
  }

  private baseConfig(): Record<string, unknown> {
    return {
      displayModeBar: false,
      responsive: true,
    };
  }
}
