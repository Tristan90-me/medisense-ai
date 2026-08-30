import { Component } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('MediSense Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-8 text-center font-sans">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Activity size={28} className="text-primary" />
          </div>
          <div>
            <h1 className="mb-2 font-heading text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
              MediSense AI ran into an unexpected error. Your data is safe.
            </p>
          </div>
          <Button onClick={() => (window.location.href = '/dashboard')} className="rounded-full px-6">
            Back to Dashboard
          </Button>
          {import.meta.env.DEV && (
            <details className="mt-4 max-w-lg text-left text-xs text-muted-foreground">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all">{this.state.error?.toString()}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
