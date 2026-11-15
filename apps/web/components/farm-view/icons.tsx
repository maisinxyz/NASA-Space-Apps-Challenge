// One icon family: 1.6 px stroke, round caps and joins, currentColor (Lucide-style paths).
import type { ReactNode } from "react";

import { iconStroke } from "@/lib/farm-view/tokens";

const I = ({ size = 16, children }: { size?: number; children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
type P = { size?: number };
export const Droplet = (p: P) => <I {...p}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /></I>;
export const Leaf = (p: P) => <I {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" /><path d="M2 21c0-3 1.9-5.5 6-7" /></I>;
export const Thermometer = (p: P) => <I {...p}><path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z" /></I>;
export const RotateCcw = (p: P) => <I {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></I>;
export const ChevronLeft = (p: P) => <I {...p}><path d="m15 18-6-6 6-6" /></I>;
export const ChevronRight = (p: P) => <I {...p}><path d="m9 18 6-6-6-6" /></I>;
export const PanelLeft = (p: P) => <I {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></I>;
export const Volume2 = (p: P) => <I {...p}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></I>;
export const Minus = (p: P) => <I {...p}><path d="M5 12h14" /></I>;
export const X = (p: P) => <I {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></I>;
export const ArrowUp = (p: P) => <I {...p}><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></I>;
export const VolumeX =(p: P) => <I {...p}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></I>;

/** The FieldTwin logo. The gold sparkle belongs to the AI button only (spec). */
export function Logo({ size = 26, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden>
      <path d="M24 44V24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 26C15 26 9 20 9 11c9 0 15 6 15 15z" fill="currentColor" />
      <rect x="28" y="19" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="33" y="14" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="38" y="9" width="5" height="5" rx="1" fill="currentColor" />
      <path
        d="M41 2c.5 4.2 1.3 5 5.5 5.5-4.2.5-5 1.3-5.5 5.5-.5-4.2-1.3-5-5.5-5.5 4.2-.5 5-1.3 5.5-5.5z"
        fill="#E2B866"
        style={spin ? { transformBox: "fill-box", transformOrigin: "center", animation: "fv-spin 2400ms linear infinite" } : undefined}
      />
    </svg>
  );
}
