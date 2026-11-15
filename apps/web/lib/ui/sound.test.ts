import { describe, expect, it } from "vitest";
import { MUTE_KEY, TICK_MIN_GAP_MS, createSound } from "./sound";

function fakeCtx() {
  const log: string[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (kind: string) => ({ kind, type: "", Q: { value: 0 }, frequency: param(), gain: param(), connect() {}, start: () => log.push(kind), stop() {}, buffer: null });
  return {
    log,
    ctx: {
      currentTime: 0, sampleRate: 8000, state: "suspended", destination: {}, resumed: 0,
      resume() { (this as any).resumed++; (this as any).state = "running"; },
      createGain: () => node("gain"), createOscillator: () => node("osc"), createBiquadFilter: () => node("bp"),
      createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBufferSource: () => node("noise"),
    } as any,
  };
}
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

describe("sound", () => {
  it("is silent until unlocked, then plays and resumes the context once", () => {
    const { ctx, log } = fakeCtx();
    let n = 0;
    const s = createSound({ createContext: () => (n++, ctx), now: () => 1000, storage: mem() });
    expect(s.tap()).toBe(false);
    s.unlock(); s.unlock();
    expect(n).toBe(1);
    expect(ctx.resumed).toBe(1);
    expect(s.tap()).toBe(true);
    expect(log).toContain("noise");
  });
  it("throttles ticks to one per 35 ms but not other sounds", () => {
    const { ctx } = fakeCtx();
    let t = 0;
    const s = createSound({ createContext: () => ctx, now: () => t, storage: mem() });
    s.unlock();
    expect(s.tickWeek()).toBe(true);
    t = TICK_MIN_GAP_MS - 1;
    expect(s.tickMonth()).toBe(false);
    expect(s.tap()).toBe(true);
    t = TICK_MIN_GAP_MS;
    expect(s.tickMonth()).toBe(true);
  });
  it("plays every named sound", () => {
    const { ctx } = fakeCtx();
    const s = createSound({ createContext: () => ctx, now: () => 0, storage: mem() });
    s.unlock();
    for (const f of [s.pop, s.close, s.success, s.tap]) expect(f()).toBe(true);
  });
  it("mute silences and persists; reload restores it", () => {
    const { ctx } = fakeCtx();
    const store = mem();
    const s = createSound({ createContext: () => ctx, now: () => 0, storage: store });
    s.unlock();
    s.setMuted(true);
    expect(s.tap()).toBe(false);
    expect(store.m.get(MUTE_KEY)).toBe("1");
    expect(createSound({ createContext: () => ctx, storage: store }).isMuted()).toBe(true);
    s.setMuted(false);
    expect(s.tap()).toBe(true);
  });
  it("survives blocked storage and a missing AudioContext", () => {
    const bad = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
    const s = createSound({ createContext: () => null, storage: bad });
    expect(s.isMuted()).toBe(false);
    expect(() => { s.unlock(); s.setMuted(true); }).not.toThrow();
    expect(s.tap()).toBe(false);
  });
  it("installUnlock fires once on first pointerdown", () => {
    const { ctx } = fakeCtx();
    let n = 0;
    const s = createSound({ createContext: () => (n++, ctx), storage: mem() });
    const hs = new Map<string, () => void>();
    const target = { addEventListener: (t: string, h: any) => hs.set(t, h), removeEventListener: (t: string) => void hs.delete(t) };
    s.installUnlock(target);
    hs.get("pointerdown")!();
    expect(n).toBe(1);
    expect(hs.has("pointerdown")).toBe(false);
  });
});
