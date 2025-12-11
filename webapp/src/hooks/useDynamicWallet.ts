// Hook personalizado para usar Dynamic Wallet con Story Testnet
// Basado en la documentación oficial de Dynamic: https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
import { useDynamicContext, useIsLoggedIn, useDynamicEvents } from '@dynamic-labs/sdk-react-core';
import { useMemo, useEffect, useState } from 'react';

export interface DynamicWalletInfo {
  address: string | null;
  connected: boolean;
  primaryWallet: any;
  network: number | null;
  isLoading: boolean;
  user?: any;
}

export function useDynamicWallet(): DynamicWalletInfo {
  // Manejar errores si DynamicContext no está disponible
  // CRÍTICO: No lanzar error, solo retornar valores por defecto
  // Esto permite que el componente se renderice inmediatamente
  let contextData;
  let isLoggedIn = false;
  try {
    contextData = useDynamicContext();
    isLoggedIn = useIsLoggedIn(); // CRÍTICO: Usar hook oficial de Dynamic para verificar autenticación
  } catch (error) {
    // Si Dynamic no está disponible aún, retornar valores por defecto sin error
    // Esto es normal al inicio y permite que el homepage se renderice inmediatamente
    return {
      address: null,
      connected: false,
      primaryWallet: null,
      network: null,
      isLoading: false,
    };
  }

  // Estado para forzar re-render cuando la wallet cambia
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // CRÍTICO: Usar eventos de Dynamic para detectar cambios en la wallet
  // Documentación: https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamicevents
  useDynamicEvents('primaryWalletChanged', (newPrimaryWallet) => {
    console.log('🔄 [useDynamicWallet] primaryWalletChanged event:', {
      address: newPrimaryWallet?.address,
      hasAddress: !!newPrimaryWallet?.address,
    });
    setForceUpdate(prev => prev + 1);
  });

  useDynamicEvents('userWalletsChanged', (params) => {
    console.log('🔄 [useDynamicWallet] userWalletsChanged event:', {
      updateType: params.updateType,
      primaryWalletAddress: params.primaryWallet?.address,
      userWalletsCount: params.userWallets?.length,
    });
    setForceUpdate(prev => prev + 1);
  });

  // CRÍTICO: Usar useMemo para evitar re-renders innecesarios
  // Solo recalcular cuando cambien los valores relevantes
  const walletInfo = useMemo(() => {
    const primaryWallet = contextData.primaryWallet;
    const user = contextData.user;
    const network = contextData.network;
    const sdkHasLoaded = contextData.sdkHasLoaded;
    
    // CRÍTICO: Según la documentación de Dynamic:
    // 1. useIsLoggedIn verifica si user existe O si authMode es 'connect-only' y primaryWallet existe
    // 2. primaryWallet.address es la forma correcta de obtener la address
    // 3. Una wallet está conectada si: isLoggedIn Y primaryWallet existe Y primaryWallet.address existe
    
    const walletAddress = primaryWallet?.address || null;
    
    // CRÍTICO: Verificar conexión usando la lógica oficial de Dynamic
    // Una wallet está conectada si:
    // - El usuario está logueado (según useIsLoggedIn)
    // - Y tiene una primaryWallet
    // - Y la primaryWallet tiene una address válida
    const isConnected = isLoggedIn && 
                       !!primaryWallet && 
                       !!walletAddress &&
                       typeof walletAddress === 'string' &&
                       walletAddress.startsWith('0x') && 
                       walletAddress.length === 42;
    
    if (isConnected) {
      // Asegurar que network sea number o null
      const networkNumber = typeof network === 'number' ? network : (typeof network === 'string' ? parseInt(network, 10) : null);
      
      console.log('✅ [useDynamicWallet] Wallet conectada:', {
        address: walletAddress,
        network: networkNumber,
        isLoggedIn,
        hasUser: !!user,
        userId: user?.userId,
        email: user?.email,
        primaryWalletExists: !!primaryWallet,
        sdkHasLoaded,
      });
      
      return {
        address: walletAddress,
        connected: true,
        primaryWallet,
        network: networkNumber,
        isLoading: !sdkHasLoaded,
        user,
      };
    }
    
    // Log detallado para debugging cuando NO está conectada
    console.log('⚠️ [useDynamicWallet] Wallet no conectada:', {
      isLoggedIn,
      hasUser: !!user,
      hasPrimaryWallet: !!primaryWallet,
      primaryWalletAddress: primaryWallet?.address,
      addressType: typeof primaryWallet?.address,
      addressLength: primaryWallet?.address?.length,
      network,
      sdkHasLoaded,
      authMode: contextData.authMode,
    });
    
    return {
      address: null,
      connected: false,
      primaryWallet: null,
      network: null,
      isLoading: !sdkHasLoaded,
      user: undefined,
    };
  }, [
    isLoggedIn, // CRÍTICO: Incluir isLoggedIn del hook oficial
    contextData.user?.userId,
    contextData.primaryWallet, // CRÍTICO: Incluir todo el objeto primaryWallet para detectar cambios
    contextData.primaryWallet?.address, // También incluir address específicamente
    contextData.network,
    contextData.sdkHasLoaded, // Incluir para saber si el SDK terminó de cargar
    forceUpdate, // Incluir forceUpdate para forzar recálculo cuando hay eventos
  ]);

  return walletInfo;
}

