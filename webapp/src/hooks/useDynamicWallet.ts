// Hook personalizado para usar Dynamic Wallet con Story Testnet
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useMemo } from 'react';

export interface DynamicWalletInfo {
  address: string | null;
  connected: boolean;
  primaryWallet: any;
  network: number | null;
  isLoading: boolean;
}

export function useDynamicWallet(): DynamicWalletInfo {
  // Manejar errores si DynamicContext no está disponible
  // CRÍTICO: No lanzar error, solo retornar valores por defecto
  // Esto permite que el componente se renderice inmediatamente
  let contextData;
  try {
    contextData = useDynamicContext();
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

  // CRÍTICO: Usar useMemo para evitar re-renders innecesarios
  // Solo recalcular cuando cambien los valores relevantes
  const walletInfo = useMemo(() => {
    const primaryWallet = contextData.primaryWallet;
    const user = contextData.user;
    // CRÍTICO: Verificar autenticación usando user y primaryWallet
    // Un usuario está autenticado si tiene un user object Y una wallet conectada
    const isAuthenticated = !!user && !!primaryWallet && !!primaryWallet.address;
    const network = contextData.network;
    
    // Verificar que el usuario esté autenticado Y tenga una wallet conectada
    if (isAuthenticated && primaryWallet && primaryWallet.address) {
      const address = primaryWallet.address || null;
      // Asegurar que network sea number o null
      const networkNumber = typeof network === 'number' ? network : (typeof network === 'string' ? parseInt(network, 10) : null);
      
      console.log('✅ [useDynamicWallet] Usuario autenticado y wallet conectada:', {
        address,
        network: networkNumber,
        hasUser: !!user,
        userId: user?.userId,
      });
      
      return {
        address,
        connected: true, // Usuario autenticado Y wallet conectada
        primaryWallet,
        network: networkNumber,
        isLoading: false,
      };
    }
    
    console.log('⚠️ [useDynamicWallet] Usuario no autenticado o sin wallet:', {
      hasUser: !!user,
      hasPrimaryWallet: !!primaryWallet,
      hasAddress: !!primaryWallet?.address,
    });
    
    return {
      address: null,
      connected: false,
      primaryWallet: null,
      network: null,
      isLoading: false,
    };
  }, [
    contextData.user?.userId, // CRÍTICO: Incluir user en las dependencias
    contextData.primaryWallet?.address,
    contextData.network,
  ]);

  return walletInfo;
}

