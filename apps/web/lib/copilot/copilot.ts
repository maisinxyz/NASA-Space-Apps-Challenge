// Farm co-pilot (v4 PRD F6, contract A.2): screen-state snapshot, chat store, term tooltips.
// The client sends ids and slider values only, never forecast numbers; the server builds the numbers from the snapshot.
import { create } from "zustand";

import { ApiError, isMock, postCopilotChat } from "@/lib/api/client";
import type { CopilotChatRequest, CopilotSnapshot } from "@/lib/api/types";

export type SelectedKind = "field" | "flag" | "strategy";
export type ChatMessage = { role: "user" | "assistant"; content: string; tips?: string[]; layers?: string[]; placeholder?: boolean };

export type ScreenState = {
  farmId: string;
  siteId: string;
  fieldId: string | null;
  horizon: "years" | "months";
  timeIndex: number;
  rainPct: number;
  tempC: number;
  strategyId: string | null;
  selected: { kind: SelectedKind; id: string } | null;
};

export const MAX_MESSAGE = 1000;
export const MAX_HISTORY = 6;

export function snapshotOf(s: ScreenState): CopilotSnapshot {
  return {
    farm_id: s.farmId,
    site_id: s.siteId,
    field_id: s.fieldId,
    horizon: s.horizon,
    time_index: Math.max(0, Math.round(s.timeIndex)),
    scenario: { preset: "baseline", rain_scale_pct: s.rainPct, temp_offset_c: s.tempC },
    strategy_id: s.strategyId && /^rot_[A-Za-z0-9_-]+$/.test(s.strategyId) ? s.strategyId : null,
    selected: s.selected,
  };
}

/** Request body: message trimmed to the contract limit, the last six turns as history. */
export function requestOf(message: string, s: ScreenState, history: ChatMessage[]): CopilotChatRequest {
  return {
    message: message.trim().slice(0, MAX_MESSAGE),
    snapshot: snapshotOf(s),
    history: history.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
  };
}

/** Plain words for the contract errors (A.2). */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "RATE_LIMITED") return "Gus is busy. Wait a moment and ask again.";
    if (e.code === "DATA_SOURCE_UNAVAILABLE") return "Gus is unavailable right now: the server may be missing its provider credentials or could not load the farm context. Try again later. The forecast on screen is unaffected.";
    if (e.code === "INVALID_INPUT") return `Gus is unavailable for this view. ${e.message.replace(/the co-pilot/gi, "Gus").replace(/co-pilot/gi, "Gus")}`;
    return e.message.replace(/the co-pilot/gi, "Gus").replace(/co-pilot/gi, "Gus");
  }
  return "Gus did not answer. Try again.";
}

/** One-sentence explanations for terms the co-pilot and the panels use. */
export const TERMS: Record<string, string> = {
  evapotranspiration: "Water that leaves the field as vapour, from the soil and through the crop's leaves.",
  NDVI: "A satellite greenness index from red and near-infrared light; higher means more living leaf cover.",
  "soil-moisture anomaly": "How much wetter or drier the soil is than usual for that time of year.",
  "p10–p90": "The range the forecast puts 8 in 10 outcomes inside; p50 is the middle value.",
};
export const termsIn = (text: string) => Object.keys(TERMS).filter((t) => text.toLowerCase().includes(t.toLowerCase()));

type ChatState = {
  open: boolean;
  draft: string;
  pendingFarm: string | null;
  conversation: number;
  selected: ScreenState["selected"];
  /** Overrides the screen's strategy/field when a button asks about a specific one. */
  strategyId: string | null;
  fieldId: string | null;
  messages: ChatMessage[];
  status: "idle" | "sending" | "error";
  error: string | null;
  ask(q: { question: string; kind: SelectedKind; id: string; strategyId?: string | null; fieldId?: string | null }): void;
  startFarm(farmId: string, question?: string): void;
  send(message: string, screen: ScreenState): Promise<void>;
  close(): void;
};

export const useCopilot = create<ChatState>((set, get) => ({
  open: false,
  draft: "",
  pendingFarm: null,
  conversation: 0,
  selected: null,
  strategyId: null,
  fieldId: null,
  messages: [],
  status: "idle",
  error: null,
  ask: ({ question, kind, id, strategyId = null, fieldId = null }) => set({ open: true, draft: question, selected: { kind, id }, strategyId, fieldId, error: null }),
  startFarm: (farmId, question) => set((state) => ({
    conversation: state.conversation + 1, open: !!question?.trim(), draft: question ?? "",
    pendingFarm: question ? farmId : null, selected: null, strategyId: null, fieldId: null,
    messages: [], status: "idle", error: null,
  })),
  async send(message, screen) {
    if (!message.trim()) return;
    bindCopilotFarm(screen.farmId);
    if (get().status === "sending") return;
    const generation = ++requestGeneration;
    const history = get().messages;
    const conversation = get().conversation;
    const body = requestOf(message, screen, history);
    set({ messages: [...history, { role: "user", content: body.message }], draft: "", status: "sending", error: null });
    try {
      const r = await postCopilotChat(body);
      if (generation !== requestGeneration) return;
      set((s) => ({ messages: [...s.messages, { role: "assistant", content: r.reply, tips: r.local_validation_tips, layers: r.referenced_layers, ...(isMock && { placeholder: true }) }], status: "idle" }));
    } catch (e) {
      if (generation !== requestGeneration) return;
      set((s) => ({ messages: history, draft: s.draft || body.message, status: "error", error: errorText(e) }));
    }
  },
  close: () => set({ open: false }),
}));


let boundFarm: string | null = null;
let requestGeneration = 0;

/** Clear the conversation and invalidate requests when leaving a farm or resetting the workspace. */
export function resetCopilot() {
  requestGeneration += 1;
  boundFarm = null;
  useCopilot.setState(useCopilot.getInitialState());
}

/** Called by the farm workspace on navigation; rebinding the current farm preserves its conversation. */
export function bindCopilotFarm(farmId: string | null) {
  if (boundFarm === farmId) return;
  if (boundFarm !== null || farmId === null) resetCopilot();
  boundFarm = farmId;
}
