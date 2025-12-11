// Hook personalizado para usar Dynamic Wallet con Story Testnet
// Basado en la documentación oficial de Dynamic: https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
// CRÍTICO: Usar los hooks oficiales de Dynamic según la documentación
import { useDynamicContext, useIsLoggedIn, useDynamicEvents } from '@dynamic-labs/sdk-react-core';
import { useMemo, useState, useEffect } from 'react';

export interface DynamicWalletInfo {
  address: string | null;
  connected: boolean;
  primaryWallet: any;
  network: number | null;
  isLoading: boolean;
  user?: any;
}

export function useDynamicWallet(): DynamicWalletInfo {
  // CRÍTICO: Los hooks de React NO pueden estar dentro de try-catch
  // Deben llamarse siempre en el mismo orden
  const contextData = useDynamicContext();
  const isLoggedIn = useIsLoggedIn(); // Hook oficial de Dynamic para verificar autenticación
  
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
  
  // CRÍTICO: Verificar periódicamente si la wallet se conecta
  // Esto es necesario porque primaryWallet.address puede no estar disponible inmediatamente
  // después de que Dynamic restaure la wallet
  useEffect(() => {
    const primaryWallet = contextData.primaryWallet;
    const sdkHasLoaded = contextData.sdkHasLoaded;
    
    // Solo verificar si el SDK ha cargado y hay una primaryWallet
    if (sdkHasLoaded && primaryWallet) {
      const address = primaryWallet.address || 
                     primaryWallet.connector?.address ||
                     primaryWallet.accounts?.[0]?.address;
      
      if (address && address.startsWith('0x') && address.length === 42) {
        // Si encontramos una address válida, forzar actualización
        console.log('🔄 [useDynamicWallet] Wallet detectada en verificación periódica:', address);
        setForceUpdate(prev => prev + 1);
      }
    }
    
    // Verificar cada 2 segundos si el SDK ha cargado y hay una wallet
    const interval = setInterval(() => {
      const currentPrimaryWallet = contextData.primaryWallet;
      const currentSdkHasLoaded = contextData.sdkHasLoaded;
      
      if (currentSdkHasLoaded && currentPrimaryWallet) {
        const currentAddress = currentPrimaryWallet.address || 
                              currentPrimaryWallet.connector?.address ||
                              currentPrimaryWallet.accounts?.[0]?.address;
        
        if (currentAddress && currentAddress.startsWith('0x') && currentAddress.length === 42) {
          console.log('🔄 [useDynamicWallet] Wallet detectada en intervalo:', currentAddress);
          setForceUpdate(prev => prev + 1);
        }
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [contextData.primaryWallet, contextData.sdkHasLoaded]);

  // CRÍTICO: Usar useMemo para evitar re-renders innecesarios
  // Solo recalcular cuando cambien los valores relevantes
  const walletInfo = useMemo(() => {
    const primaryWallet = contextData.primaryWallet;
    const user = contextData.user;
    const network = contextData.network;
    const sdkHasLoaded = contextData.sdkHasLoaded;
    
    // CRÍTICO: Según la documentación oficial de Dynamic:
    // https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
    // "get users primary wallet" ejemplo muestra: const address = primaryWallet.address;
    // La address está disponible directamente en primaryWallet.address
    
    // CRÍTICO: Obtener address de múltiples formas posibles
    // Dynamic puede exponer la address en diferentes lugares según el estado de carga
    let walletAddress: string | null = null;
    
    if (primaryWallet) {
      // Método 1: address directo (más común)
      if (primaryWallet.address) {
        walletAddress = primaryWallet.address;
      }
      // Método 2: desde connector si está disponible
      else if (primaryWallet.connector?.address) {
        walletAddress = primaryWallet.connector.address;
      }
      // Método 3: desde accounts si está disponible
      else if (primaryWallet.accounts && primaryWallet.accounts.length > 0) {
        walletAddress = primaryWallet.accounts[0]?.address || null;
      }
    }
    
    // CRÍTICO: Verificar conexión de forma más simple y directa
    // Si primaryWallet existe Y tiene una address válida, la wallet está conectada
    // No dependemos solo de isLoggedIn porque puede haber casos donde la wallet
    // está conectada pero el usuario aún no está completamente autenticado
    const hasValidAddress = walletAddress && 
                           typeof walletAddress === 'string' &&
                           walletAddress.startsWith('0x') && 
                           walletAddress.length === 42;
    
    // CRÍTICO: Una wallet está conectada si tiene una address válida
    // Esto es más directo y no depende de isLoggedIn que puede ser false
    // incluso cuando la wallet está conectada (especialmente en modo connect-only)
    // También verificamos que el SDK haya cargado para evitar falsos positivos
    const isConnected = !!primaryWallet && hasValidAddress && sdkHasLoaded;
    
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
        primaryWalletId: primaryWallet?.id,
        sdkHasLoaded,
        authMode: contextData.authMode,
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
    // CRÍTICO: Log más detallado para entender por qué no se detecta
    console.log('⚠️ [useDynamicWallet] Wallet no conectada:', {
      isLoggedIn,
      hasUser: !!user,
      hasPrimaryWallet: !!primaryWallet,
      primaryWalletAddress: primaryWallet?.address,
      primaryWalletId: primaryWallet?.id,
      primaryWalletChain: primaryWallet?.chain,
      addressType: typeof primaryWallet?.address,
      addressLength: primaryWallet?.address?.length,
      walletAddress, // Address detectada (puede ser null)
      hasValidAddress,
      network,
      sdkHasLoaded,
      authMode: contextData.authMode,
      // Log completo del primaryWallet para debugging
      primaryWalletKeys: primaryWallet ? Object.keys(primaryWallet).slice(0, 15) : [],
      // Log del connector si existe
      hasConnector: !!primaryWallet?.connector,
      connectorAddress: primaryWallet?.connector?.address,
      // Log de accounts si existe
      hasAccounts: !!(primaryWallet?.accounts?.length),
      firstAccountAddress: primaryWallet?.accounts?.[0]?.address,
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

