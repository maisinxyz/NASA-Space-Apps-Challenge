import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORT_SENTENCE } from "@/components/ui/SupportBanner";
import type { EvidenceCard } from "@/lib/api/types";

import { EvidenceCardView } from "./EvidenceCardView";

const card: EvidenceCard = {
  rotation_id: "rot_x",
  why_suggested: "Shorter bare periods.",
  evidence: ["Runoff lower (modeled)."],
  benefits: ["Covered soil."],
  information_gaps: [],
  risks_for_local_review: ["Termination timing."],
  support_not_replace: "This tool supports, and does not replace, local agronomic expertise.",
};

describe("EvidenceCardView", () => {
  it("shows all five parts and the exact support sentence", () => {
    const html = renderToStaticMarkup(<EvidenceCardView card={card} name="Cover rotation" />);
    for (const t of ["Why it is suggested", "Evidence", "Benefits", "Information gaps", "Risks to review locally", "Shorter bare periods.", "Termination timing.", "None listed."]) expect(html).toContain(t);
    expect(html).toContain(SUPPORT_SENTENCE);
  });
});
