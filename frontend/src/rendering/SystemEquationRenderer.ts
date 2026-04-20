/**
 * SystemEquationRenderer.ts
 *
 * Rend la formule mathématique du système courant dans un élément cible.
 * Utilise KaTeX via l'API globale `window.katex` (chargée depuis le CDN).
 * Si KaTeX n'est pas disponible, dégrade proprement en texte brut.
 */

import { SystemName } from "../systems/SystemFactory.js";

interface KatexAPI {
  render(expression: string, element: HTMLElement, opts?: {
    displayMode?: boolean;
    throwOnError?: boolean;
  }): void;
}

declare global {
  interface Window {
    katex?: KatexAPI;
  }
}

interface SystemEquation {
  label: string;
  latex: string;
}

const EQUATIONS: Record<SystemName, SystemEquation> = {
  lorenz: {
    label: "Lorenz (1963) — la dérivée implémentée",
    latex: String.raw`\begin{aligned}
      \dot{x} &= \sigma\,(y - x) \\
      \dot{y} &= x\,(\rho - z) - y \\
      \dot{z} &= x\,y - \beta\,z
    \end{aligned}`,
  },
  rossler: {
    label: "Rössler (1976) — la dérivée implémentée",
    latex: String.raw`\begin{aligned}
      \dot{x} &= -y - z \\
      \dot{y} &= x + a\,y \\
      \dot{z} &= b + z\,(x - c)
    \end{aligned}`,
  },
  chua: {
    label: "Chua (1983) — la dérivée implémentée",
    latex: String.raw`\begin{aligned}
      \dot{x} &= \alpha\,\bigl(y - x - g(x)\bigr) \\
      \dot{y} &= x - y + z \\
      \dot{z} &= -\beta\,y \\
      g(x) &= m_1\,x + \tfrac{1}{2}(m_0 - m_1)\bigl(|x+1| - |x-1|\bigr)
    \end{aligned}`,
  },
};

export class SystemEquationRenderer {
  constructor(
    private readonly labelEl: HTMLElement,
    private readonly formulaEl: HTMLElement,
  ) {}

  public render(system: SystemName): void {
    const eq = EQUATIONS[system];
    this.labelEl.textContent = eq.label;

    const katex = window.katex;
    if (katex) {
      try {
        katex.render(eq.latex, this.formulaEl, {
          displayMode: true,
          throwOnError: false,
        });
        return;
      } catch {
        // fall through vers le fallback texte
      }
    }
    // Fallback : afficher le LaTeX brut entouré de $$ pour que ce soit
    // lisible même sans KaTeX (le CDN est peut-être bloqué).
    this.formulaEl.textContent = `$$ ${eq.latex} $$`;
  }
}
