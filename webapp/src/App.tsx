import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { setupInsideIframe } from '@dynamic-labs/utils';
import { isInTelegram } from './utils/telegram';

// CRÍTICO: Lazy load de DynamicProvider para no bloquear la carga inicial
// Dynamic es pesado y puede ralentizar significativamente la carga
const DynamicProvider = lazy(() => import('./components/DynamicProvider').then(m => ({ default: m.DynamicProvider })));

// Lazy load de páginas para mejor rendimiento
const Home = lazy(() => import('./pages/Home'));
const Upload = lazy(() => import('./pages/Upload'));
const Puzzle = lazy(() => import('./pages/Puzzle'));
const Profile = lazy(() => import('./pages/Profile'));
const Claim = lazy(() => import('./pages/Claim'));
const Report = lazy(() => import('./pages/Report'));
const Marketplace = lazy(() => import('./pages/Marketplace'));

// Componente de fallback visible para Suspense
const LoadingFallback = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    textAlign: 'center',
    padding: '2rem',
  }}>
    <div>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
      <p>Cargando FirstFrame...</p>
    </div>
  </div>
);

function App() {
  // CRÍTICO: Log para verificar que App se está renderizando
  console.log('✅ [APP] App component renderizando');
  // CRÍTICO: setupInsideIframe también se llama aquí como backup
  // Ya se llama en main.tsx ANTES de React, pero esto asegura que se ejecute
  useEffect(() => {
    if (isInTelegram()) {
      // Ejecutar de forma asíncrona para no bloquear el render
      setTimeout(() => {
        try {
          // Asegurar que initial-parent-url esté en la URL
          const currentUrl = new URL(window.location.href);
          if (!currentUrl.searchParams.has('initial-parent-url')) {
            const baseUrl = window.location.origin + window.location.pathname;
            currentUrl.searchParams.set('initial-parent-url', encodeURIComponent(baseUrl));
            window.history.replaceState({}, '', currentUrl.toString());
            console.log('📱 [APP] initial-parent-url agregado a la URL (backup)');
          }
          
          // Verificar si ya se ejecutó en main.tsx
          const alreadySetup = (window as any).__dynamicIframeSetup;
          if (!alreadySetup) {
            try {
              setupInsideIframe();
              (window as any).__dynamicIframeSetup = true;
              const platform = window.Telegram?.WebApp?.platform;
              console.log('✅ [APP] Dynamic iframe setup configurado (backup)');
              console.log('📱 [APP] Plataforma:', platform);
              console.log('📱 [APP] Es móvil:', platform === 'android' || platform === 'ios');
            } catch (setupError) {
              console.warn('⚠️ [APP] Error ejecutando setupInsideIframe (no crítico):', setupError);
              // No bloquear - continuar de todos modos
            }
          } else {
            console.log('✅ [APP] Dynamic iframe setup ya estaba configurado');
          }
        } catch (error) {
          console.warn('⚠️ [APP] Error configurando Dynamic iframe setup (no crítico):', error);
          // No bloquear - la app debe cargar de todos modos
        }
      }, 100); // Pequeño delay para no bloquear el render inicial
    }
  }, []);

  // CRÍTICO: Remover loading spinner INMEDIATAMENTE
  useEffect(() => {
    const loadingElement = document.querySelector('.initial-loading');
    if (loadingElement) {
      (loadingElement as HTMLElement).style.display = 'none';
      loadingElement.remove();
    }
  }, []);

  // Inicializar Telegram WebApp de forma MUY asíncrona para no bloquear
  useEffect(() => {
    // Ejecutar MUY después para no bloquear el render inicial
    setTimeout(() => {
      try {
        import('./utils/telegram').then(({ initTelegramWebApp }) => {
          initTelegramWebApp();
        });
      } catch (error) {
        // Silenciar errores - no crítico
      }
    }, 2000); // Delay largo para no bloquear
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <DynamicProvider>
          <Router>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/puzzle" element={<Puzzle />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/claim" element={<Claim />} />
                <Route path="/report" element={<Report />} />
              </Routes>
            </Suspense>
          </Router>
        </DynamicProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;

