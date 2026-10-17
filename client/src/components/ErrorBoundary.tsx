import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StateCard } from './StateCard';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

/**
 * Keeps a render-time crash (for example a malformed API payload) inside one
 * recoverable state card instead of blanking the whole routed area.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="card">
          <StateCard
            badge="Temporary issue"
            title="This page hit a snag"
            description="Something in the response did not look right. Try loading it again."
            retryAction={() => this.setState({ failed: false })}
          />
        </div>
      </div>
    );
  }
}
