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
    const network = contextData.network;
    
    // CRÍTICO: Verificar si hay una wallet conectada
    // Una wallet está conectada si tiene una address válida
    // No requerimos user para considerar la wallet conectada (puede estar cargando)
    const hasWalletAddress = !!primaryWallet && !!primaryWallet.address;
    const hasUser = !!user;
    
    // Si hay wallet address, considerarla conectada (incluso si user aún no está disponible)
    if (hasWalletAddress) {
      const address = primaryWallet.address || null;
      // Asegurar que network sea number o null
      const networkNumber = typeof network === 'number' ? network : (typeof network === 'string' ? parseInt(network, 10) : null);
      
      console.log('✅ [useDynamicWallet] Wallet conectada:', {
        address,
        network: networkNumber,
        hasUser,
        userId: user?.userId,
        email: user?.email,
      });
      
      return {
        address,
        connected: true, // Wallet tiene address = está conectada
        primaryWallet,
        network: networkNumber,
        isLoading: false,
      };
    }
    
    // Log detallado para debugging
    console.log('⚠️ [useDynamicWallet] Wallet no conectada:', {
      hasUser,
      hasPrimaryWallet: !!primaryWallet,
      hasAddress: !!primaryWallet?.address,
      primaryWalletType: primaryWallet ? typeof primaryWallet : 'null',
      addressValue: primaryWallet?.address,
    });
    
    return {
      address: null,
      connected: false,
      primaryWallet: null,
      network: null,
      isLoading: false,
    };
  }, [
    contextData.user?.userId, // Incluir user para detectar cuando se autentica
    contextData.primaryWallet?.address, // CRÍTICO: Incluir address para detectar cuando se conecta
    contextData.network,
  ]);

  return walletInfo;
}

