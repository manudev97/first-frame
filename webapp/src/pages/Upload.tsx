import { useState, useEffect } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { getTelegramUser } from '../utils/telegram';
import { useDynamicWallet } from '../hooks/useDynamicWallet';
import './Upload.css';

import { getApiUrl } from '../utils/api';

// Obtener API_URL usando el helper
const API_URL = getApiUrl();

function Upload() {
  const dynamicWallet = useDynamicWallet(); // Usar Dynamic Wallet
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [imdbData, setImdbData] = useState<any>(null);
  const [registeredIpId, setRegisteredIpId] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null); // Token ID (instance number)
  const [txHash, setTxHash] = useState<string | null>(null);
  const [channelMessageId, setChannelMessageId] = useState<number | null>(null);
  
  // Metadatos del video de Telegram (si viene desde el bot)
  const [videoInfo, setVideoInfo] = useState<{
    fileId?: string;
    fileName?: string;
    fileSizeMB?: string;
    durationMinutes?: string;
    videoLink?: string;
  }>({});

  // Cargar parámetros de la URL si vienen desde Telegram
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('fileId');
    const fileName = urlParams.get('fileName');
    const fileSizeMB = urlParams.get('fileSizeMB');
    const durationMinutes = urlParams.get('durationMinutes');
    const videoLink = urlParams.get('videoLink');
    
    if (fileId || fileName) {
      setVideoInfo({
        fileId: fileId || undefined,
        fileName: fileName || undefined,
        fileSizeMB: fileSizeMB || undefined,
        durationMinutes: durationMinutes || undefined,
        videoLink: videoLink || undefined,
      });
      if (videoLink) {
        setVideoUrl(videoLink);
      }
    }
  }, []);

  const searchMovie = async () => {
    if (!title || !year) {
      alert('Por favor ingresa título y año');
      return;
    }
    
    // Verificar que API_URL esté configurado
    if (!API_URL) {
      const errorMsg = '❌ Error de configuración: VITE_API_URL no está configurado.\n\n' +
        'En producción, configura VITE_API_URL en Vercel:\n' +
        'Settings → Environment Variables → VITE_API_URL\n' +
        'Valor: https://first-frame-wg3r.onrender.com/api';
      alert(errorMsg);
      console.error('API_URL no configurado:', { API_URL, env: import.meta.env });
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔍 Buscando película en IMDB:', { title, year, API_URL });
      const response = await axios.get(`${API_URL}/imdb/movie/${encodeURIComponent(title)}/${year}`);
      if (response.data.success) {
        setImdbData(response.data.data);
        alert('✅ Película encontrada en IMDB');
      } else {
        alert('❌ Película no encontrada: ' + (response.data.error || 'Error desconocido'));
      }
    } catch (error: any) {
      console.error('❌ Error buscando película:', error);
      console.error('Detalles:', {
        message: error.message,
        response: error.response?.data,
        url: `${API_URL}/imdb/movie/${encodeURIComponent(title)}/${year}`,
        API_URL,
      });
      
      let errorMsg = error.response?.data?.error || error.message || 'Error al buscar película';
      
      // Mensaje más descriptivo para errores de red
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMsg = '❌ Error de conexión con el backend.\n\n' +
          'Verifica que:\n' +
          '1. VITE_API_URL esté configurado en Vercel\n' +
          '2. El backend esté corriendo en Render\n' +
          '3. La URL del backend sea correcta\n\n' +
          `URL intentada: ${API_URL}/imdb/movie/...`;
      }
      
      alert('Error: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Obtener datos de IMDB si no están
      let movieData = imdbData;
      if (!movieData) {
        const imdbResponse = await axios.get(`${API_URL}/imdb/movie/${encodeURIComponent(title)}/${year}`);
        movieData = imdbResponse.data.data;
      }

      // 2. Crear metadata y subir a IPFS (con metadatos del video de Telegram)
      // IMPORTANTE: Incluir el póster de IMDB en la metadata
      const metadataResponse = await axios.post(`${API_URL}/ip/upload-video`, {
        videoUrl: videoUrl || videoInfo.videoLink,
        title,
        year: parseInt(year),
        imdbData: movieData,
        videoSizeMB: videoInfo.fileSizeMB,
        videoDurationMinutes: videoInfo.durationMinutes,
        videoFileName: videoInfo.fileName,
      });

      // 3. Registrar IP en Story Protocol SIN términos de licencia primero
      // (evita el error LicenseAttachmentWorkflows_NoLicenseTermsData)
      // IMPORTANTE: Usar nftMetadataUri separado que incluye el póster en formato OpenSea
      const telegramUser = getTelegramUser();
      const uploaderId = telegramUser ? `TelegramUser_${telegramUser.id}` : 'Anonymous';
      
      // CRÍTICO: Obtener wallet del usuario para pagar el fee (usar Dynamic Wallet)
      // Según la documentación de Dynamic: primaryWallet.address es la forma correcta
      // https://www.dynamic.xyz/docs/react-sdk/hooks/usedynamiccontext
      const walletAddress = dynamicWallet.address || 
                           dynamicWallet.primaryWallet?.address ||
                           null;
      
      // CRÍTICO: Log detallado para debugging
      console.log('🔍 [Upload] Verificando wallet:', {
        connected: dynamicWallet.connected,
        address: dynamicWallet.address,
        hasPrimaryWallet: !!dynamicWallet.primaryWallet,
        primaryWalletAddress: dynamicWallet.primaryWallet?.address,
        walletAddress,
        isLoggedIn: dynamicWallet.user ? 'yes' : 'no',
        userId: dynamicWallet.user?.userId,
      });
      
      // CRÍTICO: Verificar usando la lógica del hook (que usa useIsLoggedIn)
      if (!dynamicWallet.connected || !walletAddress) {
        console.error('❌ [Upload] Wallet no conectada:', {
          connected: dynamicWallet.connected,
          address: dynamicWallet.address,
          primaryWalletAddress: dynamicWallet.primaryWallet?.address,
          hasUser: !!dynamicWallet.user,
        });
        throw new Error('Debes conectar tu wallet primero para registrar IPs. Si ya la conectaste con Dynamic, espera unos segundos y recarga la página.');
      }
      
      // Verificar que esté en la red correcta
      if (dynamicWallet.network !== 1315) {
        throw new Error('Debes estar conectado a Story Testnet (Chain ID: 1315). Cambia la red en tu wallet de Dynamic.');
      }
      
      console.log('✅ [Upload] Wallet verificada:', {
        address: walletAddress,
        network: dynamicWallet.network,
        connected: dynamicWallet.connected,
      });

      const storyResponse = await axios.post(`${API_URL}/story/register-ip`, {
        metadata: {
          uri: metadataResponse.data.metadataUri, // IP Metadata
          hash: metadataResponse.data.metadataHash,
          nftUri: metadataResponse.data.nftMetadataUri || metadataResponse.data.metadataUri, // NFT Metadata con póster
          nftHash: metadataResponse.data.nftMetadataHash || metadataResponse.data.metadataHash,
        },
        // Datos adicionales para guardar en el marketplace
        title: title,
        year: parseInt(year),
        posterUrl: movieData?.poster || movieData?.Poster || metadataResponse.data.posterUrl,
        description: movieData?.plot || movieData?.Plot,
        imdbId: movieData?.imdbId || movieData?.imdbID,
        uploader: uploaderId, // CRÍTICO: Enviar uploader para que se muestre en el perfil
        uploaderName: telegramUser ? `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim() : undefined, // Enviar nombre del uploader
        userWalletAddress: walletAddress, // CRÍTICO: Wallet de Dynamic del usuario para pagar fees (usar la address detectada)
        // NO pasar licenseTerms - se registrarán después
      });

      // 4. Registrar términos de licencia para el IP registrado (para cobrar regalías)
      // IMPORTANTE: Si no hay currency token configurado, las regalías se establecerán a 0
      // para evitar el error "Royalty policy requires currency token"
      // En producción, necesitarás configurar un wrapped IP token address para regalías
      // 4. Registrar términos de licencia (ASÍNCRONO - no bloquea el proceso)
      // Esto se hace en paralelo para no bloquear la UI
      if (storyResponse.data.ipId) {
        // Hacer el registro de licencia de forma asíncrona sin esperar
        (async () => {
          try {
            const licenseResponse = await axios.post(`${API_URL}/story/register-license`, {
              ipId: storyResponse.data.ipId, // IP ID requerido
              licenseTerms: {
                // CRÍTICO: IPs comercializables por defecto
                // El backend usará MockERC20 como currency token si no se proporciona uno
                commercialUse: true, // true para permitir uso comercial
                commercialRevShare: 0, // 0% de regalías comerciales inicialmente (puede cambiarse después)
                commercialAttribution: true, // Requiere atribución en uso comercial
                derivativesAllowed: true, // Permitir derivados
                derivativesAttribution: true, // Requiere atribución en derivados
                transferable: true, // Licencias transferibles
                mintingFee: '0', // Sin fee inicial para facilitar acceso
                // El backend usará MockERC20 token address como currency por defecto
                // currency: se establecerá automáticamente en el backend usando MockERC20
              },
            });
            if (licenseResponse.data.success) {
              console.log('✅ Licencia registrada exitosamente');
            } else if (licenseResponse.data.warning) {
              console.warn('⚠️  IP registrado, pero licencia no se pudo registrar:', licenseResponse.data.message);
              // No es crítico - el IP está registrado
            }
          } catch (licenseError: any) {
            // Si el error es sobre currency token, no es crítico - el IP está registrado
            if (licenseError.response?.data?.warning) {
              console.warn('⚠️  IP registrado, pero licencia no se pudo registrar:', licenseError.response.data.message);
            } else {
              console.warn('No se pudo registrar licencia, pero el IP fue registrado:', licenseError);
            }
          }
        })();
      }

      // IMPORTANTE: Verificar que la respuesta tenga los datos necesarios
      if (!storyResponse.data.success) {
        throw new Error('No se pudo registrar el IP en Story Protocol: ' + (storyResponse.data.error || 'Error desconocido'));
      }

      if (!storyResponse.data.ipId || !storyResponse.data.txHash) {
        console.error('❌ Respuesta del backend sin ipId o txHash:', storyResponse.data);
        throw new Error('El backend no devolvió ipId o txHash. Respuesta: ' + JSON.stringify(storyResponse.data));
      }

      // IMPORTANTE: Establecer éxito ANTES de reenviar el video para que la UI se muestre inmediatamente
      console.log('✅ IP registrado exitosamente:', {
        ipId: storyResponse.data.ipId,
        txHash: storyResponse.data.txHash,
      });
      
      setRegisteredIpId(storyResponse.data.ipId);
      setTokenId(storyResponse.data.tokenId || null); // Guardar token ID si está disponible
      setTxHash(storyResponse.data.txHash);
      setSuccess(true);
      
      console.log('✅ Estado actualizado - success=true, ipId y txHash establecidos');

      // 5. Si hay videoFileId, reenviar al canal privado (ASÍNCRONO - no bloquea la UI)
      // Esto se hace después de mostrar el éxito para que el usuario vea la transacción inmediatamente
      if (videoInfo.fileId) {
        // Hacer el reenvío de forma asíncrona sin esperar
        (async () => {
          try {
            const telegramUser = getTelegramUser();
            const ipIdToSend = storyResponse.data.ipId; // Usar el IP ID que viene del backend
            
            console.log('📤 Enviando video al canal con IP ID:', ipIdToSend, 'para:', title);
            
            if (!ipIdToSend || typeof ipIdToSend !== 'string' || !ipIdToSend.startsWith('0x')) {
              console.error('❌ IP ID inválido recibido del backend:', ipIdToSend);
              throw new Error('IP ID inválido recibido del backend');
            }
            
            const forwardResponse = await axios.post(`${API_URL}/upload/forward-to-channel`, {
              videoFileId: videoInfo.fileId,
              title,
              year: parseInt(year),
              ipId: ipIdToSend, // CRÍTICO: Usar el IP ID correcto del video registrado
              tokenId: storyResponse.data.tokenId || null, // Agregar tokenId (instancia)
              uploaderTelegramId: telegramUser?.id || 0,
              uploaderName: telegramUser ? `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim() : undefined,
            });
            
            if (forwardResponse.data.success && forwardResponse.data.channelMessageId) {
              setChannelMessageId(forwardResponse.data.channelMessageId);
              console.log('✅ Video reenviado al canal privado');
            }
          } catch (forwardError) {
            console.warn('No se pudo reenviar video al canal (el IP fue registrado):', forwardError);
            // No mostrar error al usuario - el IP ya está registrado
          }
        })();
      }
    } catch (error: any) {
      console.error('❌ Error subiendo video:', error);
      console.error('Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack,
      });
      
      let errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      
      // Manejar error de balance insuficiente
      if (error.response?.data?.error === 'INSUFFICIENT_BALANCE') {
        const balance = error.response.data.balance || '0';
        const requiredBalance = error.response.data.requiredBalance || '0.001';
        const faucetUrl = error.response.data.faucetUrl || 'https://cloud.google.com/application/web3/faucet/story/aeneid';
        
        errorMsg = `❌ Balance insuficiente\n\n` +
          `Tu balance actual: ${parseFloat(balance).toFixed(2)} IP\n` +
          `Balance requerido: ${requiredBalance} IP\n\n` +
          `Necesitas obtener fondos del faucet para registrar IPs.\n\n` +
          `¿Deseas abrir el faucet ahora?`;
        
        const openFaucet = window.confirm(errorMsg);
        if (openFaucet) {
          window.open(faucetUrl, '_blank');
        }
      } else {
        // Mostrar error normal
        alert('Error: ' + errorMsg);
      }
      
      // Asegurar que loading se desactive
      setLoading(false);
      setSuccess(false);
    } finally {
      setLoading(false);
      console.log('✅ Proceso de registro finalizado (loading=false)');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Copiado al portapapeles');
    }).catch(() => {
      alert('❌ Error al copiar');
    });
  };

  const getStoryExplorerUrl = (ipId: string, instanceId?: string | null) => {
    // URL del explorador de Story Protocol para Aeneid testnet
    // Si tenemos el instance ID (token ID), incluirlo en la URL
    if (instanceId) {
      return `https://aeneid.storyscan.io/token/${ipId}/instance/${instanceId}`;
    }
    // Fallback a URL sin instance si no está disponible
    return `https://aeneid.storyscan.io/token/${ipId}`;
  };

  const getBlockExplorerUrl = (hash: string) => {
    // URL del explorador de bloques para Aeneid testnet
    return `https://aeneid.storyscan.io/tx/${hash}`;
  };

  if (success) {
    return (
      <div className="upload-success">
        <Navigation title="Registro Exitoso" />
        <h2>✅ Video Registrado</h2>
        <p>Tu contenido ha sido registrado como IP en Story Protocol.</p>
        
        {registeredIpId && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: 'rgba(139, 92, 246, 0.1)', 
            borderRadius: '8px' 
          }}>
            <p style={{ marginBottom: '10px' }}>
              <strong>IP ID:</strong>
            </p>
            <a 
              href={getStoryExplorerUrl(registeredIpId, tokenId)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#A78BFA',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                display: 'block',
                marginBottom: '15px'
              }}
            >
              {registeredIpId}
              {tokenId && <span style={{ fontSize: '0.9em', opacity: 0.8 }}> (Instance: {tokenId})</span>}
            </a>
          </div>
        )}

        {txHash && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: 'rgba(139, 92, 246, 0.1)', 
            borderRadius: '8px' 
          }}>
            <p style={{ marginBottom: '10px' }}>
              <strong>Hash de Transacción:</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <code 
                onClick={() => copyToClipboard(txHash)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  wordBreak: 'break-all',
                  fontSize: '0.9em'
                }}
                title="Haz clic para copiar"
              >
                {txHash}
              </code>
              <button
                onClick={() => copyToClipboard(txHash)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#8B5CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9em'
                }}
              >
                📋 Copiar
              </button>
              <a
                href={getBlockExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#A78BFA',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  display: 'inline-block'
                }}
              >
                🔗 Ver TX
              </a>
            </div>
          </div>
        )}

        {channelMessageId && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: 'rgba(167, 139, 250, 0.1)',
            borderRadius: '8px'
          }}>
            <p style={{ marginBottom: '10px' }}>
              <strong>✅ Video Reenviado al Canal Privado</strong>
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              El video ha sido publicado en el canal privado. Los usuarios que resuelvan el puzzle obtendrán acceso.
            </p>
          </div>
        )}

        {imdbData?.poster && registeredIpId && (
          <div style={{ marginTop: '20px' }}>
            <p>🎮 Crea un puzzle con el póster para gamificar el acceso:</p>
            <a 
              href={`/puzzle?poster=${encodeURIComponent(imdbData.poster)}&ipId=${registeredIpId}&title=${encodeURIComponent(imdbData.title)}&year=${imdbData.year}`}
              className="btn-primary"
              style={{ display: 'inline-block', marginTop: '10px' }}
            >
              🧩 Crear Puzzle
            </a>
          </div>
        )}

        <button 
          onClick={() => window.location.reload()} 
          className="btn-primary" 
          style={{ marginTop: '30px' }}
        >
          Registrar Otro Video
        </button>
      </div>
    );
  }

  return (
    <div className="upload">
      <Navigation title="Subir Video" />
      
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label>Título de la Película/Serie</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: The Matrix"
            required
          />
        </div>

        <div className="form-group">
          <label>Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="1999"
            required
          />
        </div>

        <button type="button" onClick={searchMovie} className="btn-secondary">
          🔍 Buscar en IMDB
        </button>

        {imdbData && (
          <div className="imdb-preview">
            <img src={imdbData.poster} alt={imdbData.title} />
            <div>
              <h3>{imdbData.title} ({imdbData.year})</h3>
              <p>{imdbData.plot}</p>
            </div>
          </div>
        )}

        {videoInfo.fileName && (
          <div className="video-info" style={{ 
            padding: '15px', 
            backgroundColor: 'rgba(139, 92, 246, 0.1)', 
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h4>📹 Información del Video (desde Telegram)</h4>
            <p><strong>Archivo:</strong> {videoInfo.fileName}</p>
            {videoInfo.fileSizeMB && <p><strong>Tamaño:</strong> {videoInfo.fileSizeMB} MB</p>}
            {videoInfo.durationMinutes && <p><strong>Duración:</strong> {videoInfo.durationMinutes} minutos</p>}
            {videoInfo.videoLink && <p><strong>Link:</strong> <a href={videoInfo.videoLink} target="_blank" rel="noopener noreferrer">{videoInfo.videoLink}</a></p>}
          </div>
        )}

        <div className="form-group">
          <label>URL del Video {videoInfo.videoLink ? '(desde Telegram)' : ''}</label>
          <input
            type="url"
            value={videoUrl || videoInfo.videoLink || ''}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder={videoInfo.videoLink || "https://t.me/..."}
            required={!videoInfo.videoLink}
            disabled={!!videoInfo.videoLink}
          />
          {videoInfo.videoLink && (
            <small style={{ color: '#A78BFA', display: 'block', marginTop: '5px' }}>
              ✅ URL obtenida automáticamente desde Telegram
            </small>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Registrando...' : '📤 Registrar IP'}
        </button>
      </form>
    </div>
  );
}

export default Upload;

