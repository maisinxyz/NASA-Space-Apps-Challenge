"use client";
import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useRotationStore } from "@/lib/rotation/store";
import { resetZoneToggle } from "@/components/rotation/fe2/ZoneOverlay";
import { RESET_EVENT } from "@/lib/keys";

export function InvestigationControls({simulationAvailable = true}: {simulationAvailable?: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [help, setHelp] = useState(false);
  const close = () => {
    dialog.current?.close();
    trigger.current?.focus();
  };
  return (
    <div
      className="fv-glass"
      style={{
        padding: 8,
        borderRadius: 12,
        fontSize: 13,
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <button
          type="button"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          Keyboard shortcuts
        </button>
        <button
          type="button"
          ref={trigger}
          onClick={() => dialog.current?.showModal()}
        >
          Reset investigation
        </button>
      </div>
      {help && (
        <p>
          {simulationAvailable ? "1 Explore · 2 Scenarios · 3 Compare · 4 Evidence · " : ""}H show/hide panels{simulationAvailable ? " · Escape close" : ""}. Camera keys work only with the map focused. Reset camera preserves your inputs.
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="reset-investigation-title"
        onClose={() => trigger.current?.focus()}
        style={{
          maxWidth: "min(440px,calc(100vw - 32px))",
          padding: 24,
          borderRadius: 16,
          background: "#211e1a",
          color: "#f2ebdd",
          border: "1px solid #777",
          margin: "auto",
        }}
      >
        <h2 id="reset-investigation-title">Reset investigation?</h2>
        <p>
          This clears selected farm, scenario inputs, comparisons, and viewing
          settings. Reset camera changes only your viewpoint.
        </p>
        <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
          <button type="button" autoFocus onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              useAppStore.getState().reset();
              useRotationStore.getState().reset();
              resetZoneToggle();
              history.replaceState(
                null,
                "",
                location.pathname + location.search,
              );
              window.dispatchEvent(new Event(RESET_EVENT));
              close();
            }}
          >
            Reset investigation
          </button>
        </div>
      </dialog>
    </div>
  );
}
