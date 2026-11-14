"use client";
// Dev-only field tracer: click Google 3D tiles to record field rings, sim squares and start framings. Not product UI.
import dynamic from "next/dynamic";

const Tracer = dynamic(() => import("./Tracer"), { ssr: false, loading: () => <p className="p-4 text-sm">Loading Cesium…</p> });

export default function DevTrace() {
  return <Tracer />;
}
