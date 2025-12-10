// Componente para login automático con Telegram usando Dynamic Auto-Wallets
// Basado en: https://github.com/dynamic-labs/telegram-miniapp-dynamic
// Documentación: https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-auto-wallets
// IMPORTANTE: El sandbox de email NO requiere MetaMask - funciona independientemente
import { useEffect, useRef, useState } from 'react';
import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isInTelegram } from '../utils/telegram';

export function TelegramLoginButton() {
  const inTelegram = isInTelegram();
  const hasInitialized = useRef(false);
  const [contextReady, setContextReady] = useState(false);

  // Si no estamos en Telegram, no mostrar nada
  if (!inTelegram) {
    return null;
  }

  // Intentar obtener el contexto de Dynamic
  let dynamicContext: any;
  try {
    dynamicContext = useDynamicContext();
    if (!contextReady && dynamicContext) {
      setContextReady(true);
    }
  } catch (error) {
    // El contexto aún no está disponible
  }

  // CRÍTICO: Inicializar WebView UNA SOLA VEZ para evitar re-renders infinitos
  // Usar useRef para asegurar que solo se ejecute una vez
  useEffect(() => {
    if (hasInitialized.current) return;
    
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      const platform = tg.platform;
      // CRÍTICO: Detectar móvil de múltiples formas porque platform puede ser "unknown"
      const isMobile = platform === 'android' || platform === 'ios' || 
                      navigator.userAgent.match(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i);
      
      console.log('📱 [TelegramLoginButton] Inicializado en plataforma:', platform);
      console.log('📱 [TelegramLoginButton] Es móvil (detectado):', isMobile);
      console.log('📱 [TelegramLoginButton] User Agent:', navigator.userAgent);
      console.log('📱 [TelegramLoginButton] URL actual:', window.location.href);
      console.log('📱 [TelegramLoginButton] setupInsideIframe ejecutado:', !!(window as any).__dynamicIframeSetup);
      console.log('📱 [TelegramLoginButton] Contexto Dynamic disponible:', !!dynamicContext);
      
      // CRÍTICO para móvil: Expandir WebView y configurar para que el sandbox funcione
      // Esto es esencial para que Dynamic pueda abrir el modal del sandbox
      if (isMobile) {
        try {
          // CRÍTICO: Expandir WebView completamente ANTES de que Dynamic intente abrir el modal
          tg.expand();
          
          // Asegurar que el WebView esté listo para mostrar modales
          tg.ready();
          
          // CRÍTICO: Habilitar visualización completa para modales
          tg.enableClosingConfirmation = false;
          
          // CRÍTICO: Verificar que setupInsideIframe se ejecutó
          if (!(window as any).__dynamicIframeSetup) {
            console.warn('⚠️ [TelegramLoginButton] ⚠️ setupInsideIframe NO se ejecutó! El sandbox puede no funcionar');
            // Intentar ejecutarlo aquí como último recurso
            import('@dynamic-labs/utils').then(({ setupInsideIframe }) => {
              try {
                setupInsideIframe();
                (window as any).__dynamicIframeSetup = true;
                console.log('✅ [TelegramLoginButton] setupInsideIframe ejecutado como backup');
              } catch (error) {
                console.error('❌ [TelegramLoginButton] Error ejecutando setupInsideIframe:', error);
              }
            });
          }
          
          console.log('✅ [TelegramLoginButton] WebView expandido y configurado para móvil');
        } catch (error) {
          console.warn('⚠️ [TelegramLoginButton] Error configurando WebView para móvil:', error);
        }
      } else {
        // También verificar setupInsideIframe en desktop
        if (!(window as any).__dynamicIframeSetup) {
          console.warn('⚠️ [TelegramLoginButton] ⚠️ setupInsideIframe NO se ejecutó en desktop!');
        }
      }
      
      hasInitialized.current = true;
    }
  }, [dynamicContext]); // Incluir dynamicContext para re-ejecutar cuando esté disponible

  // CRÍTICO: Asegurar que DynamicWidget sea clickeable en móvil
  // El problema puede ser que el botón no responda al touch
  useEffect(() => {
    if (!contextReady || !dynamicContext) return;

    // Esperar a que DynamicWidget se renderice
    const checkAndFixButton = () => {
      const dynamicWidget = document.querySelector('[data-dynamic-widget]');
      if (dynamicWidget) {
        // Buscar todos los botones dentro de DynamicWidget
        const buttons = dynamicWidget.querySelectorAll('button');
        buttons.forEach((button) => {
          // Asegurar que el botón sea clickeable en móvil
          (button as HTMLElement).style.pointerEvents = 'auto';
          (button as HTMLElement).style.touchAction = 'manipulation';
          (button as HTMLElement).style.cursor = 'pointer';
          
          // Agregar event listeners de touch para móvil
          button.addEventListener('touchstart', () => {
            console.log('📱 [TelegramLoginButton] Touch detectado en botón de Dynamic');
            // Asegurar que el WebView esté expandido
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
              const tg = window.Telegram.WebApp;
              tg.expand();
              tg.ready();
            }
          }, { passive: true });
        });
        
        console.log('✅ [TelegramLoginButton] Botones de DynamicWidget configurados para móvil');
      }
    };

    // Intentar varias veces porque DynamicWidget puede tardar en renderizarse
    const interval = setInterval(() => {
      checkAndFixButton();
    }, 500);

    // Limpiar después de 5 segundos
    setTimeout(() => {
      clearInterval(interval);
      checkAndFixButton(); // Última verificación
    }, 5000);

    return () => clearInterval(interval);
  }, [contextReady, dynamicContext]);
  
  // CRÍTICO: Renderizar DynamicWidget normalmente
  // Asegurarse de que sea clickeable en móvil usando CSS y eventos
  return (
    <div 
      style={{ 
        width: '100%',
        // Asegurar que el contenedor no bloquee los clics
        pointerEvents: 'auto',
        touchAction: 'manipulation',
      }}
      onTouchStart={() => {
        // Log para debugging
        console.log('📱 [TelegramLoginButton] Touch detectado en contenedor');
      }}
    >
      <DynamicWidget />
    </div>
  );
}
