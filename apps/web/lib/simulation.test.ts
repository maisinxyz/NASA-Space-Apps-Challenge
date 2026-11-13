import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api/client";
import type { SimulationStatus } from "./api/types";
import { followSimulation, simulationInvalidated } from "./simulation";

const done: SimulationStatus = JSON.parse(readFileSync(new URL("../../../packages/contracts/fixtures/simulations/sim_mock_001/status.json", import.meta.url), "utf8"));
const pending = (status: "queued" | "running", progress = 0): SimulationStatus => ({ ...done, status, progress, cached: false, results: {} });

function setup(initial = vi.fn<() => Promise<SimulationStatus>>().mockResolvedValue(done)) {
  const controller = new AbortController();
  const read = vi.fn<(id: string) => Promise<SimulationStatus>>().mockResolvedValue(done);
  const onProgress = vi.fn<(status: SimulationStatus) => void>();
  const options = { initial, read, onProgress, signal: controller.signal };
  return { controller, read, onProgress, initial, options };
}

afterEach(() => vi.useRealTimers());

describe("simulation lifecycle", () => {
  it("returns a cached completed result without polling", async () => {
    const { options, read, onProgress } = setup();
    expect(await followSimulation(options)).toEqual(done);
    expect(read).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it.each(["queued", "running"] as const)("follows a new or restored %s job through to done", async (phase) => {
    vi.useFakeTimers();
    const { options, read, onProgress } = setup(vi.fn().mockResolvedValue(pending(phase)));
    read.mockResolvedValueOnce(pending("running", 0.6)).mockResolvedValueOnce(done);
    const result = followSimulation(options);
    await vi.advanceTimersByTimeAsync(0);
    expect(onProgress.mock.calls.map(([s]) => s.status)).toEqual([phase]);
    await vi.advanceTimersByTimeAsync(999);
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1001);
    expect(await result).toEqual(done);
    expect(read.mock.calls).toEqual([[done.id], [done.id]]);
    expect(onProgress.mock.calls.map(([s]) => s.progress)).toEqual([0, 0.6]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("surfaces contract failure details and permits a fresh successful retry", async () => {
    const failed: SimulationStatus = { ...pending("running"), status: "failed", error: { code: "DATA_SOURCE_UNAVAILABLE", message: "Source unavailable", hint: "Try later", retryable: true } };
    const { options, read } = setup(vi.fn().mockResolvedValue(failed));
    await expect(followSimulation(options)).rejects.toMatchObject({ name: "ApiError", ...failed.error });
    expect(read).not.toHaveBeenCalled();
    const retry = setup();
    expect(await followSimulation(retry.options)).toEqual(done);
  });

  it("handles a failed status without optional error details", async () => {
    const { options } = setup(vi.fn().mockResolvedValue({ ...pending("running"), status: "failed" }));
    await expect(followSimulation(options)).rejects.toBeInstanceOf(ApiError);
  });

  it("surfaces transport errors without continuing to poll", async () => {
    vi.useFakeTimers();
    const { options, read } = setup(vi.fn().mockResolvedValue(pending("queued")));
    const networkError = new Error("Connection lost");
    read.mockRejectedValue(networkError);
    const result = followSimulation(options);
    const rejection = expect(result).rejects.toBe(networkError);
    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a request after cancellation", async () => {
    const { options, controller, initial } = setup();
    controller.abort();
    expect(await followSimulation(options)).toBeNull();
    expect(initial).not.toHaveBeenCalled();
  });

  it("clears the pending timer immediately on Reset, input change, or unmount", async () => {
    vi.useFakeTimers();
    const { options, controller, read } = setup(vi.fn().mockResolvedValue(pending("running", 0.5)));
    const result = followSimulation(options);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
    expect(await result).toBeNull();
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).not.toHaveBeenCalled();
  });

  it("discards a late POST response after the run was invalidated", async () => {
    let resolve!: (s: SimulationStatus) => void;
    const { options, controller, onProgress, read } = setup(vi.fn(() => new Promise<SimulationStatus>((r) => { resolve = r; })));
    const result = followSimulation(options);
    controller.abort();
    resolve(done);
    expect(await result).toBeNull();
    expect(onProgress).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("ignores errors from a polling request that finishes after cancellation", async () => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const { options, controller, read, onProgress } = setup(vi.fn().mockResolvedValue(pending("queued")));
    read.mockImplementation(() => new Promise((_, r) => { reject = r; }));
    const result = followSimulation(options);
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    reject(new Error("Late network error"));
    expect(await result).toBeNull();
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("simulation invalidation", () => {
  const inputs = { terrainId: "terr_mock_hills", stormId: "storm_mock_1", simRotationIds: ["rot_existing", "rot_cover"], simId: "sim_mock_001" };

  it("invalidates changes to terrain, storm, selected rotations, and Reset", () => {
    expect(simulationInvalidated({ ...inputs, terrainId: "terr_mock_bowl" }, inputs)).toBe(true);
    expect(simulationInvalidated({ ...inputs, stormId: null }, inputs)).toBe(true);
    expect(simulationInvalidated({ ...inputs, simRotationIds: ["rot_existing"] }, inputs)).toBe(true);
    expect(simulationInvalidated({ ...inputs, simRotationIds: ["rot_existing", "rot_forage"] }, inputs)).toBe(true);
    expect(simulationInvalidated({ ...inputs, simId: null }, inputs)).toBe(true);
  });

  it("keeps equal inputs and new pending job ids valid", () => {
    expect(simulationInvalidated({ ...inputs, simRotationIds: [...inputs.simRotationIds] }, inputs)).toBe(false);
    expect(simulationInvalidated(inputs, { ...inputs, simId: null })).toBe(false);
  });
});
