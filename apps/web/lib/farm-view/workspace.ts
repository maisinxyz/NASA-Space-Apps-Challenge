import { useFutureStore } from '@/lib/farm-future/store';
import { usePlannerStore } from '@/lib/rotation-planner/store';
import { useCopilot } from '@/lib/copilot/copilot';

/** Close rather than toggle: safe even when the requested surface is already shut. */
export function closeWorkspaceTools() {
  useFutureStore.setState({ panel: null, reviewFor: null });
  usePlannerStore.setState({ open: false });
  useCopilot.getState().close();
}

/** All entry points, including contextual Ask Gus links, share one desktop surface. */
export function coordinateWorkspace(closeDrawer: () => void) {
  let coordinating = false;
  const select = (surface: 'future' | 'planner' | 'gus') => {
    if (coordinating) return;
    coordinating = true;
    try {
      closeDrawer();
      if (surface !== 'future') useFutureStore.setState({ panel: null, reviewFor: null });
      else if (useFutureStore.getState().panel !== 'review') useFutureStore.setState({ reviewFor: null });
      if (surface !== 'planner') usePlannerStore.setState({ open: false });
      if (surface !== 'gus') useCopilot.getState().close();
    } finally { coordinating = false; }
  };
  const stop = [
    useFutureStore.subscribe((s, p) => { if (s.panel && s.panel !== p.panel) select('future'); }),
    usePlannerStore.subscribe((s, p) => { if (s.open && !p.open) select('planner'); }),
    useCopilot.subscribe((s, p) => { if (s.open && !p.open) select('gus'); }),
  ];
  return () => stop.forEach((unsubscribe) => unsubscribe());
}
