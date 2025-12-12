import { useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { isInTelegram } from '../utils/telegram';
import { useDynamicWallet } from '../hooks/useDynamicWallet';
import './Home.css';

// Lazy load de componentes pesados para no bloquear la carga inicial
const DynamicWidgetWrapper = lazy(() => import('../components/DynamicWidgetWrapper').then(m => ({ default: m.DynamicWidgetWrapper })));
const TelegramLoginButton = lazy(() => import('../components/TelegramLoginButton').then(m => ({ default: m.TelegramLoginButton })));

function Home() {
  // CRÍTICO: Log para verificar que Home se está renderizando
  console.log('✅ [Home] Home component renderizando');
  
  // CRÍTICO: Usar Dynamic Wallet para detectar conexión
  const dynamicWallet = useDynamicWallet();
  const inTelegram = isInTelegram();
  
  // CRÍTICO: Verificar conexión de wallet
  // Una wallet está conectada si tiene una address válida
  // No dependemos solo de isLoggedIn porque puede haber casos donde la wallet
  // está conectada pero el usuario aún no está completamente autenticado
  const walletConnected = dynamicWallet.connected && !!dynamicWallet.address;
  
  // Log para debugging - CRÍTICO: Log más detallado
  useEffect(() => {
    console.log('🏠 [Home] Estado de wallet:', {
      connected: dynamicWallet.connected,
      address: dynamicWallet.address,
      network: dynamicWallet.network,
      walletConnected,
      hasPrimaryWallet: !!dynamicWallet.primaryWallet,
      primaryWalletAddress: dynamicWallet.primaryWallet?.address,
      isLoading: dynamicWallet.isLoading,
      hasUser: !!dynamicWallet.user,
    });
    
    // CRÍTICO: Si primaryWallet existe pero connected es false, loguear por qué
    if (dynamicWallet.primaryWallet && !dynamicWallet.connected) {
      console.warn('⚠️ [Home] primaryWallet existe pero connected=false:', {
        primaryWalletAddress: dynamicWallet.primaryWallet.address,
        primaryWalletId: dynamicWallet.primaryWallet.id,
        hookAddress: dynamicWallet.address,
        hookConnected: dynamicWallet.connected,
      });
    }
  }, [dynamicWallet.connected, dynamicWallet.address, dynamicWallet.primaryWallet, walletConnected]);
  
  // CRÍTICO: Remover loading spinner INMEDIATAMENTE
  useEffect(() => {
    const loadingElement = document.querySelector('.initial-loading');
    if (loadingElement) {
      (loadingElement as HTMLElement).style.display = 'none';
      loadingElement.remove();
    }
  }, []);

  return (
    <div className="home">
      <Navigation title="" showBack={false} />
      
      {/* Hero Section - Logo y Título */}
      <div className="hero">
        <div className="logo-container">
          <img 
            src="/logo.png" 
            alt="FirstFrame Logo" 
            className="logo"
            onError={(e) => {
              // Si el logo falla, ocultarlo silenciosamente sin afectar el render
              const target = e.target as HTMLImageElement;
              if (target.parentElement) {
                target.parentElement.style.display = 'none';
              }
            }}
            onLoad={() => {
              // Logo cargado correctamente
              console.log('✅ Logo cargado correctamente');
            }}
          />
        </div>
        <h1>🎬 FirstFrame</h1>
        <p className="hero-subtitle">Protect your audiovisual content with blockchain</p>
      </div>

      {/* Botón de Conexión Prominente - PRIMERO y MUY Visible */}
      {!walletConnected ? (
        <div style={{
          margin: '1.5rem 0',
          padding: '1rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '1rem',
          }}>
            <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>
              {inTelegram ? '🔵 Connect your Wallet' : '🔗 Connect your Wallet'}
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: 0, fontSize: '0.9rem' }}>
              {inTelegram 
                ? 'Use your email to create your wallet (temporary until Telegram Auto-Wallets is activated)'
                : 'Sign up with your email and verify with the code you will receive'
              }
            </p>
          </div>
          <div style={{ width: '100%' }}>
            <Suspense fallback={<div style={{ padding: '1rem', textAlign: 'center', color: 'white' }}>Loading wallet...</div>}>
              {inTelegram ? (
                <TelegramLoginButton />
              ) : (
                <DynamicWidgetWrapper />
              )}
            </Suspense>
          </div>
        </div>
      ) : null}

      {/* Wallet Connection Section - Solo mostrar si está conectado */}
      {walletConnected && (
      <div className="wallet-section">
        <div className="wallet-connected-card">
          <div className="wallet-status">
            <div className="wallet-icon-connected">✅</div>
            <div className="wallet-info">
              <h3>Wallet Connected</h3>
              <p className="wallet-address">
                {dynamicWallet.address?.substring(0, 8)}...{dynamicWallet.address?.substring(36)}
              </p>
              <p className="wallet-status-text">
                {dynamicWallet.network === 1315 
                  ? '✅ Connected to Story Testnet'
                  : `⚠️ Network: ${dynamicWallet.network || 'Unknown'} (Switch to Story Testnet)`}
              </p>
            </div>
          </div>
          <Suspense fallback={null}>
            <DynamicWidgetWrapper />
          </Suspense>
        </div>
      </div>
      )}

      {/* Acciones - Perfil primero y destacado */}
      <div className="actions">
        {/* Perfil primero - destacado y más grande */}
        <Link 
          to="/profile" 
          className="action-card purple-light profile-card-featured"
          style={{ gridColumn: 'span 2' }}
        >
          <div className="icon">👤</div>
          <h3>My Profile</h3>
          <p>View my registered IPs and royalties</p>
          {walletConnected && (
            <div className="profile-badge">Wallet connected ✓</div>
          )}
        </Link>

        <Link 
          to="/upload" 
          className={`action-card purple ${!walletConnected ? 'disabled' : ''}`}
          onClick={(e) => {
            if (!walletConnected) {
              e.preventDefault();
              alert('⚠️ You must first connect your wallet to register IPs');
            }
          }}
        >
          <div className="icon">📤</div>
          <h3>Upload Video</h3>
          <p>Register your content as IP</p>
        </Link>

        <Link 
          to="/marketplace" 
          className={`action-card green-lila ${!walletConnected ? 'disabled' : ''}`}
          onClick={(e) => {
            if (!walletConnected) {
              e.preventDefault();
              alert('⚠️ You must first connect your wallet to access the marketplace');
            }
          }}
        >
          <div className="icon">🛒</div>
          <h3>Marketplace</h3>
          <p>Explore registered IPs</p>
        </Link>

        <Link 
          to="/claim" 
          className={`action-card purple ${!walletConnected ? 'disabled' : ''}`}
          onClick={(e) => {
            if (!walletConnected) {
              e.preventDefault();
              alert('⚠️ You must first connect your wallet to claim royalties');
            }
          }}
        >
          <div className="icon">💰</div>
          <h3>Claim</h3>
          <p>Get my royalties</p>
        </Link>
      </div>
    </div>
  );
}

export default Home;
