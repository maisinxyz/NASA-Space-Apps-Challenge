// Hero typefaces, all SIL Open Font License, self-hosted by next/font at build time (the demo works offline).
// Syncopate Bold: the wide, heavy capitals for the wordmark and the arrival title. Manrope: UI text.
// IBM Plex Mono: numbers only (coordinates, metrics), always tabular.
import { IBM_Plex_Mono, Manrope, Syncopate } from "next/font/google";

export const heroWordFont = Syncopate({ weight: "700", subsets: ["latin"], variable: "--font-hero-word", display: "swap" });
export const heroUiFont = Manrope({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-hero-ui", display: "swap" });
export const heroMonoFont = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-hero-mono", display: "swap" });
