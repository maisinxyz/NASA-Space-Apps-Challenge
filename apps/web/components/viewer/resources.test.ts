import { describe, expect, it, vi } from "vitest";
import { ResourceScope } from "./resources";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const resource = () => ({ dispose: vi.fn() });

describe("viewer loading generation ownership", () => {
  it("deduplicates in-flight and completed rotations until the scope retires", async () => {
    const scope = new ResourceScope();
    const pending = deferred<ReturnType<typeof resource>>();
    const load = vi.fn(() => pending.promise);
    const first = scope.load("rotation:a", load);
    expect(scope.load("rotation:a", load)).toBe(first);
    const value = resource();
    pending.resolve(value);
    expect(await first).toBe(value);
    expect(await scope.load("rotation:a", load)).toBe(value);
    expect(load).toHaveBeenCalledTimes(1);
    scope.dispose();
    scope.dispose();
    expect(value.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(["retry", "context loss", "tier change", "unmount"])("disposes late rotation and diff loads after %s without returning stale results", async () => {
    const retired = new ResourceScope();
    const water = deferred<ReturnType<typeof resource>>();
    const diff = deferred<ReturnType<typeof resource>>();
    const oldWater = retired.load("rotation:a", () => water.promise);
    const oldDiff = retired.load("diff:a__b", () => diff.promise);
    retired.dispose();
    const current = new ResourceScope();
    const fresh = resource();
    expect(await current.load("rotation:a", async () => fresh)).toBe(fresh);
    const stale = [resource(), resource()];
    water.resolve(stale[0]);
    diff.resolve(stale[1]);
    expect(await oldWater).toBeUndefined();
    expect(await oldDiff).toBeUndefined();
    stale.forEach((value) => expect(value.dispose).toHaveBeenCalledTimes(1));
    expect(fresh.dispose).not.toHaveBeenCalled();
    current.dispose();
  });

  it("silences failures from a retired scope, while active failures can be retried", async () => {
    const old = new ResourceScope();
    const pending = deferred<ReturnType<typeof resource>>();
    const stale = old.load("rotation:a", () => pending.promise);
    old.dispose();
    pending.reject(new Error("old request failed"));
    expect(await stale).toBeUndefined();
    const current = new ResourceScope();
    await expect(current.load("rotation:a", async () => { throw new Error("network"); })).rejects.toThrow("network");
    const value = resource();
    expect(await current.load("rotation:a", async () => value)).toBe(value);
    current.dispose();
  });

  it("cleans up a sibling texture that completes after another terrain asset fails", () => {
    const scope = new ResourceScope();
    const geometry = scope.own(resource());
    scope.dispose();
    const imagery = scope.own(resource());
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(imagery.dispose).toHaveBeenCalledTimes(1);
    expect(scope.isActive).toBe(false);
  });
});
