import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { DynamicProvider } from './components/DynamicProvider';
import { initTelegramWebApp } from './utils/telegram';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Puzzle from './pages/Puzzle';
import Profile from './pages/Profile';
import Claim from './pages/Claim';
import Report from './pages/Report';
import Marketplace from './pages/Marketplace';

function App() {
  // CRÍTICO: Remover loading spinner inmediatamente cuando App se monte
  // Esto es esencial para evitar el bucle de carga en Telegram Mini App
  useEffect(() => {
    // Remover cualquier loading spinner que pueda quedar
    const loadingElement = document.querySelector('.initial-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
  }, []);

  // Inicializar Telegram WebApp de forma asíncrona para no bloquear el render
  useEffect(() => {
    // Usar requestIdleCallback o setTimeout para no bloquear el render inicial
    const initTelegram = () => {
      try {
        initTelegramWebApp();
        
        // Log detallado para debug en Telegram (después del render inicial)
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          console.log('📱 Telegram WebApp inicializado');
          console.log('📱 Plataforma:', tg.platform);
          console.log('📱 initData disponible:', !!tg.initData);
          console.log('📱 initData length:', tg.initData?.length || 0);
          console.log('📱 Usuario:', tg.initDataUnsafe?.user);
          console.log('📱 Query ID:', tg.initDataUnsafe?.query_id);
          
          // Verificar token en URL
          const urlParams = new URLSearchParams(window.location.search);
          const tokenFromUrl = urlParams.get('telegramAuthToken');
          if (tokenFromUrl) {
            console.log('✅ Token de Telegram encontrado en URL');
            console.log('📱 Token length:', tokenFromUrl.length);
          } else {
            console.log('ℹ️ No se encontró token en URL');
          }
          
          // Verificar si initData está vacío (problema común)
          if (!tg.initData || tg.initData.length === 0) {
            console.warn('⚠️ ADVERTENCIA: initData está vacío');
            console.warn('⚠️ Dynamic puede usar el token de la URL como alternativa');
          }
        }
      } catch (error) {
        console.error('Error inicializando Telegram WebApp:', error);
      }
    };

    // Inicializar inmediatamente pero no bloquear el render
    // En Telegram Mini App, esto puede bloquear si se hace síncronamente
    if (window.requestIdleCallback) {
      window.requestIdleCallback(initTelegram, { timeout: 100 });
    } else {
      // Fallback: setTimeout con delay mínimo
      setTimeout(initTelegram, 0);
    }
  }, []);

  return (
    <ErrorBoundary>
      <DynamicProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/puzzle" element={<Puzzle />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/claim" element={<Claim />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </Router>
      </DynamicProvider>
    </ErrorBoundary>
  );
}

export default App;

