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
    // Verificar autenticación usando primaryWallet en lugar de isAuthenticated
    const isAuthenticated = !!primaryWallet && !!primaryWallet.address;
    const network = contextData.network;
    
    if (primaryWallet && isAuthenticated) {
      const address = primaryWallet.address || null;
      // Asegurar que network sea number o null
      const networkNumber = typeof network === 'number' ? network : (typeof network === 'string' ? parseInt(network, 10) : null);
      
      return {
        address,
        connected: !!address && isAuthenticated,
        primaryWallet,
        network: networkNumber,
        isLoading: false,
      };
    }
    
    return {
      address: null,
      connected: false,
      primaryWallet: null,
      network: null,
      isLoading: false,
    };
  }, [
    contextData.primaryWallet?.address,
    contextData.network,
  ]);

  return walletInfo;
}

