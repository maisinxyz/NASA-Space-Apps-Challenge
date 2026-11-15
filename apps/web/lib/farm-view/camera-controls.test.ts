import { describe, expect, it } from "vitest";
import { cameraActionForKey } from "./camera-controls";

describe("camera keyboard controls", () => {
  it("maps arrows to pan, shift arrows to orbit, and plus/minus to zoom", () => {
    expect(cameraActionForKey("ArrowLeft", false)).toBe("pan-left");
    expect(cameraActionForKey("ArrowUp", true)).toBe("orbit-up");
    expect(cameraActionForKey("+", false)).toBe("zoom-in");
    expect(cameraActionForKey("-", false)).toBe("zoom-out");
    expect(cameraActionForKey("a", false)).toBeNull();
  });
});
