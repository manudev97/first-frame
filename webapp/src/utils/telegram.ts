export function initTelegramWebApp() {
  // Telegram WebApp está disponible globalmente cuando se ejecuta en Telegram
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    
    // Inicializar Telegram WebApp
    tg.ready();
    tg.expand();
    
    // Configurar colores del tema
    tg.setHeaderColor('#1A1A2E');
    tg.setBackgroundColor('#0F0F23');
    
    // Optimizaciones para móviles
    // Deshabilitar el botón de cerrar en móviles (mejor UX)
    if (tg.platform === 'android' || tg.platform === 'ios') {
      // Configuraciones específicas para móviles
      tg.enableClosingConfirmation = false;
    }
    
    // Log para debug
    console.log('📱 Telegram WebApp inicializado');
    console.log('📱 Plataforma:', tg.platform);
    console.log('📱 initData:', tg.initData ? '✅ Disponible' : '❌ Vacío');
    
    return tg;
  }
  return null;
}

export function getTelegramUser() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user;
  }
  return null;
}

export function getTelegramInitData(): string | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const initData = window.Telegram.WebApp.initData;
    if (initData && initData.length > 0) {
      console.log('📱 Telegram initData obtenido:', initData.substring(0, 100) + '...');
      console.log('📱 initData completo disponible:', initData.length, 'caracteres');
      return initData;
    } else {
      console.warn('⚠️ Telegram WebApp existe pero initData está vacío');
      // Intentar obtener desde initDataUnsafe como fallback
      const user = window.Telegram.WebApp.initDataUnsafe?.user;
      if (user) {
        console.log('📱 Usuario de Telegram detectado:', user);
        console.log('⚠️ Pero initData está vacío - esto puede causar problemas con Dynamic');
      }
    }
    return null;
  }
  console.warn('⚠️ Telegram WebApp no está disponible');
  return null;
}

export function isInTelegram(): boolean {
  return typeof window !== 'undefined' && window.Telegram?.WebApp !== undefined;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openLink: (url: string) => void;
  enableClosingConfirmation?: boolean;
  platform?: string;
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

