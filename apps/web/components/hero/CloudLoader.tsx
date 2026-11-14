"use client";
// Cloud loading screen for the click-to-farm dive: the camera is inside a cloud. A soft white-grey sky, rings of cloud
// blobs swirling around the centre at different speeds, light shafts, and a thin real progress bar. It is only
// transform/opacity layers (no filters, no canvas), so it stays cheap over a live Cesium canvas.
//   phase "in":   fades and scales in (the cloud closes around the view).
//   phase "hold": steady drift while `progress` (0..1) fills the bar.
//   phase "out":  the bar fades first, then the layers rush past the camera (scale up) and dissolve; `onOutDone` fires after.
// Reduced motion: a static soft cloud and a plain fade.
import { useEffect, useRef, useState } from "react";

import { color } from "./tokens";

export type CloudLoaderPhase = "in" | "hold" | "out";

const IN_MS = 700;
const OUT_MS = 850;
const BAR_OUT_MS = 220;

/** One ring of blobs: count, radius (% of the short side), blob size (% of the long side), seconds per turn (negative = other way). */
const RINGS = [
  { n: 9, r: 30, size: 40, turn: 95, o: 0.95 },
  { n: 12, r: 46, size: 32, turn: -70, o: 0.9 },
  { n: 8, r: 14, size: 30, turn: 55, o: 0.95 },
] as const;

const css = `
.cl-root{position:fixed;inset:0;z-index:400;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,#f3f6fb 0%,#e3e9f2 55%,#d7dfeb 100%);will-change:opacity}
.cl-layer{position:absolute;inset:0;will-change:transform,opacity}
.cl-ring{position:absolute;left:50%;top:50%;width:0;height:0;animation:cl-spin var(--turn) linear infinite;will-change:transform}
.cl-blob{position:absolute;left:0;top:0;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,var(--o)) 0%,rgba(255,255,255,calc(var(--o)*.8)) 38%,rgba(255,255,255,0) 100%);animation:cl-breathe var(--b) ease-in-out infinite alternate;will-change:transform}
.cl-shade{background:radial-gradient(closest-side,rgba(128,142,168,.5),rgba(128,142,168,.18) 50%,rgba(128,142,168,0))}
.cl-shafts{position:absolute;left:50%;top:50%;width:170vmax;height:170vmax;margin:-85vmax 0 0 -85vmax;background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,.42) 7deg,rgba(255,255,255,0) 20deg,rgba(255,255,255,0) 95deg,rgba(255,255,255,.3) 103deg,rgba(255,255,255,0) 118deg,rgba(255,255,255,0) 200deg,rgba(255,255,255,.36) 209deg,rgba(255,255,255,0) 224deg,rgba(255,255,255,0) 360deg);animation:cl-spin 140s linear infinite;will-change:transform}
@keyframes cl-spin{to{transform:rotate(360deg)}}
@keyframes cl-breathe{from{transform:translate(-50%,-50%) scale(.92)}to{transform:translate(-50%,-50%) scale(1.08)}}
.cl-bar{position:absolute;left:50%;bottom:11%;width:min(320px,62vw);transform:translateX(-50%);transition:opacity ${BAR_OUT_MS}ms ease-out}
.cl-track{height:3px;border-radius:3px;background:rgba(40,52,76,.12);overflow:hidden;backdrop-filter:none}
.cl-fill{height:100%;width:100%;border-radius:3px;transform-origin:left center;background:linear-gradient(90deg,${color.accent},#7f9fd6);transition:transform 320ms cubic-bezier(.2,.7,.2,1)}
.cl-pct{margin-top:10px;text-align:center;font-size:11px;letter-spacing:.14em;color:rgba(40,52,76,.62);font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.cl-ring,.cl-blob,.cl-shafts{animation:none}.cl-fill{transition:none}}
`;

export function CloudLoader({ progress, phase, onOutDone }: { progress: number; phase: CloudLoaderPhase; onOutDone?: () => void }) {
  const p = Math.max(0, Math.min(1, progress));
  const [reduced, setReduced] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Fire onOutDone once, when the out transition has finished.
  const doneRef = useRef(onOutDone);
  doneRef.current = onOutDone;
  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => doneRef.current?.(), reduced ? 250 : OUT_MS);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  // Displayed percentage eases toward the real progress (the bar itself uses a CSS transition).
  const [shown, setShown] = useState(0);
  const target = useRef(p);
  target.current = p;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setShown((s) => {
        const d = target.current - s;
        return Math.abs(d) < 0.002 ? target.current : s + d * 0.18;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const out = phase === "out";
  const visible = entered && !out;
  const rootStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transition: out ? `opacity ${reduced ? 250 : OUT_MS * 0.85}ms ease-in ${reduced ? 0 : OUT_MS * 0.12}ms` : `opacity ${reduced ? 200 : IN_MS}ms ease-out`,
  };
  // Layers: closing in on "in", rushing past the camera on "out".
  const layerScale = out ? 2.6 : entered ? 1 : 0.78;
  const layerStyle: React.CSSProperties = {
    transform: reduced ? undefined : `scale(${layerScale})`,
    transition: reduced ? undefined : out ? `transform ${OUT_MS}ms cubic-bezier(.5,0,.9,.4)` : `transform ${IN_MS + 300}ms cubic-bezier(.2,.7,.2,1)`,
  };

  return (
    <div className="cl-root" role="progressbar" aria-label="Loading the farm" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} style={rootStyle}>
      <style>{css}</style>
      <div className="cl-layer" style={layerStyle}>
        <div className="cl-shafts" style={{ opacity: 0.8 }} />
        {RINGS.map((ring, ri) => (
          <div key={ri} className="cl-layer" style={{ transform: reduced ? undefined : `scale(${1 + ri * 0.08})` }}>
            <div className="cl-ring" style={{ ["--turn" as string]: `${Math.abs(ring.turn)}s`, animationDirection: ring.turn < 0 ? "reverse" : "normal" }}>
              {Array.from({ length: ring.n }, (_, i) => {
                const a = (i / ring.n) * Math.PI * 2 + ri;
                const jitter = 0.78 + ((i * 37 + ri * 11) % 10) / 22;
                return (
                  <div
                    key={i}
                    className={`cl-blob${i % 3 === 2 ? " cl-shade" : ""}`}
                    style={{
                      width: `${(ring.size * jitter).toFixed(2)}vmax`,
                      height: `${(ring.size * jitter * 0.8).toFixed(2)}vmax`,
                      left: `${(Math.cos(a) * ring.r).toFixed(2)}vmin`,
                      top: `${(Math.sin(a) * ring.r).toFixed(2)}vmin`,
                      ["--o" as string]: ring.o,
                      ["--b" as string]: `${6 + ((i * 5 + ri * 3) % 7)}s`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="cl-bar" style={{ opacity: out ? 0 : visible ? 1 : 0, fontFamily: "var(--font-hero-ui), ui-sans-serif, system-ui, sans-serif" }}>
        <div className="cl-track">
          <div className="cl-fill" style={{ transform: `scaleX(${p})` }} />
        </div>
        <div className="cl-pct">{Math.round(shown * 100)}%</div>
      </div>
    </div>
  );
}
