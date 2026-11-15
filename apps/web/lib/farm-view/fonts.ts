// Farm view typefaces (SIL Open Font License), self-hosted by next/font at build time like the hero fonts.
// Newsreader: titles and dates only. Geist: everything else.
import { Geist, Newsreader } from "next/font/google";

export const fvDisplayFont = Newsreader({ subsets: ["latin"], variable: "--fv-font-display", display: "swap" });
export const fvSansFont = Geist({ subsets: ["latin"], variable: "--fv-font-sans", display: "swap" });
