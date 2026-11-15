import { describe, expect, it } from "vitest";

import { twinAnswer } from "./twin-mock";

describe("synthetic Twin preview", () => {
  it("directs an unsupported crop question to the planting comparison", () => {
    const result = twinAnswer("What outcome would planting sunflower have in the future?");
    expect(result.plantingComparison).toBe(true);
    expect(result.answer).toContain("Compare strategies");
    expect(result.answer).not.toContain("36%");
  });

  it("retains the watering example and its follow-up", () => {
    const sample = twinAnswer("Which field needs water first?");
    expect(sample.answer).toContain("Trial plots needs water first");
    expect(twinAnswer(sample.chips[0]).answer).toContain("Main block is dry");
  });
});
