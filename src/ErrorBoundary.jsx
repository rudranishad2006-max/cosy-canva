import { Component } from 'react';

// Catches render/runtime errors anywhere in the tree so a single failure (e.g. a Firestore
// hiccup) shows a friendly recovery screen instead of a blank white page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('CozyCanvas crashed:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            color: '#e8e0d8',
            background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong 💔</h1>
          <p style={{ opacity: 0.6, margin: '0 0 20px', maxWidth: 420, lineHeight: 1.5 }}>
            CozyCanvas hit an unexpected error. Your drawings are saved in the room — try reloading.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #e8a87c, #d4a59a)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
