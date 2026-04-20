/**
 * RosslerSystem.ts
 *
 * Système de Rössler (1976). Spirale qui s'enroule dans le plan (x, y)
 * puis se replie brutalement en z — visuellement plus doux que Lorenz.
 */

import { DynamicalSystem, Vec3, ViewHints } from "./DynamicalSystem.js";

export interface RosslerParams {
  a?: number;
  b?: number;
  c?: number;
}

export class RosslerSystem extends DynamicalSystem {
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;

  constructor(params: RosslerParams = {}) {
    super("rossler", { x: 1, y: 1, z: 1 }, 0.02);
    this.a = params.a ?? 0.2;
    this.b = params.b ?? 0.2;
    this.c = params.c ?? 5.7;
  }

  protected derivative(p: Vec3): Vec3 {
    return {
      x: -p.y - p.z,
      y: p.x + this.a * p.y,
      z: this.b + p.z * (p.x - this.c),
    };
  }

  public get view(): ViewHints {
    return {
      center: { x: 0, y: 0, z: 0 },
      scale: 1 / 24,
      projection: "xy",
    };
  }
}
