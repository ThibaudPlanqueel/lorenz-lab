/**
 * SystemFactory.ts
 *
 * Factory : instancie un système à partir de son nom. Centralise la
 * connaissance des systèmes disponibles pour que le reste du code
 * n'ait pas à les connaître individuellement.
 */

import { DynamicalSystem } from "./DynamicalSystem.js";
import { LorenzSystem } from "./LorenzSystem.js";
import { RosslerSystem } from "./RosslerSystem.js";
import { ChuaSystem } from "./ChuaSystem.js";

export type SystemName = "lorenz" | "rossler" | "chua";

export class SystemFactory {
  public static readonly available: readonly SystemName[] = [
    "lorenz",
    "rossler",
    "chua",
  ] as const;

  public static create(name: SystemName): DynamicalSystem {
    switch (name) {
      case "lorenz":
        return new LorenzSystem();
      case "rossler":
        return new RosslerSystem();
      case "chua":
        return new ChuaSystem();
      default: {
        const exhaustive: never = name;
        throw new Error(`Unknown system: ${exhaustive}`);
      }
    }
  }
}
