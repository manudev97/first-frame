// Hook personalizado para usar Dynamic Wallet con Story Testnet
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useEffect, useState } from 'react';

export interface DynamicWalletInfo {
  address: string | null;
  connected: boolean;
  primaryWallet: any;
  network: number | null;
  isLoading: boolean;
}

export function useDynamicWallet(): DynamicWalletInfo {
  // CRÍTICO: Inicializar con valores por defecto inmediatamente
  // No bloquear el render inicial esperando a Dynamic
  // ESPECIALMENTE IMPORTANTE en Telegram Mini App
  const [walletInfo, setWalletInfo] = useState<DynamicWalletInfo>({
    address: null,
    connected: false,
    primaryWallet: null,
    network: null,
    isLoading: false, // Siempre false para no bloquear
  });

  // Manejar errores si DynamicContext no está disponible
  // CRÍTICO: No lanzar error, solo retornar valores por defecto
  // Esto permite que el componente se renderice inmediatamente
  let primaryWallet, isAuthenticated, network;
  try {
    const contextData = useDynamicContext();
    primaryWallet = contextData.primaryWallet;
    isAuthenticated = contextData.isAuthenticated;
    network = contextData.network;
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

  useEffect(() => {
    // Actualizar inmediatamente sin delay para mejor rendimiento
    if (primaryWallet && isAuthenticated) {
      const address = primaryWallet.address || null;
      
      setWalletInfo({
        address,
        connected: !!address && isAuthenticated,
        primaryWallet,
        network: network || null,
        isLoading: false,
      });
    } else {
      setWalletInfo({
        address: null,
        connected: false,
        primaryWallet: null,
        network: null,
        isLoading: false,
      });
    }
  }, [primaryWallet, isAuthenticated, network]);

  return walletInfo;
}

