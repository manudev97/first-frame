import { useState, useEffect } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { getTelegramUser } from '../utils/telegram';
import './Profile.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface WalletInfo {
  address?: string;
  connected: boolean;
  balance?: string;
}

function Profile() {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [wallet, setWallet] = useState<WalletInfo>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    ipsRegistered: 0,
    puzzlesCompleted: 0,
    royaltiesPending: '0',
  });
  const [hallidayAssets, setHallidayAssets] = useState<any[]>([]);

  useEffect(() => {
    const user = getTelegramUser();
    if (user) {
      setTelegramUser(user);
    }

    loadUserStats();
    loadHallidayAssets();
  }, []);

  const loadUserStats = async () => {
    try {
      // TODO: Implementar endpoint para obtener estadísticas del usuario
      setStats({
        ipsRegistered: 0,
        puzzlesCompleted: 0,
        royaltiesPending: '0',
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const loadHallidayAssets = async () => {
    try {
      const response = await axios.get(`${API_URL}/halliday/assets`);
      if (response.data.success) {
        const assets = Object.values(response.data.data || {});
        setHallidayAssets(assets as any[]);
      }
    } catch (error) {
      console.error('Error cargando assets de Halliday:', error);
    }
  };

  const connectWallet = async () => {
    setLoading(true);
    try {
      const user = getTelegramUser();
      if (!user) {
        alert('❌ No se pudo obtener información de Telegram');
        setLoading(false);
        return;
      }

      // Verificar conexión con Halliday API
      try {
        const assetsResponse = await axios.get(`${API_URL}/halliday/assets`);
        if (!assetsResponse.data.success) {
          throw new Error('No se pudo conectar con Halliday API');
        }

        // Generar una dirección de wallet determinística basada en el user ID de Telegram
        // En producción real, esto debería usar Halliday Smart Wallet o similar
        const userId = user.id.toString();
        const walletSeed = `telegram_${userId}_firstframe`;
        
        // Hash simple para generar dirección (en producción usar función criptográfica apropiada)
        const addressHash = Array.from(walletSeed).reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
        }, 0);
        
        // Generar dirección Ethereum válida
        const address = `0x${Math.abs(addressHash).toString(16).padStart(40, '0').slice(0, 40)}`;
        
        setWallet({
          address: address,
          connected: true,
          balance: '0', // TODO: Obtener balance real desde blockchain
        });
        
        console.log('✅ Wallet conectado:', address);
      } catch (hallidayError: any) {
        console.error('Error con Halliday API:', hallidayError);
        
        // Fallback: usar wallet simulado si Halliday no está disponible
        const address = `0x${user.id.toString(16).padStart(40, '0')}`;
        setWallet({
          address: address,
          connected: true,
          balance: '0',
        });
        
        alert('⚠️  Wallet conectado en modo simulado.\n\n' +
              'En producción, esto usará Halliday para crear un wallet real.');
      }
    } catch (error: any) {
      console.error('Error conectando wallet:', error);
      alert('Error: ' + (error.message || 'No se pudo conectar el wallet'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!wallet.connected || !wallet.address) {
      alert('❌ Primero debes conectar tu wallet');
      return;
    }

    try {
      setLoading(true);
      
      // IMPORTANTE: Usar un chain soportado por Halliday
      // Halliday no soporta "aeneid" directamente, usar "base", "ethereum", o "arbitrum"
      const quoteResponse = await axios.post(`${API_URL}/halliday/quotes`, {
        request: {
          kind: 'FIXED_INPUT',
          fixed_input_amount: {
            asset: 'usd',
            amount: '10',
          },
          output_asset: 'base:0x', // ETH en Base (chain soportada por Halliday)
        },
        price_currency: 'USD',
        onramps: ['MOONPAY', 'TRANSAK', 'STRIPE'],
        customer_ip_address: 'auto',
      });

      if (!quoteResponse.data.success) {
        const errorDetails = quoteResponse.data.details || {};
        const errorMsg = quoteResponse.data.error || 'No se pudo obtener quote de Halliday';
        throw new Error(`${errorMsg}\n\nDetalles: ${JSON.stringify(errorDetails, null, 2)}`);
      }

      const quotes = quoteResponse.data.data?.quotes || [];
      
      if (quotes.length === 0) {
        alert('❌ No se encontraron opciones de pago disponibles');
        return;
      }

      // Usar el primer quote disponible
      const selectedQuote = quotes[0];
      
      // Confirmar el pago
      const confirmResponse = await axios.post(`${API_URL}/halliday/confirm`, {
        payment_id: selectedQuote.payment_id,
        state_token: quoteResponse.data.data.state_token,
        owner_address: wallet.address,
        destination_address: wallet.address,
      });

      if (confirmResponse.data.success) {
        const paymentData = confirmResponse.data.data;
        
        // Mostrar información del pago
        if (paymentData.next_instruction?.funding_page_url) {
          const shouldOpen = window.confirm(
            `✅ Pago iniciado exitosamente!\n\n` +
            `📊 Monto: $10 USD\n` +
            `💰 Recibirás: ${paymentData.quoted?.output_amount?.amount || 'N/A'} ${paymentData.quoted?.output_amount?.asset || ''}\n\n` +
            `¿Deseas abrir la página de pago de Halliday?`
          );
          
          if (shouldOpen) {
            window.open(paymentData.next_instruction.funding_page_url, '_blank');
          }
        } else {
          alert('✅ Pago iniciado exitosamente!\n\n' +
                'En producción, se abrirá automáticamente el widget de Halliday para completar el pago.');
        }
      } else {
        throw new Error('No se pudo confirmar el pago');
      }
    } catch (error: any) {
      console.error('Error creando pago:', error);
      const errorMsg = error.response?.data?.error || error.message || 'No se pudo crear el pago';
      const errorDetails = error.response?.data?.details;
      
      let alertMessage = '❌ Error: ' + errorMsg;
      if (errorDetails) {
        alertMessage += '\n\nDetalles técnicos:\n' + JSON.stringify(errorDetails, null, 2);
      }
      alert(alertMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile">
      <Navigation title="Mi Perfil" />
      
      <div className="profile-content">
        {/* Información de Telegram */}
        {telegramUser && (
          <div className="profile-card telegram-info">
            <div className="card-header">
              <h3>👤 Usuario de Telegram</h3>
            </div>
            <div className="user-details">
              <div className="user-avatar">
                {telegramUser.first_name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <h4>{telegramUser.first_name} {telegramUser.last_name || ''}</h4>
                {telegramUser.username && (
                  <p className="username">@{telegramUser.username}</p>
                )}
                <p className="user-id">ID: {telegramUser.id}</p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Info */}
        <div className="profile-card wallet-info">
          <div className="card-header">
            <h3>💼 Wallet</h3>
          </div>
          {wallet.connected ? (
            <div className="wallet-connected">
              <div className="wallet-address">
                <span className="label">Dirección:</span>
                <code className="address">{wallet.address}</code>
              </div>
              {wallet.balance !== undefined && (
                <div className="wallet-balance">
                  <span className="label">Balance:</span>
                  <span className="balance">{wallet.balance} ETH</span>
                </div>
              )}
              <button 
                className="btn-wallet-action"
                onClick={handleCreatePayment}
                disabled={loading}
              >
                {loading ? 'Procesando...' : '💳 Crear Pago con Halliday'}
              </button>
              <p className="wallet-note">
                💡 Usa Halliday para convertir USD a cripto sin fricción
              </p>
            </div>
          ) : (
            <div className="wallet-disconnected">
              <p>Conecta tu wallet para gestionar pagos y regalías</p>
              <button 
                className="btn-connect-wallet"
                onClick={connectWallet}
                disabled={loading}
              >
                {loading ? 'Conectando...' : '🔗 Conectar Wallet (Halliday)'}
              </button>
              <p className="wallet-info">
                ⚡ Tu wallet se crea automáticamente vinculado a tu cuenta de Telegram
              </p>
            </div>
          )}
        </div>

        {/* Estadísticas */}
        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-icon">📤</div>
            <div className="stat-value">{stats.ipsRegistered}</div>
            <div className="stat-label">IPs Registrados</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🧩</div>
            <div className="stat-value">{stats.puzzlesCompleted}</div>
            <div className="stat-label">Puzzles Completados</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-value">{stats.royaltiesPending}</div>
            <div className="stat-label">Regalías Pendientes</div>
          </div>
        </div>

        {/* Mis IPs */}
        <div className="profile-section">
          <h3>📚 Mis IPs</h3>
          <div className="empty-state">
            <p>Aún no has registrado ningún IP</p>
            <a href="/upload" className="btn-link">
              📤 Registrar mi primer IP
            </a>
          </div>
        </div>

        {/* Assets de Halliday (debug) */}
        {hallidayAssets.length > 0 && process.env.NODE_ENV === 'development' && (
          <div className="profile-card debug-info">
            <div className="card-header">
              <h3>🔧 Debug: Assets Halliday</h3>
            </div>
            <p className="debug-text">
              {hallidayAssets.length} assets disponibles
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
