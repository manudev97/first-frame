import { useState, useEffect } from 'react';
import axios from 'axios';
import { DynamicWidgetWrapper } from '../components/DynamicWidgetWrapper';
import { useDynamicWallet } from '../hooks/useDynamicWallet';
import Navigation from '../components/Navigation';
import { getTelegramUser } from '../utils/telegram';
import './Profile.css';

// CRÍTICO: En producción, VITE_API_URL DEBE estar configurado en Vercel
// En desarrollo, usa el proxy de Vite (/api)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

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
  mockTokenBalance?: string;
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
  const dynamicWallet = useDynamicWallet(); // Obtener dirección de Dynamic
  const [userIPs, setUserIPs] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserIPs();
  }, [dynamicWallet.address]); // Recargar cuando cambie la dirección de Dynamic

  const loadUserIPs = async () => {
    try {
      const user = getTelegramUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Intentar obtener IPs desde el nuevo endpoint (prioriza registry local)
      // IMPORTANTE: Pasar la dirección de Dynamic si está disponible
      // Esto permite que el backend busque IPs registrados con la dirección de Dynamic
      try {
        const walletAddress = dynamicWallet.address;
        const ipsUrl = walletAddress 
          ? `${API_URL}/user/ips/${user.id}?walletAddress=${encodeURIComponent(walletAddress)}`
          : `${API_URL}/user/ips/${user.id}`;
        
        console.log(`🔍 Cargando IPs para usuario ${user.id} desde /user/ips...`);
        console.log(`🔍 Usando dirección: ${walletAddress || 'determinística'}`);
        const response = await axios.get(ipsUrl);
        
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

    // Actualizar wallet cuando Dynamic Wallet cambie
    // IMPORTANTE: Usar SOLO la dirección de Dynamic (asociada al email)
    // Ya no usar la dirección determinística generada por Telegram
    if (dynamicWallet.connected && dynamicWallet.address) {
      setWallet({
        address: dynamicWallet.address,
        connected: true,
      });
      // Cargar balance de Story Testnet usando la dirección de Dynamic
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
      // No mostrar error al usuario, solo loguear
    }
  };

  const loadUserStats = async () => {
    try {
      const user = getTelegramUser();
      if (!user) {
        return;
      }

      // Obtener estadísticas desde el endpoint que consulta blockchain
      // IMPORTANTE: Pasar la dirección de Dynamic si está disponible
      // Esto permite que el backend busque IPs registrados con la dirección de Dynamic
      try {
        const walletAddress = wallet?.address || dynamicWallet.address;
        const statsUrl = walletAddress 
          ? `${API_URL}/user/stats/${user.id}?walletAddress=${encodeURIComponent(walletAddress)}`
          : `${API_URL}/user/stats/${user.id}`;
        
        console.log('📊 Cargando estadísticas con dirección:', walletAddress || 'determinística');
        const statsResponse = await axios.get(statsUrl);
        
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

  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [txHashInput, setTxHashInput] = useState<string>('');
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const handlePayRoyalty = async (royaltyId: string) => {
    if (!wallet || !wallet.connected || !wallet.address) {
      alert('❌ Primero debes conectar tu wallet usando el botón de Dynamic Widget');
      return;
    }

    try {
      setLoading(true);
      
      // Obtener información de pago desde el backend
      const payInfoResponse = await axios.get(`${API_URL}/royalties/pay-info/${royaltyId}`);
      
      if (payInfoResponse.data.success) {
        setPaymentInfo({
          ...payInfoResponse.data.paymentInfo,
          royalty: payInfoResponse.data.royalty,
          royaltyId: royaltyId,
        });
        // Mostrar instrucciones al usuario
        const info = payInfoResponse.data.paymentInfo;
        const royalty = payInfoResponse.data.royalty;
        alert(
          `💳 Información de Pago\n\n` +
          `📤 Destinatario: ${info.recipientAddress}\n` +
          `💰 Monto: ${info.amount} ${info.currency}\n` +
          `🎬 Video: ${royalty.videoTitle}\n\n` +
          `1. Usa tu wallet Dynamic para enviar ${info.amount} ${info.currency} a la dirección de arriba\n` +
          `2. Copia el TX Hash de la transacción\n` +
          `3. Pega el TX Hash en el campo de abajo y haz clic en "Verificar Pago"`
        );
      } else {
        throw new Error(payInfoResponse.data.error || 'No se pudo obtener información de pago');
      }
    } catch (error: any) {
      console.error('Error obteniendo información de pago:', error);
      const errorMsg = error.response?.data?.error || error.message || 'No se pudo obtener información de pago';
      alert('❌ Error: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentInfo || !txHashInput.trim()) {
      alert('❌ Por favor ingresa el TX Hash de la transacción');
      return;
    }

    if (!wallet || !wallet.address) {
      alert('❌ No hay wallet conectada');
      return;
    }

    try {
      setVerifyingPayment(true);
      
      const verifyResponse = await axios.post(`${API_URL}/royalties/verify-payment`, {
        royaltyId: paymentInfo.royaltyId,
        txHash: txHashInput.trim(),
        payerWalletAddress: wallet.address,
      });

      if (verifyResponse.data.success) {
        alert(
          `✅ Pago Verificado Exitosamente!\n\n` +
          `🔗 TX Hash: ${txHashInput.trim()}\n` +
          `📊 Ver en explorador:\n` +
          `https://aeneid.storyscan.io/tx/${txHashInput.trim()}\n\n` +
          (verifyResponse.data.videoReSent 
            ? `✅ El video ha sido reenviado sin protección. Ahora puedes reenviarlo libremente.`
            : `⚠️ El video no se pudo reenviar automáticamente.`)
        );

        // Limpiar estado
        setPaymentInfo(null);
        setTxHashInput('');

        // Recargar regalías pendientes y estadísticas
        await loadPendingRoyalties();
        await loadUserStats();
        await loadStoryBalance(wallet.address);
      } else {
        throw new Error(verifyResponse.data.error || 'No se pudo verificar el pago');
      }
    } catch (error: any) {
      console.error('Error verificando pago:', error);
      const errorMsg = error.response?.data?.error || error.message || 'No se pudo verificar el pago';
      alert('❌ Error: ' + errorMsg);
    } finally {
      setVerifyingPayment(false);
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
                    if (wallet.address) {
                      navigator.clipboard.writeText(wallet.address);
                      alert('✅ Dirección copiada al portapapeles');
                    }
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
                    {wallet.balance !== undefined ? `${parseFloat(wallet.balance).toFixed(4)} IP` : 'Cargando...'}
                  </span>
                </div>
                <div>
                  <span className="label">MockERC20 (para regalías):</span>
                  <span className="balance">
                    {wallet.mockTokenBalance !== undefined ? `${parseFloat(wallet.mockTokenBalance).toFixed(4)} tokens` : 'Cargando...'}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {paymentInfo && paymentInfo.royaltyId === royalty.id ? (
                        <>
                          <div style={{ 
                            padding: '1rem', 
                            background: '#f0f0f0', 
                            borderRadius: '8px',
                            fontSize: '0.9rem'
                          }}>
                            <p style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#000' }}>
                              <strong style={{ color: '#000' }}>🎬 Video:</strong> <span style={{ color: '#000' }}>{royalty.videoTitle}</span>
                            </p>
                            <p style={{ marginBottom: '0.75rem', color: '#000' }}>
                              <strong style={{ color: '#000' }}>💰 Monto:</strong> <span style={{ color: '#000' }}>{paymentInfo.amount} {paymentInfo.currency}</span>
                            </p>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <strong style={{ color: '#000' }}>📤 Dirección del destinatario:</strong>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                marginTop: '0.5rem',
                                padding: '0.75rem',
                                background: 'white',
                                borderRadius: '6px',
                                border: '1px solid #ddd'
                              }}>
                                <code style={{ 
                                  flex: 1, 
                                  fontFamily: 'monospace', 
                                  fontSize: '0.85rem',
                                  wordBreak: 'break-all',
                                  color: '#333',
                                  lineHeight: '1.4'
                                }}>
                                  {paymentInfo.recipientAddress}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(paymentInfo.recipientAddress);
                                    alert('✅ Dirección copiada al portapapeles');
                                  }}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: '#4285F4',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.background = '#357ae8'}
                                  onMouseOut={(e) => e.currentTarget.style.background = '#4285F4'}
                                  title="Copiar dirección"
                                >
                                  📋 Copiar
                                </button>
                              </div>
                            </div>
                            <div style={{ 
                              marginTop: '0.75rem', 
                              padding: '0.75rem',
                              background: '#e3f2fd',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              color: '#1976d2'
                            }}>
                              <strong>📋 Pasos para pagar:</strong>
                              <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0 }}>
                                <li style={{ marginBottom: '0.25rem' }}>Copia la dirección de arriba</li>
                                <li style={{ marginBottom: '0.25rem' }}>Envía {paymentInfo.amount} {paymentInfo.currency} usando tu wallet Dynamic</li>
                                <li style={{ marginBottom: '0.25rem' }}>Ingresa el TX Hash abajo</li>
                                <li>Haz clic en "Verificar Pago"</li>
                              </ol>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Pega el TX Hash aquí (0x...)"
                            value={txHashInput}
                            onChange={(e) => setTxHashInput(e.target.value)}
                            style={{
                              padding: '0.5rem',
                              borderRadius: '8px',
                              border: '1px solid #ddd',
                              fontSize: '0.85rem',
                            }}
                          />
                          <button
                            className="btn-pay-royalty"
                            onClick={handleVerifyPayment}
                            disabled={verifyingPayment || !txHashInput.trim()}
                          >
                            {verifyingPayment ? 'Verificando...' : '✅ Verificar Pago'}
                          </button>
                          <button
                            onClick={() => {
                              setPaymentInfo(null);
                              setTxHashInput('');
                            }}
                            style={{
                              padding: '0.5rem',
                              background: 'transparent',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                            }}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-pay-royalty"
                          onClick={() => handlePayRoyalty(royalty.id)}
                          disabled={loading || isExpired}
                        >
                          {loading ? 'Procesando...' : `💳 Pagar ${royalty.amount} IP`}
                        </button>
                      )}
                    </div>
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
