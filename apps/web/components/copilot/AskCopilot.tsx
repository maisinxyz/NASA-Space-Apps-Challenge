"use client";
// "Ask co-pilot" button: opens the chat with a prefilled question about one field, flag or strategy (F6).
import { useCopilot, type SelectedKind } from "@/lib/copilot/copilot";

import { FvButton } from "@/components/farm-view/FvButton";

export function AskCopilot({ kind, id, question, strategyId = null, fieldId = null }: { kind: SelectedKind; id: string; question: string; strategyId?: string | null; fieldId?: string | null }) {
  return (
    <FvButton className="ff-link" data-testid={`ask-copilot-${kind}`} onClick={() => useCopilot.getState().ask({ question, kind, id, strategyId, fieldId })}>
      Ask co-pilot
    </FvButton>
  );
}
