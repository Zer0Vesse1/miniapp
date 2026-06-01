import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px 20px', maxWidth: 500, margin: '60px auto',
          textAlign: 'center', fontFamily: 'sans-serif',
        }}>
          <h2 style={{ marginBottom: 12 }}>页面出错了</h2>
          <pre style={{
            background: '#1e293b', color: '#f87171', padding: 16,
            borderRadius: 8, fontSize: 13, textAlign: 'left',
            overflow: 'auto', maxHeight: 300,
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              marginTop: 16, padding: '10px 28px', background: '#38bdf8',
              color: '#0f172a', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
