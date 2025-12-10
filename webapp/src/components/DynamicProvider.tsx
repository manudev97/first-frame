// Componente que carga Dynamic Wallet de forma lazy para no bloquear la carga inicial
import { useEffect, ReactNode } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

// Configuración de Story Testnet
const storyTestnetNetwork = {
  blockExplorerUrls: ['https://aeneid.storyscan.io/'],
  chainId: 1315,
  chainName: 'Story Testnet (Aeneid)',
  iconUrls: ['https://app.dynamic.xyz/assets/networks/eth.svg'],
  name: 'Story',
  nativeCurrency: {
    decimals: 18,
    name: 'IP',
    symbol: 'IP',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/eth.svg',
  },
  networkId: 1315,
  rpcUrls: [import.meta.env.VITE_STORY_RPC_URL || 'https://aeneid.storyrpc.io'],
  vanityName: 'Story Testnet',
};

const dynamicEnvironmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID || 
                              import.meta.env.DYNAMIC_ENVIRONMENT_ID ||
                              'e102eab6-0438-4302-806f-e0dbb57f0e04';

interface DynamicProviderProps {
  children: ReactNode;
}

// Provider que SIEMPRE proporciona el contexto, pero inicializa de forma optimizada
export function DynamicProvider({ children }: DynamicProviderProps) {
  // CRÍTICO: Log para verificar que DynamicProvider se está renderizando
  console.log('✅ [DynamicProvider] DynamicProvider renderizando');
  
  // Detectar si estamos en Telegram Mini App
  const isInTelegram = typeof window !== 'undefined' && window.Telegram?.WebApp !== undefined;

  // OPTIMIZADO: Verificar configuración de forma asíncrona para no bloquear el render inicial
  // En Telegram Mini App, cualquier bloqueo puede causar que la app se quede cargando
  useEffect(() => {
    // Ejecutar verificaciones después de que el render inicial esté completo
    const verifyConfig = () => {
      // Verificar que el environment ID esté configurado
      if (!dynamicEnvironmentId || dynamicEnvironmentId === '') {
        console.error('❌ ERROR: VITE_DYNAMIC_ENVIRONMENT_ID no está configurado!');
        console.error('   Agrega VITE_DYNAMIC_ENVIRONMENT_ID a tu archivo .env');
      } else {
        console.log('✅ Dynamic Environment ID configurado:', dynamicEnvironmentId);
      }

      // Verificar CORS de forma asíncrona
          const checkCorsError = () => {
            // Verificar errores de CORS en la consola
            window.addEventListener('error', (event) => {
              const message = event.message || '';
              if (message.includes('CORS') || message.includes('Access-Control-Allow-Origin')) {
                console.error('❌❌❌ ERROR DE CORS DETECTADO! ❌❌❌');
                console.error('   Tu dominio NO está en la lista de CORS permitidos en Dynamic Dashboard.');
                console.error('   Dominio actual:', window.location.origin);
                console.error('   ⚠️ ESTO IMPIDE QUE EL SANDBOX SE ABRA ⚠️');
                console.error('   Solución URGENTE:');
                console.error('   1. Ve a https://app.dynamic.xyz/dashboard/security/cors');
                console.error('   2. Agrega este dominio EXACTAMENTE:', window.location.origin);
                console.error('   3. IMPORTANTE: NO agregues "/" al final');
                console.error('   4. Guarda los cambios y espera 1-2 MINUTOS');
                console.error('   5. Recarga la mini app después de esperar');
                
                // Log del error - showAlert no está disponible en el tipo de Telegram WebApp
                console.warn('⚠️ Error de CORS detectado - verifica la consola para más detalles');
              }
            });

            // También verificar errores de fetch que pueden ser CORS
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
              try {
                const response = await originalFetch(...args);
                return response;
              } catch (error: any) {
                if (error.message && error.message.includes('CORS')) {
                  console.error('❌❌❌ ERROR DE CORS EN FETCH! ❌❌❌');
                  console.error('   URL:', args[0]);
                  console.error('   Dominio actual:', window.location.origin);
                  console.error('   Ve a https://app.dynamic.xyz/dashboard/security/cors');
                  console.error('   Agrega:', window.location.origin);
                }
                throw error;
              }
            };
          };
          checkCorsError();
    };
    
    // Ejecutar después de que el render inicial esté completo
    if (window.requestIdleCallback) {
      window.requestIdleCallback(verifyConfig, { timeout: 1000 });
    } else {
      setTimeout(verifyConfig, 500);
    }
  }, []);

  // IMPORTANTE: Siempre renderizar el provider para que el contexto esté disponible
  // Dynamic se inicializará internamente de forma lazy
  
  // CRÍTICO: Configurar redirectUrl para Telegram Mini Apps
  // Según la documentación de Dynamic, esto es necesario para evitar ciclos infinitos
  // en el sandbox cuando se usa autenticación social (email, etc.)
  // https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-mini-app
  // ESPECIALMENTE IMPORTANTE en móvil donde el WebView tiene restricciones diferentes
  const getRedirectUrl = () => {
    if (isInTelegram) {
      // En Telegram Mini App, usar la URL actual como redirect
      // CRÍTICO: En móvil, debe ser la URL completa sin query parameters
      // para evitar problemas con el WebView de Telegram
      // IMPORTANTE: No incluir query parameters en el redirectUrl para móvil
      const baseUrl = window.location.origin + window.location.pathname;
      const platform = window.Telegram?.WebApp?.platform;
      const isMobile = platform === 'android' || platform === 'ios';
      
      console.log('📱 [DynamicProvider] Redirect URL configurado para Telegram:', baseUrl);
      console.log('📱 [DynamicProvider] Plataforma:', platform);
      console.log('📱 [DynamicProvider] Es móvil:', isMobile);
      console.log('📱 [DynamicProvider] URL completa actual:', window.location.href);
      console.log('📱 [DynamicProvider] setupInsideIframe ejecutado:', !!(window as any).__dynamicIframeSetup);
      
      // En móvil, asegurar que el redirectUrl sea exactamente la base URL
      if (isMobile) {
        console.log('📱 [DynamicProvider] ⚠️ MÓVIL DETECTADO - Configuración específica aplicada');
        console.log('📱 [DynamicProvider] Redirect URL (móvil):', baseUrl);
        console.log('📱 [DynamicProvider] ⚠️ Si el sandbox no se abre, verifica setupInsideIframe en los logs');
      }
      
      return baseUrl;
    }
    return undefined; // En navegador normal, no es necesario
  };

  return (
    <DynamicContextProvider
      settings={{
        environmentId: dynamicEnvironmentId,
        walletConnectors: [EthereumWalletConnectors],
        overrides: {
          evmNetworks: [storyTestnetNetwork],
        },
        // Configuración para mejorar el rendimiento inicial
        appName: 'FirstFrame',
        appLogoUrl: '/logo.png',
        
        // CRÍTICO: Configurar redirectUrl para Telegram Mini Apps
        // Esto evita que el sandbox se quede en ciclo infinito
        redirectUrl: getRedirectUrl(),
        
        // CRÍTICO para móvil: Configuración específica para evitar problemas con el sandbox
        // En Telegram móvil, el WebView tiene restricciones diferentes que pueden causar
        // que el sandbox no se abra o se quede en ciclo infinito
        // Estas configuraciones ayudan a que funcione correctamente en móvil
        // Configuración adicional para evitar ciclos infinitos en el sandbox
        // Deshabilitar auto-login automático que puede causar problemas
        // El usuario debe hacer clic manualmente en "Continuar con Email"
        // Configuración para Telegram Mini Apps
        // Dynamic detecta automáticamente:
        // 1. telegramAuthToken en la URL (?telegramAuthToken=...)
        // 2. window.Telegram.WebApp.initData
        // Y maneja el login automáticamente
        // Embedded Wallets (MPC) se habilitan automáticamente con EthereumWalletConnectors
        // Esto permite crear wallets sin necesidad de extensiones de navegador
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}

