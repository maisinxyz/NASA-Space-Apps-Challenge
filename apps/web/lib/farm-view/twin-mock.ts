// Twin answers (design-spec §2.8): mocked from the SAMPLE fields, answer first, real sample numbers, no emoji.
// TODO(api): replace with real Twin endpoint (none in packages/contracts/openapi.yaml yet).
import { SAMPLE_FIELDS, STRESS_LINE, underStress } from "./sample";

export type TwinAnswer = { status: string; answer: string; chips: readonly string[] };

export const TWIN_THINK_MS = 900;
const FOLLOW_UP = "Why not the main block?";

export function twinAnswer(question: string): TwinAnswer {
  const q = question.toLowerCase();
  const stressed = SAMPLE_FIELDS.filter(underStress).sort((a, b) => a.moisture - b.moisture);
  const driest = stressed[0];
  const main = SAMPLE_FIELDS.find((f) => f.id === "main-block");
  if (main && q.includes("main block")) {
    return {
      status: "Comparing Main block with Trial plots…",
      answer: `Main block is dry too, at ${main.moisture}% of capacity, but ${driest.name} is lower at ${driest.moisture}% and its NDVI (${driest.ndvi.toFixed(2)}) has already dropped below Main block's (${main.ndvi.toFixed(2)}). Water ${driest.name} first.`,
      chips: [],
    };
  }
  return {
    status: `Reading soil moisture for ${SAMPLE_FIELDS.length} fields…`,
    answer: `${driest.name} needs water first: soil moisture is ${driest.moisture}% of capacity, the lowest of ${SAMPLE_FIELDS.length} fields, and ${stressed.length} fields are under the ${STRESS_LINE}% stress line.`,
    chips: [FOLLOW_UP],
  };
}
