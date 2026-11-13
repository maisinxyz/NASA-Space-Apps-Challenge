import { ApiError } from "./api/client";
import type { SimulationStatus } from "./api/types";

/** Stop waiting immediately when a replay is invalidated; never schedule another poll. */
function pollDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** Shared by new jobs and restored jobs. Existing client requests cannot be aborted,
 * so their late responses are discarded; cancellation also clears the polling timer. */
export async function followSimulation({ initial, read, signal, onProgress, pollMs = 1000 }: {
  initial(): Promise<SimulationStatus>;
  read(id: string): Promise<SimulationStatus>;
  signal: AbortSignal;
  onProgress(status: SimulationStatus): void;
  pollMs?: number;
}): Promise<SimulationStatus | null> {
  if (signal.aborted) return null;
  try {
    let status = await initial();
    while (!signal.aborted) {
      if (status.status === "failed") {
        throw new ApiError(status.error ?? { code: "INTERNAL", message: "The simulation failed.", retryable: true }, 0);
      }
      if (status.status === "done") return status;
      onProgress(status);
      await pollDelay(pollMs, signal);
      if (signal.aborted) return null;
      status = await read(status.id);
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  }
  return null;
}

type Inputs = { terrainId: string | null; stormId: string | null; simRotationIds: string[]; simId: string | null };

/** Reset and any change to a simulation input invalidate pending and completed runs. */
export function simulationInvalidated(next: Inputs, previous: Inputs): boolean {
  return next.terrainId !== previous.terrainId || next.stormId !== previous.stormId ||
    next.simRotationIds.length !== previous.simRotationIds.length ||
    next.simRotationIds.some((id, i) => id !== previous.simRotationIds[i]) ||
    (previous.simId !== null && next.simId === null);
}
