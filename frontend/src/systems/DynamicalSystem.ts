/**
 * DynamicalSystem.ts
 *
 * Contrat générique pour un système dynamique 3D. Chaque sous-classe
 * implémente sa dérivée et expose ses hints de vue (projection, centre,
 * échelle). L'intégrateur RK4 est défini ici une fois pour toutes.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type Projection = "xy" | "xz" | "yz";

export interface ViewHints {
  center: Vec3;
  scale: number;
  projection: Projection;
}

export abstract class DynamicalSystem {
  public readonly name: string;
  public readonly dt: number;
  protected state: Vec3;
  private readonly initial: Vec3;

  constructor(name: string, initial: Vec3, dt: number) {
    this.name = name;
    this.initial = { ...initial };
    this.state = { ...initial };
    this.dt = dt;
  }

  // Contrat : dérivée du champ de vecteurs au point p.
  protected abstract derivative(p: Vec3): Vec3;

  // Contrat : indications de rendu pour ce système.
  public abstract get view(): ViewHints;

  // Intégration Runge-Kutta 4 — générique, partagée par tous les systèmes.
  public step(): Vec3 {
    const dt = this.dt;
    const s = this.state;
    const k1 = this.derivative(s);
    const k2 = this.derivative({
      x: s.x + (dt * k1.x) / 2,
      y: s.y + (dt * k1.y) / 2,
      z: s.z + (dt * k1.z) / 2,
    });
    const k3 = this.derivative({
      x: s.x + (dt * k2.x) / 2,
      y: s.y + (dt * k2.y) / 2,
      z: s.z + (dt * k2.z) / 2,
    });
    const k4 = this.derivative({
      x: s.x + dt * k3.x,
      y: s.y + dt * k3.y,
      z: s.z + dt * k3.z,
    });
    this.state = {
      x: s.x + (dt * (k1.x + 2 * k2.x + 2 * k3.x + k4.x)) / 6,
      y: s.y + (dt * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)) / 6,
      z: s.z + (dt * (k1.z + 2 * k2.z + 2 * k3.z + k4.z)) / 6,
    };
    return { ...this.state };
  }

  // Remise à zéro aux conditions initiales.
  public reset(): void {
    this.state = { ...this.initial };
  }

  // Calcule N points de trajectoire d'un coup (utile pour l'envoi à l'API).
  public trajectory(steps: number): Vec3[] {
    const pts: Vec3[] = [];
    for (let i = 0; i < steps; i++) pts.push(this.step());
    return pts;
  }

  // Expose une copie de l'état courant.
  public get currentState(): Vec3 {
    return { ...this.state };
  }
}
