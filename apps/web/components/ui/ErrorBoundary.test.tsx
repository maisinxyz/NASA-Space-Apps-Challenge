import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useAppStore } from "@/lib/store";

import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("renders children when no error is present", () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <div>Safe child content</div>
      </ErrorBoundary>
    );
    expect(html).toContain("Safe child content");
  });

  it("getDerivedStateFromError captures error in state", () => {
    const error = new Error("Test failure");
    const state = ErrorBoundary.getDerivedStateFromError(error);
    expect(state).toEqual({ hasError: true, error });
  });

  it("renders recoverable ErrorCard when state hasError is true", () => {
    const boundary = new ErrorBoundary({ fallbackTitle: "Farm view error", children: <div>Child</div> });
    boundary.state = { hasError: true, error: new Error("Simulated breakdown") };
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);

    expect(html).toContain("Farm view error");
    expect(html).toContain("Simulated breakdown");
    expect(html).toContain("Try again");
    expect(html).toContain("Return to Globe");
  });

  it("handleReset resets error state and updates store", () => {
    let resetCalled = false;
    const boundary = new ErrorBoundary({
      fallbackTitle: "Farm view error",
      onReset: () => {
        resetCalled = true;
      },
      children: <div>Child</div>,
    });
    type BoundaryState = { hasError: boolean; error: Error | null };
    boundary.state = { hasError: true, error: new Error("Test error") };
    boundary.setState = ((updater: BoundaryState | ((prev: BoundaryState) => BoundaryState)) => {
      boundary.state = typeof updater === "function" ? updater(boundary.state) : updater;
    }) as unknown as typeof boundary.setState;

    boundary.handleReset();
    expect(boundary.state.hasError).toBe(false);
    expect(resetCalled).toBe(true);

    // Default reset when onReset is not provided
    const defaultBoundary = new ErrorBoundary({ children: <div>Child</div> });
    defaultBoundary.state = { hasError: true, error: new Error("Test error") };
    defaultBoundary.setState = ((updater: BoundaryState | ((prev: BoundaryState) => BoundaryState)) => {
      defaultBoundary.state = typeof updater === "function" ? updater(defaultBoundary.state) : updater;
    }) as unknown as typeof defaultBoundary.setState;

    useAppStore.setState({ globeView: "farm", farmId: "cornell" });
    defaultBoundary.handleReset();
    expect(defaultBoundary.state.hasError).toBe(false);
    expect(useAppStore.getState().globeView).toBe("globe");
    expect(useAppStore.getState().farmId).toBeNull();
  });
});
