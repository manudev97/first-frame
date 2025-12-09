import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}>
          <h1>⚠️ Error al cargar la aplicación</h1>
          <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
            {this.state.error?.message || 'Ha ocurrido un error inesperado'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Recargar Página
          </button>
          <details style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '600px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
              Detalles técnicos
            </summary>
            <pre style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '0.85rem',
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

