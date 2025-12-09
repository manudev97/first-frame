// Wrapper que asegura que DynamicWidget solo se renderice cuando el contexto esté listo
import { useState, useEffect } from 'react';
import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';

export function DynamicWidgetWrapper() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar si el contexto está disponible
  let contextAvailable = false;
  let contextError: Error | null = null;
  try {
    useDynamicContext();
    contextAvailable = true;
  } catch (err) {
    contextAvailable = false;
    contextError = err as Error;
  }

  useEffect(() => {
    // CRÍTICO: Renderizar inmediatamente si el contexto está disponible
    // No esperar delays innecesarios que bloqueen la UI
    // ESPECIALMENTE IMPORTANTE en Telegram Mini App
    if (contextAvailable) {
      setIsReady(true);
      return;
    }

    // Si el contexto no está disponible, intentar después de un breve delay
    // pero no bloquear la UI por mucho tiempo
    // En Telegram Mini App, usar requestIdleCallback para no bloquear el render inicial
    const checkContext = () => {
      try {
        useDynamicContext();
        setIsReady(true);
        setError(null);
      } catch (err) {
        console.warn('⚠️ Dynamic context aún no está disponible:', err);
        // No mostrar error inmediatamente, intentar de nuevo
        // Intentar de nuevo después de más tiempo
        setTimeout(() => {
          try {
            useDynamicContext();
            setIsReady(true);
            setError(null);
          } catch (e) {
            console.error('❌ Error: Dynamic context no está disponible después de múltiples intentos');
            setError('Error al cargar el wallet. Por favor recarga la página.');
          }
        }, 2000);
      }
    };

    // Usar requestIdleCallback en Telegram Mini App para no bloquear el render inicial
    if (window.requestIdleCallback) {
      window.requestIdleCallback(checkContext, { timeout: 500 });
    } else {
      // Fallback: setTimeout con delay mínimo
      const timer = setTimeout(checkContext, 100);
      return () => clearTimeout(timer);
    }
  }, [contextAvailable]);

  // Si hay error, mostrar mensaje pero permitir que se intente renderizar
  if (error && !isReady) {
    return (
      <div style={{
        padding: '0.75rem 1.5rem',
        background: '#ffa500',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '0.875rem',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {error}
      </div>
    );
  }

  // Mostrar placeholder solo si realmente no está listo
  if (!isReady) {
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

  // Renderizar el widget cuando esté listo
  // El DynamicContextProvider ya está disponible desde DynamicProvider
  // CRÍTICO: Usar DynamicWidget sin props adicionales que puedan causar ciclos infinitos
  // El redirectUrl ya está configurado en DynamicProvider
  try {
    return <DynamicWidget />;
  } catch (err) {
    console.error('❌ Error renderizando DynamicWidget:', err);
    return (
      <div style={{
        padding: '0.75rem 1.5rem',
        background: '#ff4444',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '0.875rem',
      }}>
        ⚠️ Error al cargar el widget. Verifica la consola para más detalles.
      </div>
    );
  }
}

