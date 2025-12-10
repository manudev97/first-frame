import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// CRÍTICO: setupInsideIframe debe llamarse ANTES de que React se monte
// Según la documentación de Dynamic: https://www.dynamic.xyz/docs/react-sdk/iframe
// "Initialize as early as possible in your iframe application"
// IMPORTANTE: En Telegram Mini App, necesitamos agregar initial-parent-url a la URL
// PERO: No bloquear el render si hay errores - la app debe cargar de todos modos
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  // CRÍTICO: Ejecutar INMEDIATAMENTE, no en setTimeout
  // La documentación dice "as early as possible", así que no debemos esperar
  try {
    // Agregar initial-parent-url a la URL si no existe
    // Esto es necesario para que setupInsideIframe funcione correctamente
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has('initial-parent-url')) {
      const baseUrl = window.location.origin + window.location.pathname;
      currentUrl.searchParams.set('initial-parent-url', encodeURIComponent(baseUrl));
      // Actualizar la URL sin recargar la página
      window.history.replaceState({}, '', currentUrl.toString());
      console.log('📱 [MAIN] initial-parent-url agregado a la URL');
    }
    
    // CRÍTICO: Importar y ejecutar setupInsideIframe INMEDIATAMENTE
    // No usar setTimeout aquí - debe ejecutarse lo antes posible
    import('@dynamic-labs/utils').then(({ setupInsideIframe }) => {
      try {
        setupInsideIframe();
        const platform = window.Telegram?.WebApp?.platform;
        const isMobile = platform === 'android' || platform === 'ios' || 
                        navigator.userAgent.match(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i);
        
        console.log('✅ [MAIN] Dynamic iframe setup configurado ANTES de React');
        console.log('📱 [MAIN] Plataforma:', platform);
        console.log('📱 [MAIN] Es móvil (detectado):', isMobile);
        console.log('📱 [MAIN] User Agent:', navigator.userAgent);
        console.log('📱 [MAIN] URL:', window.location.href);
        console.log('📱 [MAIN] initial-parent-url en URL:', currentUrl.searchParams.has('initial-parent-url'));
        
        // Marcar que setupInsideIframe se ejecutó
        (window as any).__dynamicIframeSetup = true;
      } catch (setupError) {
        console.warn('⚠️ [MAIN] Error ejecutando setupInsideIframe:', setupError);
        // No bloquear - continuar de todos modos
      }
    }).catch((error) => {
      console.warn('⚠️ [MAIN] Error cargando setupInsideIframe (no crítico):', error);
      // No bloquear - la app debe cargar de todos modos
    });
  } catch (error) {
    console.warn('⚠️ [MAIN] Error inicializando setupInsideIframe (no crítico):', error);
    // No bloquear - la app debe cargar de todos modos
  }
}

// CRÍTICO: Remover loading INMEDIATAMENTE antes de cargar React
// Esto es esencial para que la app se vea instantáneamente
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ No se pudo encontrar el elemento root');
  throw new Error('Root element not found');
}

// Remover loading spinner INMEDIATAMENTE
const loadingElement = rootElement.querySelector('.initial-loading');
if (loadingElement) {
  (loadingElement as HTMLElement).style.display = 'none';
  loadingElement.remove();
}

// Renderizar React SIN StrictMode para mejor rendimiento
// StrictMode causa doble renderizado que ralentiza la carga
try {
  console.log('✅ [MAIN] Creando root de React');
  const root = ReactDOM.createRoot(rootElement);
  console.log('✅ [MAIN] Root creado, renderizando App...');
  root.render(<App />);
  console.log('✅ [MAIN] App renderizado en root');
} catch (error) {
  console.error('❌ [MAIN] Error renderizando React:', error);
  rootElement.innerHTML = `
    <div style="padding: 2rem; text-align: center; color: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <h2>❌ Error cargando la aplicación</h2>
      <p>Por favor recarga la página</p>
      <pre style="margin-top: 1rem; text-align: left; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; max-width: 600px; overflow: auto;">
        ${error instanceof Error ? error.stack : String(error)}
      </pre>
    </div>
  `;
}

