import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | undefined };

/** Renders a recoverable message instead of a white screen if anything below throws. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Battleship crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error === undefined) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>The game hit an unexpected error and had to stop.</p>
        <pre>{error.message}</pre>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Reload the game
        </button>
      </main>
    );
  }
}
