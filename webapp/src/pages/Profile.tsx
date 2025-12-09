import { useState, useEffect } from 'react';
import axios from 'axios';
import { DynamicWidgetWrapper } from '../components/DynamicWidgetWrapper';
import { useDynamicWallet } from '../hooks/useDynamicWallet';
import Navigation from '../components/Navigation';
import { getTelegramUser } from '../utils/telegram';
import { getSavedWallet, type WalletInfo } from '../services/walletService';
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

      // Intentar obtener IPs desde el nuevo endpoint (prioriza registry local)
      try {
        console.log(`🔍 Cargando IPs para usuario ${user.id} desde /user/ips...`);
        const response = await axios.get(`${API_URL}/user/ips/${user.id}`);
        
        console.log('📥 Respuesta del endpoint /user/ips:', {
          success: response.data.success,
          count: response.data.count,
          itemsLength: response.data.items?.length,
          items: response.data.items,
        });
        
        if (response.data.success && response.data.items) {
          // Asegurarse de que los items tengan el formato correcto
          const formattedIPs = response.data.items.map((ip: any) => {
            const formatted = {
              ipId: ip.ipId,
              tokenId: ip.tokenId,
              title: ip.title || 'Untitled',
              year: ip.year,
              posterUrl: ip.posterUrl,
              description: ip.description,
              createdAt: ip.createdAt || new Date().toISOString(),
              txHash: ip.txHash,
            };
            console.log(`📦 IP formateado:`, formatted);
            return formatted;
          });
          
          console.log(`✅ IPs cargados: ${formattedIPs.length}`);
          setUserIPs(formattedIPs);
          return;
        } else {
          console.warn('⚠️  Respuesta sin items o success=false:', response.data);
        }
      } catch (endpointError: any) {
        console.error('❌ Error obteniendo IPs desde /user/ips:', endpointError);
        console.error('Detalles:', endpointError.response?.data || endpointError.message);
      }

      // Fallback: usar endpoint del marketplace (registry local directo)
      const uploaderId = `TelegramUser_${user.id}`;
      const response = await axios.get(`${API_URL}/marketplace/user/${encodeURIComponent(uploaderId)}`);
      
      if (response.data.success && response.data.items) {
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
        <div key={ip.ipId || ip.tokenId || `ip-${userIPs.indexOf(ip)}`} className="user-ip-card">
          {ip.posterUrl ? (
            <img src={ip.posterUrl} alt={ip.title} className="user-ip-poster" />
          ) : (
            <div className="user-ip-poster-placeholder">
              <div className="placeholder-icon">🎬</div>
              <p className="placeholder-text">{ip.title}</p>
            </div>
          )}
          <div className="user-ip-info">
            <h4>{ip.title}</h4>
            {ip.year && <p className="user-ip-year">{ip.year}</p>}
            {ip.description && (
              <p className="user-ip-description">{ip.description}</p>
            )}
            {ip.tokenId && (
              <p className="user-ip-token-id" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Token ID: {ip.tokenId}
              </p>
            )}
            <div className="user-ip-actions">
              <a 
                href={`https://aeneid.storyscan.io/token/${ip.ipId}${ip.tokenId ? `/instance/${ip.tokenId}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="user-ip-link"
              >
                🔗 Ver en Explorer
              </a>
              {ip.txHash && (
                <a 
                  href={`https://aeneid.storyscan.io/tx/${ip.txHash}`}
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
  const dynamicWallet = useDynamicWallet();
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    ipsRegistered: 0,
    puzzlesCompleted: 0,
    royaltiesPending: '0',
  });
  const [pendingRoyalties, setPendingRoyalties] = useState<any[]>([]);

  useEffect(() => {
    const user = getTelegramUser();
    if (user) {
      setTelegramUser(user);
    }

    // Actualizar wallet cuando Dynamic Wallet cambie (sin esperar isLoading)
    if (dynamicWallet.connected && dynamicWallet.address) {
      setWallet({
        address: dynamicWallet.address,
        connected: true,
      });
      // Cargar balance de Story Testnet de forma asíncrona
      loadStoryBalance(dynamicWallet.address);
    } else {
      setWallet(null);
    }

    // Cargar estadísticas y regalías inmediatamente (no dependen de wallet)
    loadUserStats();
    loadPendingRoyalties();
  }, [dynamicWallet.connected, dynamicWallet.address]);

  const loadStoryBalance = async (address: string) => {
    try {
      const [ipResponse, tokenResponse] = await Promise.all([
        axios.get(`${API_URL}/balance/${address}`),
        axios.get(`${API_URL}/balance/${address}/token`),
      ]);
      
      if (ipResponse.data.success && tokenResponse.data.success) {
        setWallet((prev) => prev ? { 
          ...prev, 
          balance: ipResponse.data.balance,
          mockTokenBalance: tokenResponse.data.balance,
        } : null);
      }
    } catch (error) {
      console.error('Error cargando balances:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      const user = getTelegramUser();
      if (!user) {
        return;
      }

      // Obtener estadísticas desde el endpoint que consulta blockchain
      try {
        const statsResponse = await axios.get(`${API_URL}/user/stats/${user.id}`);
        
        if (statsResponse.data.success) {
          setStats({
            ipsRegistered: statsResponse.data.stats.ipsRegistered || 0,
            puzzlesCompleted: statsResponse.data.stats.puzzlesCompleted || 0,
            royaltiesPending: statsResponse.data.stats.royaltiesPending || '0',
          });
          console.log('✅ Estadísticas cargadas:', statsResponse.data.stats);
        }
      } catch (error: any) {
        console.error('Error obteniendo estadísticas:', error.message);
        // Fallback: usar valores por defecto
        setStats({
          ipsRegistered: 0,
          puzzlesCompleted: 0,
          royaltiesPending: '0',
        });
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };


  const loadPendingRoyalties = async () => {
    try {
      const user = getTelegramUser();
      if (!user) return;

      const response = await axios.get(`${API_URL}/royalties/pending/${user.id}`);
      if (response.data.success) {
        setPendingRoyalties(response.data.royalties || []);
      }
    } catch (error) {
      console.error('Error cargando regalías pendientes:', error);
    }
  };

  // Dynamic Wallet maneja la conexión/desconexión automáticamente
  // No necesitamos estas funciones, pero las mantenemos para compatibilidad

  const handlePayRoyalty = async (royaltyId: string) => {
    if (!wallet || !wallet.connected || !wallet.address) {
      alert('❌ Primero debes conectar tu wallet usando el botón de Dynamic Widget');
      return;
    }

    try {
      setLoading(true);
      
      // Obtener la regalía para mostrar información
      const royalty = pendingRoyalties.find(r => r.id === royaltyId);
      const royaltyAmount = royalty?.amount || '0.1';
      
      // Obtener wallet del uploader desde la regalía
      const { generateDeterministicWallet } = await import('../services/walletService');
      const uploaderWallet = royalty?.uploaderTelegramId 
        ? await generateDeterministicWallet(royalty.uploaderTelegramId)
        : null;
      
      if (!uploaderWallet) {
        alert('❌ No se pudo obtener la dirección del destinatario');
        return;
      }
      
      // Obtener telegramUserId del usuario actual
      const telegramUser = getTelegramUser();
      const telegramUserId = telegramUser?.id;
      
      if (!telegramUserId) {
        alert('❌ No se pudo obtener tu ID de Telegram. Por favor, recarga la página.');
        return;
      }
      
      // Pagar regalía usando Story Protocol SDK (payRoyaltyOnBehalf)
      console.log('💰 Pagando regalía usando Story Protocol...');
      
      const paymentResponse = await axios.post(`${API_URL}/royalties/pay`, {
        royaltyId,
        ownerAddress: wallet.address,
        destinationAddress: uploaderWallet,
        payerTelegramUserId: telegramUserId,
      });

      if (paymentResponse.data.success) {
        const paymentData = paymentResponse.data.payment;
        const balances = paymentResponse.data.balances;
        const txHash = paymentResponse.data.txHash;
        
        let successMessage = `✅ Regalía pagada exitosamente!\n\n`;
        successMessage += `💰 Monto: ${royaltyAmount} IP\n`;
        successMessage += `📤 Destinatario: ${paymentResponse.data.royalty.uploaderName || 'Creador original'}\n`;
        
        if (txHash) {
          successMessage += `🔗 TX Hash: ${txHash}\n`;
          successMessage += `\n📊 Ver en explorador:\n`;
          successMessage += `https://aeneid.storyscan.io/tx/${txHash}\n`;
        }
        
        if (balances) {
          successMessage += `\n📊 Balances:\n`;
          successMessage += `Tu balance: ${parseFloat(balances.payer.before).toFixed(4)} IP → ${parseFloat(balances.payer.after).toFixed(4)} IP\n`;
          successMessage += `Destinatario: ${parseFloat(balances.uploader.before).toFixed(4)} IP → ${parseFloat(balances.uploader.after).toFixed(4)} IP\n`;
        }
        
        alert(successMessage);

        // Recargar regalías pendientes y estadísticas
        await loadPendingRoyalties();
        await loadUserStats();
        await loadStoryBalance(wallet.address);
      } else {
        throw new Error(paymentResponse.data.error || 'No se pudo procesar el pago');
      }
    } catch (error: any) {
      console.error('Error pagando regalía:', error);
      const errorMsg = error.response?.data?.error || error.message || 'No se pudo pagar la regalía';
      const errorDetails = error.response?.data;
      
      let alertMessage = '❌ Error: ' + errorMsg;
      if (errorDetails?.message) {
        alertMessage += '\n\n' + errorDetails.message;
      }
      if (errorDetails?.faucetUrl) {
        alertMessage += `\n\n💧 Obtén fondos del faucet: ${errorDetails.faucetUrl}`;
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
              {dynamicWallet.network !== 1315 && (
                <div style={{ 
                  padding: '0.75rem', 
                  background: '#fff3cd', 
                  borderRadius: '8px', 
                  marginTop: '0.5rem',
                  fontSize: '0.85rem'
                }}>
                  ⚠️ Cambia a Story Testnet (Chain ID: 1315) para usar FirstFrame
                </div>
              )}
              <div className="wallet-balance">
                <div style={{ marginBottom: '0.75rem' }}>
                  <span className="label">IP Nativo (para gas):</span>
                  <span className="balance">
                    {wallet.balance !== undefined ? `${parseFloat(wallet.balance).toFixed(2)} IP` : 'Cargando...'}
                  </span>
                </div>
                <div>
                  <span className="label">MockERC20 (para regalías):</span>
                  <span className="balance">
                    {wallet.mockTokenBalance !== undefined ? `${parseFloat(wallet.mockTokenBalance).toFixed(2)} tokens` : 'Cargando...'}
                  </span>
                </div>
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
                      💧 Obtener IP Nativo (Faucet)
                    </a>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      Necesitas IP nativo para pagar gas fees
                    </p>
                  </div>
                )}
                {wallet.mockTokenBalance !== undefined && parseFloat(wallet.mockTokenBalance) < 0.1 && (
                  <div style={{ marginTop: '10px' }}>
                    <a
                      href="https://aeneid.storyscan.io/address/0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E?tab=write_contract#0x40c10f19"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-faucet"
                      style={{
                        display: 'inline-block',
                        padding: '0.5rem 1rem',
                        background: 'linear-gradient(135deg, #9C27B0 0%, #E91E63 100%)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        marginTop: '0.5rem',
                      }}
                    >
                      🪙 Obtener MockERC20 Tokens
                    </a>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      Necesitas MockERC20 tokens para pagar regalías
                    </p>
                  </div>
                )}
              </div>
              <div className="wallet-actions">
                <DynamicWidgetWrapper />
              </div>
            </div>
          ) : (
            <div className="wallet-disconnected">
              <p>Conecta tu wallet para gestionar pagos y regalías</p>
              <div style={{ marginTop: '1rem' }}>
                <DynamicWidgetWrapper />
              </div>
              <p className="wallet-info">
                ⚡ Conecta tu wallet usando Dynamic para aprobar y pagar regalías
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

        {/* Regalías Pendientes */}
        {pendingRoyalties.length > 0 && (
          <div className="profile-card royalties-pending">
            <div className="card-header">
              <h3>💳 Regalías Pendientes</h3>
            </div>
            <div className="royalties-list">
              {pendingRoyalties.map((royalty) => {
                const expiresAt = new Date(royalty.expiresAt);
                const minutesLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 60000);
                const isExpired = minutesLeft <= 0;
                
                return (
                  <div 
                    key={royalty.id}
                    className={`royalty-item ${isExpired ? 'expired' : ''}`}
                  >
                    <div className="royalty-info">
                      <h4>{royalty.videoTitle || 'Video protegido'}</h4>
                      <p className="royalty-details">
                        Para: {royalty.uploaderName || 'Creador original'} • {royalty.amount} IP
                      </p>
                      {isExpired ? (
                        <p className="royalty-expired">
                          ⏰ Expirada - Serás penalizado
                        </p>
                      ) : (
                        <p className="royalty-time">
                          ⏰ {minutesLeft} minuto{minutesLeft !== 1 ? 's' : ''} restante{minutesLeft !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <button
                      className="btn-pay-royalty"
                      onClick={() => handlePayRoyalty(royalty.id)}
                      disabled={loading || isExpired}
                    >
                      {loading ? 'Procesando...' : `💳 Pagar ${royalty.amount} IP`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mis IPs */}
        <div className="profile-section">
          <h3>📚 Mis IPs ({stats.ipsRegistered})</h3>
          <UserIPsList />
        </div>

      </div>
    </div>
  );
}

export default Profile;
