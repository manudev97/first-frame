// Hook personalizado para usar Dynamic Wallet con Story Testnet
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useMemo, useEffect, useState } from 'react';

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

  // Estado para forzar re-render cuando la wallet se conecte
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // CRÍTICO: Usar useEffect para detectar cuando la wallet se conecta
  // Esto asegura que detectemos la wallet incluso si se conecta después del render inicial
  useEffect(() => {
    const primaryWallet = contextData.primaryWallet;
    if (primaryWallet?.address) {
      const address = primaryWallet.address;
      if (address && address.startsWith('0x') && address.length === 42) {
        console.log('🔄 [useDynamicWallet] Wallet detectada, actualizando estado:', address);
        setForceUpdate(prev => prev + 1);
      }
    }
  }, [contextData.primaryWallet?.address]);
  
  // CRÍTICO: Usar useMemo para evitar re-renders innecesarios
  // Solo recalcular cuando cambien los valores relevantes
  const walletInfo = useMemo(() => {
    const primaryWallet = contextData.primaryWallet;
    const user = contextData.user;
    const network = contextData.network;
    
    // CRÍTICO: Obtener address directamente de primaryWallet.address
    // Según la documentación de Dynamic, primaryWallet tiene la propiedad address directamente
    const walletAddress = primaryWallet?.address || null;
    
    // CRÍTICO: Una wallet está conectada si tiene una address válida
    // Validar que sea una dirección Ethereum válida (0x + 40 caracteres hex)
    const isConnected = !!walletAddress && 
                       typeof walletAddress === 'string' &&
                       walletAddress.startsWith('0x') && 
                       walletAddress.length === 42;
    
    if (isConnected) {
      // Asegurar que network sea number o null
      const networkNumber = typeof network === 'number' ? network : (typeof network === 'string' ? parseInt(network, 10) : null);
      
      console.log('✅ [useDynamicWallet] Wallet conectada:', {
        address: walletAddress,
        network: networkNumber,
        hasUser: !!user,
        userId: user?.userId,
        email: user?.email,
        primaryWalletExists: !!primaryWallet,
        primaryWalletType: primaryWallet ? typeof primaryWallet : 'null',
      });
      
      return {
        address: walletAddress,
        connected: true,
        primaryWallet,
        network: networkNumber,
        isLoading: false,
      };
    }
    
    // Log detallado para debugging cuando NO está conectada
    console.log('⚠️ [useDynamicWallet] Wallet no conectada:', {
      hasUser: !!user,
      hasPrimaryWallet: !!primaryWallet,
      primaryWalletKeys: primaryWallet ? Object.keys(primaryWallet).slice(0, 10) : [],
      addressFromPrimaryWallet: primaryWallet?.address,
      addressType: typeof primaryWallet?.address,
      addressLength: primaryWallet?.address?.length,
      network,
    });
    
    return {
      address: null,
      connected: false,
      primaryWallet: null,
      network: null,
      isLoading: false,
    };
  }, [
    contextData.user?.userId,
    contextData.primaryWallet, // CRÍTICO: Incluir todo el objeto primaryWallet para detectar cambios
    contextData.primaryWallet?.address, // También incluir address específicamente
    contextData.network,
    forceUpdate, // Incluir forceUpdate para forzar recálculo
  ]);

  return walletInfo;
}

