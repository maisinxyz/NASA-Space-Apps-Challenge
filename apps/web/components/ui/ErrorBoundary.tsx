"use client";
import React, { Component, type ErrorInfo, type ReactNode } from "react";

import { useAppStore } from "@/lib/store";

import { ErrorCard } from "./ErrorCard";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Standard React error boundary catching rendering exceptions.
 * Renders an ErrorCard with a recoverable state ("Return to Globe" / "Try again").
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      useAppStore.setState({ globeView: "globe", farmId: null });
    }
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="pointer-events-auto z-50 mx-auto my-auto max-w-md p-6">
          <ErrorCard
            title={this.props.fallbackTitle ?? "View unavailable"}
            error={this.state.error}
            onRetry={this.handleReset}
          >
            <button
              type="button"
              onClick={() => useAppStore.setState({ globeView: "globe", farmId: null })}
              className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-line"
            >
              Return to Globe
            </button>
          </ErrorCard>
        </div>
      );
    }
    return this.props.children;
  }
}
