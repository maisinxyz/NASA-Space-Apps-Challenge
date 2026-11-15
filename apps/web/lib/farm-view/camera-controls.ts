export type CameraAction = `pan-${"left" | "right" | "up" | "down"}` | `orbit-${"left" | "right" | "up" | "down"}` | "zoom-in" | "zoom-out";

/** Use only when the camera surface or its controls have focus. */
export function cameraActionForKey(key: string, shift: boolean): CameraAction | null {
  const direction = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const)[key as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"];
  if (direction) return `${shift ? "orbit" : "pan"}-${direction}`;
  if (key === "+" || key === "=") return "zoom-in";
  if (key === "-" || key === "_") return "zoom-out";
  return null;
}
