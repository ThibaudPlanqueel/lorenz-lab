/**
 * main.ts
 *
 * Point d'entrée. Branche l'UI (sélecteur de système, bouton Analyser),
 * le sketch, et le client d'analyse. Rien ne calcule ici — tout est
 * délégué aux classes des sous-dossiers.
 */

import { SystemFactory, SystemName } from "./systems/SystemFactory.js";
import { AttractorSketch } from "./rendering/AttractorSketch.js";
import { SystemEquationRenderer } from "./rendering/SystemEquationRenderer.js";
import { ResultPlotter } from "./rendering/ResultPlotter.js";
import { AnalysisClient, AnalysisResult } from "./api/AnalysisClient.js";

const PAPER = "#faf7f2";
const TRACE = "rgba(184, 74, 16, 0.42)";

// Toujours via /api : nginx proxifie vers le service python en interne.
// Pas d'accès direct au port 8001 depuis le browser — il n'est pas exposé.
const API_URL = "/api";

class App {
  private sketch: AttractorSketch;
  private readonly client = new AnalysisClient(API_URL);
  private readonly equations: SystemEquationRenderer | null;
  private readonly plotter: ResultPlotter | null;
  private currentSystem: SystemName = "lorenz";

  constructor(
    canvas: HTMLCanvasElement,
    equations: SystemEquationRenderer | null,
    plotter: ResultPlotter | null,
  ) {
    const system = SystemFactory.create(this.currentSystem);
    this.sketch = new AttractorSketch(canvas, system, {
      traceColor: TRACE,
      paperColor: PAPER,
    });
    this.equations = equations;
    this.plotter = plotter;
    this.sketch.start();
  }

  public switchSystem(name: SystemName): void {
    if (name === this.currentSystem) return;
    this.currentSystem = name;
    this.sketch.setSystem(SystemFactory.create(name));
    this.equations?.render(name);
    this.plotter?.clear();
  }

  // Appelé une fois au démarrage pour afficher les équations initiales
  public renderInitialEquations(): void {
    this.equations?.render(this.currentSystem);
  }

  public async analyze(): Promise<AnalysisResult> {
    const points = this.sketch.snapshot();
    if (points.length < 500) {
      throw new Error("Laisse la trajectoire se remplir un peu (500 points min.)");
    }
    const system = SystemFactory.create(this.currentSystem);
    const result = await this.client.analyze(points, system.dt);
    this.plotter?.render(result);
    return result;
  }
}

// ---- Bootstrap DOM ----

function ready(fn: () => void): void {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}

ready(() => {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas.attractor");
  if (!canvas) return;

  // Si le bloc d'équations est présent dans le DOM, on instancie le renderer.
  const eqLabel = document.querySelector<HTMLElement>("#system-equation-label");
  const eqFormula = document.querySelector<HTMLElement>("#system-equation-formula");
  const equations = eqLabel && eqFormula
    ? new SystemEquationRenderer(eqLabel, eqFormula)
    : null;

  // Plotter : instancié seulement si les deux conteneurs sont présents.
  const spectrumTarget = document.querySelector<HTMLElement>("#spectrum-plot");
  const lyapunovTarget = document.querySelector<HTMLElement>("#lyapunov-plot");
  const plotter = spectrumTarget && lyapunovTarget
    ? new ResultPlotter(spectrumTarget, lyapunovTarget)
    : null;

  const app = new App(canvas, equations, plotter);

  // KaTeX est chargé en `defer` : on attend le `load` pour le premier rendu.
  // Si déjà chargé au moment où on arrive ici, render tout de suite.
  if (window.katex) {
    app.renderInitialEquations();
  } else {
    window.addEventListener("load", () => app.renderInitialEquations());
  }

  // Boutons de sélection de système
  document.querySelectorAll<HTMLButtonElement>("[data-system]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.system as SystemName;
      app.switchSystem(name);
      document.querySelectorAll<HTMLButtonElement>("[data-system]").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    });
  });

  // Bouton d'analyse
  const analyzeBtn = document.querySelector<HTMLButtonElement>("#analyze");
  const output = document.querySelector<HTMLElement>("#analysis-output");
  if (analyzeBtn && output) {
    analyzeBtn.addEventListener("click", async () => {
      analyzeBtn.disabled = true;
      output.textContent = "Calcul en cours...";
      try {
        const result = await app.analyze();
        output.textContent = formatResult(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        output.textContent = `Erreur : ${msg}`;
      } finally {
        analyzeBtn.disabled = false;
      }
    });
  }
});

function formatResult(r: AnalysisResult): string {
  const f = (n: number, d = 3) => n.toFixed(d);
  const peaks = r.spectral.peaks
    .slice(0, 3)
    .map((p) => `  ${f(p.frequency, 4)} Hz  (amp ${f(p.amplitude, 2)})`)
    .join("\n");
  return [
    `Points analysés : ${r.n_points}   (dt = ${r.dt})`,
    ``,
    `Stats (moyenne ± std) :`,
    `  x = ${f(r.stats.mean.x)} ± ${f(r.stats.std.x)}`,
    `  y = ${f(r.stats.mean.y)} ± ${f(r.stats.std.y)}`,
    `  z = ${f(r.stats.mean.z)} ± ${f(r.stats.std.z)}`,
    ``,
    `Pics spectraux (top 3, sur composante x) :`,
    peaks,
    ``,
    `Exposant de Lyapunov (Rosenstein) :`,
    `  λ ≈ ${f(r.lyapunov.value, 4)}   (R² = ${f(r.lyapunov.r_squared)})`,
  ].join("\n");
}
