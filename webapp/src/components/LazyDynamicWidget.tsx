// Componente que carga DynamicWidget de forma lazy
import { useState, useEffect } from 'react';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';

export function LazyDynamicWidget() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Cargar después de que la página esté visible
    // Usar requestIdleCallback para no bloquear el render inicial
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        setShouldLoad(true);
      }, { timeout: 500 });
    } else {
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // Mostrar placeholder mientras carga para no bloquear
  // El DynamicContextProvider ya está disponible desde DynamicProvider
  if (!shouldLoad) {
    return (
      <div style={{
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        cursor: 'pointer',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Cargando wallet...
      </div>
    );
  }

  // Una vez que debería cargar, renderizar el widget real
  // El DynamicContextProvider ya está disponible desde DynamicProvider
  try {
    return <DynamicWidget />;
  } catch (error) {
    // Si hay error, mostrar placeholder
    console.warn('Error cargando DynamicWidget:', error);
    return (
      <div style={{
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Error cargando wallet
      </div>
    );
  }
}

