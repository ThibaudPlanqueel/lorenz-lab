/**
 * AttractorSketch.ts
 *
 * Renderer canvas qui anime un DynamicalSystem. Lit les ViewHints du
 * système pour ajuster projection, centre et échelle — ce qui permet
 * de rendre n'importe quel système sans toucher au renderer.
 */

import {
  DynamicalSystem,
  Vec3,
  Point2D,
  Projection,
} from "../systems/DynamicalSystem.js";

export interface SketchOptions {
  traceColor: string;
  paperColor: string;
  onTrajectory?: (points: Vec3[]) => void;
}

export class AttractorSketch {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: SketchOptions;
  private system: DynamicalSystem;

  private width = 0;
  private height = 0;
  private previous: Point2D | null = null;
  private running = false;
  private rafId: number | null = null;
  private collected: Vec3[] = [];
  private readonly maxCollected = 3000;

  constructor(
    canvas: HTMLCanvasElement,
    system: DynamicalSystem,
    opts: SketchOptions
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.canvas = canvas;
    this.ctx = ctx;
    this.system = system;
    this.opts = opts;
    this.resize();
    window.addEventListener("resize", this.handleResize, { passive: true });
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clear();
    this.previous = null;
  }

  private clear(): void {
    this.ctx.fillStyle = this.opts.paperColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // Projection 3D → 2D guidée par les ViewHints du système courant.
  private project(p: Vec3): Point2D {
    const view = this.system.view;
    const minDim = Math.min(this.width, this.height);
    const s = minDim * view.scale;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const [a, b] = this.pickAxes(p, view.projection);
    return {
      x: cx + (a - this.centerOn(view.center, view.projection)[0]) * s,
      y: cy - (b - this.centerOn(view.center, view.projection)[1]) * s,
    };
  }

  private pickAxes(p: Vec3, proj: Projection): [number, number] {
    switch (proj) {
      case "xy": return [p.x, p.y];
      case "xz": return [p.x, p.z];
      case "yz": return [p.y, p.z];
    }
  }

  private centerOn(c: Vec3, proj: Projection): [number, number] {
    return this.pickAxes(c, proj);
  }

  private drawSegment(a: Point2D, b: Point2D): void {
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  private frame = (): void => {
    if (!this.running) return;
    this.ctx.strokeStyle = this.opts.traceColor;
    this.ctx.lineWidth = 0.8;
    this.ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const p = this.system.step();
      const screen = this.project(p);
      if (this.previous) this.drawSegment(this.previous, screen);
      this.previous = screen;
      if (this.collected.length < this.maxCollected) this.collected.push(p);
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.clear();
    this.previous = null;
    this.collected = [];
    this.rafId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  // Change le système affiché à chaud et relance l'animation.
  public setSystem(system: DynamicalSystem): void {
    this.stop();
    this.system = system;
    this.start();
  }

  // Snapshot de la trajectoire collectée depuis le dernier start().
  public snapshot(): Vec3[] {
    return [...this.collected];
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
  }
}
