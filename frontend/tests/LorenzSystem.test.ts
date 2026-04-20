import { describe, it, expect } from "vitest";
import { LorenzSystem } from "../src/systems/LorenzSystem.js";

describe("LorenzSystem", () => {
  it("origine est un point d'équilibre (dérivée nulle)", () => {
    // À l'origine, ẋ = σ(y-x) = 0, ẏ = x(ρ-z)-y = 0, ż = xy - βz = 0.
    // step() applique RK4 qui, sur un équilibre exact, ne doit pas bouger.
    const sys = new LorenzSystem();
    sys.reset();
    // Remplace l'état par l'origine via un cast contrôlé : on passe par
    // un système dérivé juste pour le test.
    class Probe extends LorenzSystem {
      public setState(v: { x: number; y: number; z: number }): void {
        // @ts-expect-error — accès protégé légitime pour le test
        this.state = v;
      }
    }
    const probe = new Probe();
    probe.setState({ x: 0, y: 0, z: 0 });
    const next = probe.step();
    expect(Math.abs(next.x)).toBeLessThan(1e-12);
    expect(Math.abs(next.y)).toBeLessThan(1e-12);
    expect(Math.abs(next.z)).toBeLessThan(1e-12);
  });

  it("trajectoire reste bornée sur 5000 pas (attracteur stable)", () => {
    const sys = new LorenzSystem();
    const pts = sys.trajectory(5000);
    const maxAbs = pts.reduce(
      (m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)),
      0
    );
    // L'attracteur de Lorenz est borné dans [-30, 30] environ sur chaque axe.
    expect(maxAbs).toBeLessThan(60);
  });

  it("expose des hints de vue cohérents avec l'attracteur", () => {
    const sys = new LorenzSystem();
    expect(sys.view.projection).toBe("xz");
    expect(sys.view.center.z).toBeGreaterThan(0);
  });
});
