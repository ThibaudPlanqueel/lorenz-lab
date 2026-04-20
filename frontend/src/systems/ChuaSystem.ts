/**
 * ChuaSystem.ts
 *
 * Circuit de Chua (1983). Premier circuit électronique à avoir exhibé
 * du chaos déterministe. Double-scroll classique avec la non-linéarité
 * piecewise-linear g(x).
 */

import { DynamicalSystem, Vec3, ViewHints } from "./DynamicalSystem.js";

export interface ChuaParams {
  alpha?: number;
  beta?: number;
  m0?: number;
  m1?: number;
}

export class ChuaSystem extends DynamicalSystem {
  private readonly alpha: number;
  private readonly beta: number;
  private readonly m0: number;
  private readonly m1: number;

  constructor(params: ChuaParams = {}) {
    super("chua", { x: 0.7, y: 0, z: 0 }, 0.015);
    this.alpha = params.alpha ?? 15.6;
    this.beta = params.beta ?? 28;
    this.m0 = params.m0 ?? -8 / 7;
    this.m1 = params.m1 ?? -5 / 7;
  }

  // Caractéristique piecewise-linear de la diode de Chua.
  private g(x: number): number {
    return this.m1 * x + 0.5 * (this.m0 - this.m1) * (Math.abs(x + 1) - Math.abs(x - 1));
  }

  protected derivative(p: Vec3): Vec3 {
    return {
      x: this.alpha * (p.y - p.x - this.g(p.x)),
      y: p.x - p.y + p.z,
      z: -this.beta * p.y,
    };
  }

  public get view(): ViewHints {
    return {
      center: { x: 0, y: 0, z: 0 },
      scale: 1 / 6,
      projection: "xy",
    };
  }
}
