import { describe, it, expect } from "vitest";
import { runStages } from "../engine/pipeline";

// Four-stage value pipeline: raw → asFormulated → asDeclared → endOfShelfLife.

describe("pipeline.runStages", () => {
  const stages = runStages({
    raw: 100,
    processLossFrac: 0.1,
    overageFrac: 0.2,
    shelfLifeDecayFrac: 0.1,
  });

  it("asFormulated applies process loss (100 × 0.9)", () => {
    expect(stages.asFormulated).toBeCloseTo(90, 12);
  });
  it("asDeclared divides formulated by (1 + overage) (90 ÷ 1.2)", () => {
    expect(stages.asDeclared).toBeCloseTo(75, 12);
  });
  it("endOfShelfLife applies decay to formulated (90 × 0.9)", () => {
    expect(stages.endOfShelfLife).toBeCloseTo(81, 12);
  });
  it("preserves raw", () => {
    expect(stages.raw).toBe(100);
  });

  it("with all fractions 0, every stage equals raw", () => {
    const s = runStages({ raw: 42, processLossFrac: 0, overageFrac: 0, shelfLifeDecayFrac: 0 });
    expect(s).toEqual({ raw: 42, asFormulated: 42, asDeclared: 42, endOfShelfLife: 42 });
  });
});
