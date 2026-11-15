import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFutureStore, resetFutureInvestigation } from '@/lib/farm-future/store';
import { usePlannerStore } from '@/lib/rotation-planner/store';
import { useCopilot } from '@/lib/copilot/copilot';
import { coordinateWorkspace, closeWorkspaceTools } from './workspace';

afterEach(() => { closeWorkspaceTools(); resetFutureInvestigation(); });
describe('one desktop workspace at a time', () => {
  it('opening any stored tool closes simulation as well as the drawer', () => {
    const closeSimulation = vi.fn();
    const stop = coordinateWorkspace(() => {}, closeSimulation);
    usePlannerStore.setState({ open: true });
    useCopilot.setState({ open: true });
    useFutureStore.getState().openPanel('forecast');
    expect(closeSimulation).toHaveBeenCalledTimes(3);
    stop();
  });
  it('replaces planner with Gus and closes the local drawer', () => {
    const closeDrawer = vi.fn();
    const stop = coordinateWorkspace(closeDrawer);
    usePlannerStore.setState({ open: true });
    useCopilot.setState({ open: true });
    expect(usePlannerStore.getState().open).toBe(false);
    expect(useCopilot.getState().open).toBe(true);
    expect(closeDrawer).toHaveBeenCalled();
    stop();
  });
  it('opening a future detail closes Gus, planner and any old review', () => {
    const stop = coordinateWorkspace(() => {});
    useFutureStore.getState().openReview('a');
    useCopilot.setState({ open: true });
    useFutureStore.getState().openPanel('forecast');
    expect(useCopilot.getState().open).toBe(false);
    expect(usePlannerStore.getState().open).toBe(false);
    expect(useFutureStore.getState().reviewFor).toBeNull();
    expect(useFutureStore.getState().panel).toBe('forecast');
    stop();
  });
  it('closing local tools clears every competing surface', () => {
    usePlannerStore.setState({ open: true });
    useCopilot.setState({ open: true });
    useFutureStore.getState().openReview('a');
    closeWorkspaceTools();
    expect(usePlannerStore.getState().open).toBe(false);
    expect(useCopilot.getState().open).toBe(false);
    expect(useFutureStore.getState().panel).toBeNull();
    expect(useFutureStore.getState().reviewFor).toBeNull();
  });
});
