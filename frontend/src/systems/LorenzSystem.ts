/**
 * LorenzSystem.ts
 *
 * Système de Lorenz (1963). L'attracteur étrange le plus connu,
 * visible dans le plan (x, z) comme deux lobes reliés.
 */

import { DynamicalSystem, Vec3, ViewHints } from "./DynamicalSystem.js";

export interface LorenzParams {
  sigma?: number;
  rho?: number;
  beta?: number;
}

export class LorenzSystem extends DynamicalSystem {
  private readonly sigma: number;
  private readonly rho: number;
  private readonly beta: number;

  constructor(params: LorenzParams = {}) {
    super("lorenz", { x: 0.1, y: 0, z: 0 }, 0.008);
    this.sigma = params.sigma ?? 10;
    this.rho = params.rho ?? 28;
    this.beta = params.beta ?? 8 / 3;
  }

  protected derivative(p: Vec3): Vec3 {
    return {
      x: this.sigma * (p.y - p.x),
      y: p.x * (this.rho - p.z) - p.y,
      z: p.x * p.y - this.beta * p.z,
    };
  }

  public get view(): ViewHints {
    return {
      center: { x: 0, y: 0, z: 25 },
      scale: 1 / 58,
      projection: "xz",
    };
  }
}
