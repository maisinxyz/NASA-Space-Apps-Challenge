"use client";
// Dev page for the dive cloud loading screen (components/hero/CloudLoader.tsx). ?phase=in|hold|out&p=0..1 pins a state;
// the buttons run a fake progress ramp. Not linked from the app.
import { useEffect, useState } from "react";

import { CloudLoader, type CloudLoaderPhase } from "@/components/hero/CloudLoader";
import { heroUiFont } from "@/components/hero/fonts";

export default function CloudDev() {
  const [phase, setPhase] = useState<CloudLoaderPhase>("in");
  const [p, setP] = useState(0);
  const [ramp, setRamp] = useState(false);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("phase")) setPhase(q.get("phase") as CloudLoaderPhase);
    if (q.get("p")) setP(Number(q.get("p")));
  }, []);
  useEffect(() => {
    if (!ramp) return;
    const t0 = performance.now();
    setPhase("hold");
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 4000);
      setP(k);
      if (k >= 1) {
        clearInterval(id);
        setTimeout(() => setPhase("out"), 400);
        setRamp(false);
      }
    }, 60);
    return () => clearInterval(id);
  }, [ramp]);
  return (
    <div className={`${heroUiFont.variable} min-h-screen bg-[#2a3a22] text-white`}>
      <div className="p-6">Farm underneath (dev page for CloudLoader)</div>
      {mounted && <CloudLoader progress={p} phase={phase} onOutDone={() => setMounted(false)} />}
      <div className="fixed top-3 left-3 z-[500] flex gap-2 text-xs" data-dev-controls>
        <button className="rounded bg-black/60 px-2 py-1" onClick={() => { setMounted(true); setP(0); setPhase("in"); setTimeout(() => setRamp(true), 900); }}>run</button>
        <button className="rounded bg-black/60 px-2 py-1" onClick={() => setPhase("out")}>out</button>
      </div>
    </div>
  );
}
