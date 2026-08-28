import { Component } from 'react';
import { Activity } from 'lucide-react';

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
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '2rem',
          background: '#f8fafc', textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ width: 56, height: 56, background: '#eff6ff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Activity size={28} color="#3b82f6" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, maxWidth: 320, lineHeight: 1.6 }}>
            MediSense AI ran into an unexpected error. Your data is safe.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Back to Dashboard
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: 24, fontSize: 11, color: '#94a3b8', maxWidth: 500, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}