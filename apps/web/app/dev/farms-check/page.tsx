"use client";
// Dev-only farm 3D check: flies the viewer through every scouted candidate and prints the stage-1 numbers. Not product UI.
import dynamic from "next/dynamic";

const FarmsCheck = dynamic(() => import("./FarmsCheck"), { ssr: false, loading: () => <p className="p-4 text-sm">Loading Cesium…</p> });

export default function DevFarmsCheck() {
  return <FarmsCheck />;
}
