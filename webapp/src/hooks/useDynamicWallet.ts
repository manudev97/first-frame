// Hook personalizado para usar Dynamic Wallet con Story Testnet
// Basado en la documentación oficial de Dynamic: https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
// CRÍTICO: Usar los hooks oficiales de Dynamic según la documentación
// IMPORTANTE: Cuando un usuario se autentica con OTP/email, la embedded wallet puede no estar creada inmediatamente
// Por eso usamos useUserWallets y useEmbeddedWallet para detectar correctamente la wallet
import { 
  useDynamicContext, 
  useIsLoggedIn, 
  useDynamicEvents,
  useUserWallets,
  useEmbeddedWallet
} from '@dynamic-labs/sdk-react-core';
import { useMemo, useState } from 'react';

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
  const { primaryWallet, user, sdkHasLoaded, network } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn(); // Hook oficial de Dynamic para verificar autenticación
  const userWallets = useUserWallets(); // CRÍTICO: Obtener todas las wallets del usuario (incluyendo embedded wallets)
  const { userHasEmbeddedWallet } = useEmbeddedWallet(); // CRÍTICO: Verificar si el usuario tiene embedded wallet
  
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

  // CRÍTICO: Escuchar cuando se crea una embedded wallet
  // Esto es importante porque cuando un usuario se autentica con OTP/email,
  // la embedded wallet puede crearse después de la autenticación
  useDynamicEvents('embeddedWalletCreated', (wallet, verifiedCredential, user) => {
    console.log('🔄 [useDynamicWallet] embeddedWalletCreated event:', {
      walletAddress: wallet?.address,
      hasAddress: !!wallet?.address,
      userId: user?.userId,
    });
    setForceUpdate(prev => prev + 1);
  });

  // CRÍTICO: Usar useMemo para evitar re-renders innecesarios
  // Solo recalcular cuando cambien los valores relevantes
  // SEGÚN LA DOCUMENTACIÓN: https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
  // "get users primary wallet" ejemplo muestra: const address = primaryWallet.address;
  const walletInfo = useMemo(() => {
    // CRÍTICO: Buscar embedded wallet en userWallets primero
    // Esto es importante porque cuando un usuario se autentica con OTP/email,
    // la embedded wallet puede estar en userWallets pero no en primaryWallet aún
    const embeddedWallet = userWallets?.find((wallet: any) => 
      wallet.connector?.isEmbeddedWallet || 
      wallet.connector?.walletConnectorName === 'embeddedWallet'
    );
    
    // CRÍTICO: La address puede venir de embedded wallet o primaryWallet
    // Según la documentación: https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
    // primaryWallet.address es la forma correcta de obtener la address
    const address = embeddedWallet?.address || primaryWallet?.address || null;
    
    // CRÍTICO: Conectado si tiene user Y tiene address
    // Según useIsLoggedIn: verifica si user existe o si authMode es 'connect-only' y primaryWallet existe
    // Pero también necesitamos verificar que tenga address válida
    const hasValidAddress = address && 
                           typeof address === 'string' &&
                           address.startsWith('0x') && 
                           address.length === 42;
    
    // CRÍTICO: Una wallet está conectada si:
    // 1. El usuario está autenticado (isLoggedIn) Y
    // 2. Tiene una address válida (ya sea de primaryWallet o embedded wallet en userWallets) Y
    // 3. El SDK ha cargado completamente
    const isConnected = isLoggedIn && hasValidAddress && sdkHasLoaded;
    
    // Usar la wallet detectada (embedded wallet tiene prioridad si existe)
    const detectedWallet = embeddedWallet || primaryWallet;
    
    if (isConnected) {
      // Asegurar que network sea number o null
      const networkNumber = typeof network === 'number' ? network : (typeof network === 'string' ? parseInt(network, 10) : null);
      
      console.log('✅ [useDynamicWallet] Wallet conectada:', {
        address,
        network: networkNumber,
        isLoggedIn,
        hasUser: !!user,
        userId: user?.userId,
        email: user?.email,
        hasPrimaryWallet: !!primaryWallet,
        hasEmbeddedWallet: userHasEmbeddedWallet(),
        primaryWalletAddress: primaryWallet?.address,
        embeddedWalletAddress: embeddedWallet?.address,
        userWalletsCount: userWallets?.length || 0,
        sdkHasLoaded,
      });
      
      return {
        address,
        connected: true,
        primaryWallet: detectedWallet,
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
      userId: user?.userId,
      email: user?.email,
      hasPrimaryWallet: !!primaryWallet,
      primaryWalletAddress: primaryWallet?.address,
      hasEmbeddedWallet: userHasEmbeddedWallet(),
      userWalletsCount: userWallets?.length || 0,
      embeddedWalletAddress: embeddedWallet?.address,
      address, // Address detectada (puede ser null)
      hasValidAddress,
      network,
      sdkHasLoaded,
      // Log de userWallets para debugging
      userWalletsAddresses: userWallets?.map((w: any) => w.address).filter(Boolean) || [],
      embeddedWalletsInUserWallets: userWallets?.filter((w: any) =>
        w.connector?.isEmbeddedWallet ||
        w.connector?.walletConnectorName === 'embeddedWallet'
      ).map((w: any) => w.address) || [],
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
    user?.userId,
    primaryWallet, // CRÍTICO: Incluir todo el objeto primaryWallet para detectar cambios
    primaryWallet?.address, // También incluir address específicamente
    network,
    sdkHasLoaded, // Incluir para saber si el SDK terminó de cargar
    userWallets, // CRÍTICO: Incluir userWallets para detectar embedded wallets
    forceUpdate, // Incluir forceUpdate para forzar recálculo cuando hay eventos
  ]);

  return walletInfo;
}

