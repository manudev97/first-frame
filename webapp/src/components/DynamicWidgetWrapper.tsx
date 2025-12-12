// Wrapper que asegura que DynamicWidget solo se renderice cuando el contexto esté listo
import { useState, useEffect, useRef } from 'react';
import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';

export function DynamicWidgetWrapper() {
  const [isReady, setIsReady] = useState(false);
  const hasChecked = useRef(false);

  // CRÍTICO: Verificar contexto UNA SOLA VEZ para evitar re-renders infinitos
  useEffect(() => {
    if (hasChecked.current) return;
    
    // Intentar verificar el contexto inmediatamente
    const checkContext = () => {
      try {
        useDynamicContext();
        setIsReady(true);
        hasChecked.current = true;
      } catch (err) {
        // Si falla, intentar después de un breve delay
        // pero no bloquear la UI por mucho tiempo
        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => {
            try {
              useDynamicContext();
              setIsReady(true);
              hasChecked.current = true;
            } catch (e) {
              // Si aún falla después del delay, renderizar de todos modos
              // DynamicWidget puede manejar el error internamente
              console.warn('⚠️ Dynamic context no disponible, renderizando de todos modos');
              setIsReady(true);
              hasChecked.current = true;
            }
          }, { timeout: 200 });
        } else {
          setTimeout(() => {
            try {
              useDynamicContext();
              setIsReady(true);
              hasChecked.current = true;
            } catch (e) {
              console.warn('⚠️ Dynamic context no disponible, renderizando de todos modos');
              setIsReady(true);
              hasChecked.current = true;
            }
          }, 100);
        }
      }
    };

    checkContext();
  }, []); // Array vacío = solo ejecutar una vez

  // CRÍTICO: Renderizar DynamicWidget inmediatamente si está listo
  // Si no está listo, mostrar un placeholder mínimo sin bloquear
  if (!isReady) {
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
        Loading wallet...
      </div>
    );
  }

  // CRÍTICO: Renderizar DynamicWidget sin ningún wrapper adicional
  // En móvil, cualquier wrapper puede interferir con el modal del sandbox
  // El redirectUrl ya está configurado en DynamicProvider
  return <DynamicWidget />;
}

