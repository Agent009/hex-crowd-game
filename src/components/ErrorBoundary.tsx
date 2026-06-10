import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label used in the fallback heading and logs. */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Top-level application error boundary. Catches render/runtime errors anywhere
 * in the tree and presents a recoverable fallback instead of a blank screen.
 * "Reload" performs a hard refresh; "Try again" attempts an in-place recovery.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`${this.props.label ?? 'Application'} error:`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        data-testid="app-error-boundary"
        role="alert"
        className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"
      >
        <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-slate-900/95 p-8 text-center shadow-2xl">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-300" />
          <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-6 text-sm text-slate-300">
            The game hit an unexpected error. Your session is safe — try recovering
            below, or reload to start fresh.
          </p>
          {this.state.message && (
            <pre className="mb-6 max-h-28 overflow-auto rounded-md bg-slate-950 p-3 text-left text-xs text-red-200/80">
              {this.state.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
