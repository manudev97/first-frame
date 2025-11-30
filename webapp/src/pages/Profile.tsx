import { useState, useEffect } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { getTelegramUser } from '../utils/telegram';
import { connectWallet, disconnectWallet, getSavedWallet, type WalletInfo } from '../services/walletService';
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

interface IPAsset {
  ipId: string;
  tokenId?: string;
  title: string;
  year?: number;
  posterUrl?: string;
  description?: string;
  txHash?: string;
  createdAt: string;
}

function UserIPsList() {
  const [userIPs, setUserIPs] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserIPs();
  }, []);

  const loadUserIPs = async () => {
    try {
      const user = getTelegramUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const uploaderId = `TelegramUser_${user.id}`;
      const response = await axios.get(`${API_URL}/marketplace/user/${encodeURIComponent(uploaderId)}`);
      
      if (response.data.success) {
        setUserIPs(response.data.items || []);
      }
    } catch (error) {
      console.error('Error cargando IPs del usuario:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (userIPs.length === 0) {
    return (
      <div className="empty-state">
        <p>Aún no has registrado ningún IP</p>
        <a href="/upload" className="btn-link">
          📤 Registrar mi primer IP
        </a>
      </div>
    );
  }

  return (
    <div className="user-ips-grid">
      {userIPs.map((ip) => (
        <div key={ip.ipId} className="user-ip-card">
          {ip.posterUrl && (
            <img src={ip.posterUrl} alt={ip.title} className="user-ip-poster" />
          )}
          <div className="user-ip-info">
            <h4>{ip.title}</h4>
            {ip.year && <p className="user-ip-year">{ip.year}</p>}
            <div className="user-ip-actions">
              <a 
                href={`https://aeneid.storyscan.io/token/${ip.ipId}${ip.tokenId ? `/instance/${ip.tokenId}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="user-ip-link"
              >
                🔗 Ver en Explorer
              </a>
              {(ip as any).txHash && (
                <a 
                  href={`https://aeneid.storyscan.io/tx/${(ip as any).txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="user-ip-link"
                >
                  📋 Ver TX
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Profile() {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
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

    // Cargar wallet guardado
    const savedWallet = getSavedWallet();
    if (savedWallet) {
      setWallet(savedWallet);
      // Cargar balance de Story Testnet
      loadStoryBalance(savedWallet.address);
    }

    loadUserStats();
    loadHallidayAssets();
  }, []);

  const loadStoryBalance = async (address: string) => {
    try {
      const response = await axios.get(`${API_URL}/balance/${address}`);
      if (response.data.success) {
        setWallet((prev) => prev ? { ...prev, balance: response.data.balance } : null);
      }
    } catch (error) {
      console.error('Error cargando balance de Story:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      const user = getTelegramUser();
      if (!user) {
        return;
      }

      // Obtener IPs registrados por el usuario
      const uploaderId = `TelegramUser_${user.id}`;
      try {
        const userIPsResponse = await axios.get(`${API_URL}/marketplace/user/${encodeURIComponent(uploaderId)}`);
        
        if (userIPsResponse.data.success) {
          const userIPs = userIPsResponse.data.items || [];
          setStats({
            ipsRegistered: userIPs.length,
            puzzlesCompleted: 0, // TODO: Implementar tracking de puzzles completados
            royaltiesPending: '0', // TODO: Implementar cálculo de regalías
          });
        }
      } catch (error: any) {
        // Si el endpoint no existe o falla, intentar obtener todos los IPs y filtrar
        console.warn('Error obteniendo IPs del usuario, intentando método alternativo:', error.message);
        try {
          const allIPsResponse = await axios.get(`${API_URL}/marketplace/list`);
          if (allIPsResponse.data.success && allIPsResponse.data.items) {
            const userIPs = allIPsResponse.data.items.filter((ip: any) => 
              ip.uploader && ip.uploader.toLowerCase() === uploaderId.toLowerCase()
            );
            setStats({
              ipsRegistered: userIPs.length,
              puzzlesCompleted: 0,
              royaltiesPending: '0',
            });
          }
        } catch (fallbackError) {
          console.error('Error en método alternativo:', fallbackError);
        }
      }
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

  const handleConnectWallet = async () => {
    setLoading(true);
    try {
      const walletInfo = await connectWallet();
      setWallet(walletInfo);
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

  const handleCreatePayment = async () => {
    if (!wallet || !wallet.connected || !wallet.address) {
      alert('❌ Primero debes conectar tu wallet');
      handleConnectWallet();
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
          {wallet && wallet.connected ? (
            <div className="wallet-connected">
              <div className="wallet-address">
                <span className="label">Dirección:</span>
                <code className="address">{wallet.address}</code>
                <button 
                  className="btn-copy-address"
                  onClick={() => {
                    navigator.clipboard.writeText(wallet.address);
                    alert('✅ Dirección copiada al portapapeles');
                  }}
                  title="Copiar dirección"
                >
                  📋
                </button>
              </div>
              <div className="wallet-balance">
                <span className="label">IP Balance (Story Testnet):</span>
                <span className="balance">
                  {wallet.balance !== undefined ? `${parseFloat(wallet.balance).toFixed(2)} IP` : 'Cargando...'}
                </span>
                {wallet.balance !== undefined && parseFloat(wallet.balance) < 0.001 && (
                  <div style={{ marginTop: '10px' }}>
                    <a
                      href="https://cloud.google.com/application/web3/faucet/story/aeneid"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-faucet"
                      style={{
                        display: 'inline-block',
                        padding: '0.5rem 1rem',
                        background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        marginTop: '0.5rem',
                      }}
                    >
                      💧 Obtener Fondos del Faucet
                    </a>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      Necesitas fondos para registrar IPs en Story Testnet
                    </p>
                  </div>
                )}
              </div>
              <div className="wallet-actions">
                <button 
                  className="btn-wallet-action"
                  onClick={handleCreatePayment}
                  disabled={loading}
                >
                  {loading ? 'Procesando...' : '💳 Crear Pago con Halliday'}
                </button>
                <button 
                  className="btn-wallet-disconnect"
                  onClick={handleDisconnectWallet}
                >
                  Desconectar
                </button>
              </div>
              <p className="wallet-note">
                💡 Usa Halliday para convertir USD a cripto sin fricción
              </p>
            </div>
          ) : (
            <div className="wallet-disconnected">
              <p>Conecta tu wallet para gestionar pagos y regalías</p>
              <button 
                className="btn-connect-wallet"
                onClick={handleConnectWallet}
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
          <h3>📚 Mis IPs ({stats.ipsRegistered})</h3>
          <UserIPsList />
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
