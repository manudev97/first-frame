import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { connectWallet, disconnectWallet, getSavedWallet, type WalletInfo } from '../services/walletService';
import './Home.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

function Home() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Cargar wallet guardado al iniciar
    const savedWallet = getSavedWallet();
    if (savedWallet) {
      setWallet(savedWallet);
    }
  }, []);

  const handleConnectWallet = async () => {
    setLoading(true);
    try {
      const walletInfo = await connectWallet();
      setWallet(walletInfo);
      
      // Cargar balance inmediatamente después de conectar
      if (walletInfo.address) {
        try {
          const response = await axios.get(`${API_URL}/balance/${walletInfo.address}`);
          if (response.data.success) {
            setWallet((prev) => prev ? { ...prev, balance: response.data.balance } : null);
          }
        } catch (balanceError) {
          console.warn('No se pudo cargar el balance inicial:', balanceError);
          // No es crítico, el balance se puede cargar después
        }
      }
    } catch (error: any) {
      console.error('Error conectando wallet:', error);
      alert('Error: ' + (error.message || 'No se pudo conectar el wallet'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWallet = () => {
    disconnectWallet();
    setWallet(null);
  };

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
              const target = e.target as HTMLImageElement;
              if (target.parentElement) {
                target.parentElement.style.display = 'none';
              }
            }}
          />
        </div>
        <h1>🎬 FirstFrame</h1>
        <p className="hero-subtitle">Protege tu contenido audiovisual con blockchain</p>
      </div>

      {/* Wallet Connection Section - PRIMERO y MUY Prominente */}
      <div className="wallet-section">
        {wallet && wallet.connected ? (
          <div className="wallet-connected-card">
            <div className="wallet-status">
              <div className="wallet-icon-connected">✅</div>
              <div className="wallet-info">
                <h3>Wallet Conectado</h3>
                <p className="wallet-address">
                  {wallet.address.substring(0, 8)}...{wallet.address.substring(36)}
                </p>
                <p className="wallet-status-text">
                  {wallet.hallidayVerified ? '✅ Verificado con Halliday' : 'Listo para usar FirstFrame'}
                </p>
              </div>
            </div>
            <button 
              className="btn-disconnect"
              onClick={handleDisconnectWallet}
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="wallet-connect-card">
            <div className="wallet-connect-header">
              <div className="wallet-icon-large">🔗</div>
              <h2>¡Conecta tu Wallet!</h2>
              <p className="wallet-subtitle">Primero necesitas conectar tu wallet para usar FirstFrame</p>
            </div>
            <button 
              className="btn-connect-wallet-primary"
              onClick={handleConnectWallet}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner-small">⏳</span> Conectando...
                </>
              ) : (
                <>
                  <span className="wallet-icon-btn">💼</span> Conectar Wallet con Halliday
                </>
              )}
            </button>
            <div className="wallet-features">
              <div className="wallet-feature">
                <span className="feature-icon">⚡</span>
                <span>Wallet automático vinculado a Telegram</span>
              </div>
              <div className="wallet-feature">
                <span className="feature-icon">🔒</span>
                <span>Seguro y sin fricción</span>
              </div>
              <div className="wallet-feature">
                <span className="feature-icon">💳</span>
                <span>Pagos con Halliday integrado</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Acciones - Perfil primero y destacado */}
      <div className="actions">
        {/* Perfil primero - destacado y más grande */}
        <Link 
          to="/profile" 
          className="action-card purple-light profile-card-featured"
          style={{ gridColumn: 'span 2' }}
        >
          <div className="icon">👤</div>
          <h3>Mi Perfil</h3>
          <p>Ver mis IPs registrados y regalías</p>
          {wallet && wallet.connected && (
            <div className="profile-badge">Wallet conectado ✓</div>
          )}
        </Link>

        <Link 
          to="/upload" 
          className={`action-card purple ${!wallet || !wallet.connected ? 'disabled' : ''}`}
          onClick={(e) => {
            if (!wallet || !wallet.connected) {
              e.preventDefault();
              alert('⚠️ Primero debes conectar tu wallet para registrar IPs');
            }
          }}
        >
          <div className="icon">📤</div>
          <h3>Subir Video</h3>
          <p>Registra tu contenido como IP</p>
        </Link>

        <Link 
          to="/marketplace" 
          className={`action-card green-lila ${!wallet || !wallet.connected ? 'disabled' : ''}`}
          onClick={(e) => {
            if (!wallet || !wallet.connected) {
              e.preventDefault();
              alert('⚠️ Primero debes conectar tu wallet para acceder al marketplace');
            }
          }}
        >
          <div className="icon">🛒</div>
          <h3>Marketplace</h3>
          <p>Explorar IPs registrados</p>
        </Link>

        <Link 
          to="/claim" 
          className={`action-card purple ${!wallet || !wallet.connected ? 'disabled' : ''}`}
          onClick={(e) => {
            if (!wallet || !wallet.connected) {
              e.preventDefault();
              alert('⚠️ Primero debes conectar tu wallet para reclamar regalías');
            }
          }}
        >
          <div className="icon">💰</div>
          <h3>Reclamar</h3>
          <p>Obtener mis regalías</p>
        </Link>
      </div>
    </div>
  );
}

export default Home;
