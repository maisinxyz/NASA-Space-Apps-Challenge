// One icon set for the hero: 16 px, 1.5 px stroke, round caps and joins, currentColor. Decorative (aria-hidden);
// the button around each icon carries the label.
import type { SVGProps } from "react";

function Icon({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** Folded map with a waypoint. */
export const MapsIcon = () => (
  <Icon>
    <path d="M1.75 3.75 5.5 2.25l5 1.5 3.75-1.5v10l-3.75 1.5-5-1.5-3.75 1.5z" />
    <path d="M5.5 2.25v10M10.5 3.75v10" />
  </Icon>
);

/** Stacked sheets. */
export const LayersIcon = () => (
  <Icon>
    <path d="M8 1.75 14.25 5 8 8.25 1.75 5z" />
    <path d="m1.75 8 6.25 3.25L14.25 8" />
    <path d="m1.75 11 6.25 3.25L14.25 11" />
  </Icon>
);

/** Viewfinder corners with a scan line. */
export const ScanIcon = () => (
  <Icon>
    <path d="M1.75 5V3.25a1.5 1.5 0 0 1 1.5-1.5H5M11 1.75h1.75a1.5 1.5 0 0 1 1.5 1.5V5M14.25 11v1.75a1.5 1.5 0 0 1-1.5 1.5H11M5 14.25H3.25a1.5 1.5 0 0 1-1.5-1.5V11" />
    <path d="M4.5 8h7" />
  </Icon>
);

/** Two sliders. */
export const SettingsIcon = () => (
  <Icon>
    <path d="M2 5h6M12 5h2M2 11h2M8 11h6" />
    <circle cx="10" cy="5" r="1.75" />
    <circle cx="6" cy="11" r="1.75" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);
