import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { DynamicWidgetWrapper } from '../components/DynamicWidgetWrapper';
import { TelegramLoginButton } from '../components/TelegramLoginButton';
import { useDynamicWallet } from '../hooks/useDynamicWallet';
import Navigation from '../components/Navigation';
import { getSavedWallet, type WalletInfo } from '../services/walletService';
import { isInTelegram } from '../utils/telegram';
import './Home.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

function Home() {
  // CRÍTICO: No bloquear el render inicial esperando a Dynamic
  // El homepage debe mostrarse inmediatamente, especialmente en Telegram Mini App
  // Este componente DEBE renderizarse instantáneamente sin esperar nada
  const dynamicWallet = useDynamicWallet();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const inTelegram = isInTelegram();
  
  // CRÍTICO: Asegurar que el loading spinner se haya removido
  useEffect(() => {
    // Remover cualquier loading spinner que pueda quedar
    const loadingElement = document.querySelector('.initial-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
  }, []);

  // NO esperar isLoading - actualizar inmediatamente cuando haya cambios
  // Esto asegura que el homepage se muestre inmediatamente sin bloquearse
  // ESPECIALMENTE IMPORTANTE en Telegram Mini App donde el render inicial es crítico
  useEffect(() => {
    // Actualizar wallet cuando Dynamic Wallet cambie (sin esperar isLoading)
    // Esto asegura que el homepage se muestre inmediatamente
    if (dynamicWallet.connected && dynamicWallet.address) {
      setWallet({
        address: dynamicWallet.address,
        connected: true,
      });
      
      // Cargar balance de forma completamente asíncrona sin bloquear el render
      // Usar requestIdleCallback para no bloquear en móviles
      // En Telegram Mini App, esto es crítico para el rendimiento
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          loadBalance(dynamicWallet.address!);
        }, { timeout: 2000 }); // Timeout más largo para no bloquear
      } else {
        setTimeout(() => {
          loadBalance(dynamicWallet.address!);
        }, 1000); // Delay más largo para no bloquear
      }
    } else {
      setWallet(null);
    }
  }, [dynamicWallet.connected, dynamicWallet.address]);

  const loadBalance = async (address: string) => {
    try {
      const response = await axios.get(`${API_URL}/balance/${address}`);
      if (response.data.success) {
        setWallet((prev) => prev ? { ...prev, balance: response.data.balance } : null);
      }
    } catch (balanceError) {
      console.warn('No se pudo cargar el balance inicial:', balanceError);
    }
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
        <p className="hero-subtitle">Protege tu contenido audiovisual con blockchain</p>
      </div>

      {/* Botón de Conexión Prominente - PRIMERO y MUY Visible */}
      {!wallet || !wallet.connected ? (
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
              {inTelegram ? '🔵 Conecta tu Wallet' : '🔗 Conecta tu Wallet'}
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: 0, fontSize: '0.9rem' }}>
              {inTelegram 
                ? 'Usa tu correo electrónico para crear tu wallet (temporal hasta activar Telegram Auto-Wallets)'
                : 'Regístrate con tu correo electrónico y verifica con el código que recibirás'
              }
            </p>
          </div>
          <div style={{ width: '100%' }}>
            {inTelegram ? (
              <TelegramLoginButton />
            ) : (
              <DynamicWidgetWrapper />
            )}
          </div>
        </div>
      ) : null}

      {/* Wallet Connection Section - Solo mostrar si está conectado */}
      {wallet && wallet.connected && (
      <div className="wallet-section">
        <div className="wallet-connected-card">
          <div className="wallet-status">
            <div className="wallet-icon-connected">✅</div>
            <div className="wallet-info">
              <h3>Wallet Conectado</h3>
              <p className="wallet-address">
                {wallet.address.substring(0, 8)}...{wallet.address.substring(36)}
              </p>
              <p className="wallet-status-text">
                {dynamicWallet.network === 1315 ? '✅ Conectado a Story Testnet' : '⚠️ Cambia a Story Testnet (Chain ID: 1315)'}
              </p>
            </div>
          </div>
          <DynamicWidgetWrapper />
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
