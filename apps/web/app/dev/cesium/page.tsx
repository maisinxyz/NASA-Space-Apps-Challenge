"use client";
// Dev harness for the Cesium globe + drape/split spike (card C1). Not part of the product UI.
import dynamic from "next/dynamic";

const Spike = dynamic(() => import("@/components/viewer/cesium/Spike"), { ssr: false, loading: () => <p className="p-4 text-sm">Loading Cesium…</p> });

export default function DevCesium() {
  return <Spike />;
}
