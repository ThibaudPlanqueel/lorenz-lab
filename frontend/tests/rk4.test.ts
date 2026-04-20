import { describe, it, expect } from "vitest";
import { DynamicalSystem, Vec3, ViewHints } from "../src/systems/DynamicalSystem.js";

/**
 * Oscillateur harmonique 1D exprimé en 3D (z ignoré) :
 * ẋ = y,  ẏ = -ω²x,  ż = 0
 * L'énergie E = ½(y² + ω²x²) est conservée — bonne sonde pour RK4.
 */
class HarmonicOscillator extends DynamicalSystem {
  private readonly omega: number;
  constructor(omega = 1.0, dt = 0.01) {
    super("harmonic", { x: 1, y: 0, z: 0 }, dt);
    this.omega = omega;
  }
  protected derivative(p: Vec3): Vec3 {
    return { x: p.y, y: -this.omega * this.omega * p.x, z: 0 };
  }
  public get view(): ViewHints {
    return { center: { x: 0, y: 0, z: 0 }, scale: 1, projection: "xy" };
  }
}

describe("RK4 (via DynamicalSystem.step)", () => {
  it("conserve l'énergie de l'oscillateur harmonique à 1e-6 près sur 10 périodes", () => {
    const omega = 2 * Math.PI; // période = 1
    const sys = new HarmonicOscillator(omega, 0.005);
    const initial = sys.currentState;
    const e0 = 0.5 * (initial.y ** 2 + omega * omega * initial.x ** 2);

    const steps = Math.round(10 / 0.005); // 10 périodes
    let maxDrift = 0;
    for (let i = 0; i < steps; i++) {
      const s = sys.step();
      const e = 0.5 * (s.y ** 2 + omega * omega * s.x ** 2);
      maxDrift = Math.max(maxDrift, Math.abs(e - e0));
    }
    expect(maxDrift).toBeLessThan(1e-6);
  });
});
