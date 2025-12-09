// Componente que carga Dynamic Wallet de forma lazy para no bloquear la carga inicial
import { Suspense, useState, useEffect, ReactNode } from 'react';
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
  // Detectar si estamos en Telegram Mini App
  const isInTelegram = typeof window !== 'undefined' && window.Telegram?.WebApp !== undefined;

  // Verificar configuración y loggear errores comunes
  useEffect(() => {
    // Verificar que el environment ID esté configurado
    if (!dynamicEnvironmentId || dynamicEnvironmentId === '') {
      console.error('❌ ERROR: VITE_DYNAMIC_ENVIRONMENT_ID no está configurado!');
      console.error('   Agrega VITE_DYNAMIC_ENVIRONMENT_ID a tu archivo .env');
    } else {
      console.log('✅ Dynamic Environment ID configurado:', dynamicEnvironmentId);
    }

    // Verificar CORS
    const checkCorsError = () => {
      window.addEventListener('error', (event) => {
        const message = event.message || '';
        if (message.includes('CORS') || message.includes('Access-Control-Allow-Origin')) {
          console.error('❌ ERROR DE CORS DETECTADO!');
          console.error('   Tu dominio NO está en la lista de CORS permitidos en Dynamic Dashboard.');
          console.error('   Dominio actual:', window.location.origin);
          console.error('   Solución:');
          console.error('   1. Ve a https://app.dynamic.xyz/dashboard/security/cors');
          console.error('   2. Agrega este dominio:', window.location.origin);
          console.error('   3. IMPORTANTE: NO agregues "/" al final');
          console.error('   4. Guarda los cambios y espera 10-30 segundos');
        }
      });
    };
    checkCorsError();
  }, []);

  // IMPORTANTE: Siempre renderizar el provider para que el contexto esté disponible
  // Dynamic se inicializará internamente de forma lazy
  
  // CRÍTICO: Configurar redirectUrl para Telegram Mini Apps
  // Según la documentación de Dynamic, esto es necesario para evitar ciclos infinitos
  // en el sandbox cuando se usa autenticación social (email, etc.)
  // https://www.dynamic.xyz/docs/guides/integrations/telegram/telegram-mini-app
  const getRedirectUrl = () => {
    if (isInTelegram) {
      // En Telegram Mini App, usar la URL actual como redirect
      // Esto permite que Dynamic redirija correctamente después de la autenticación
      return window.location.origin + window.location.pathname;
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
        
        // Habilitar Telegram Auto-Wallets cuando estemos en Telegram
        // Esto permite crear wallets automáticamente sin extensiones
        // TEMPORAL: Habilitado solo cuando tengamos session keys
        enableSocialSignIn: false, // Deshabilitado temporalmente hasta recibir session keys
        
        // SOLUCIÓN TEMPORAL: Habilitar login por email mientras esperamos session keys
        // Los usuarios pueden registrarse con email y verificar con código
        enableEmailSignIn: true, // Habilitado para login temporal
        enableSmsSignIn: false, // Mantener deshabilitado
        
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

