import { useState, useEffect } from 'react';
import axios from 'axios';
import './Upload.css';

// Usar proxy de Vite en desarrollo, o URL configurada en producción
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

function Upload() {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [imdbData, setImdbData] = useState<any>(null);
  const [registeredIpId, setRegisteredIpId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
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
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/imdb/movie/${encodeURIComponent(title)}/${year}`);
      if (response.data.success) {
        setImdbData(response.data.data);
        alert('✅ Película encontrada en IMDB');
      } else {
        alert('❌ Película no encontrada: ' + (response.data.error || 'Error desconocido'));
      }
    } catch (error: any) {
      console.error('Error buscando película:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error al buscar película';
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
        // NO pasar licenseTerms - se registrarán después
      });

      // 4. Registrar términos de licencia para el IP registrado (para cobrar regalías)
      // IMPORTANTE: Si no hay currency token configurado, las regalías se establecerán a 0
      // para evitar el error "Royalty policy requires currency token"
      // En producción, necesitarás configurar un wrapped IP token address para regalías
      if (storyResponse.data.ipId) {
        try {
          await axios.post(`${API_URL}/story/register-license`, {
            ipId: storyResponse.data.ipId, // IP ID requerido
            licenseTerms: {
              commercialUse: true,
              // Por ahora, establecer a 0 porque no hay currency token configurado
              // Cuando tengas wrapped IP token, puedes establecer a 10
              commercialRevShare: 0, // 0% hasta configurar currency token (wrapped IP)
              commercialAttribution: true,
              derivativesAllowed: true,
              derivativesAttribution: true,
              mintingFee: '0', // Sin fee inicial para facilitar acceso
              // TODO: Configurar wrapped IP token address aquí para habilitar regalías
              // currency: '0x...', // Address del wrapped IP token en Aeneid testnet
            },
          });
          console.log('✅ Licencia registrada exitosamente');
        } catch (licenseError) {
          console.warn('No se pudo registrar licencia, pero el IP fue registrado:', licenseError);
        }
      }

      setRegisteredIpId(storyResponse.data.ipId);
      setTxHash(storyResponse.data.txHash);
      setSuccess(true);
      console.log('IP registrado:', storyResponse.data);
    } catch (error: any) {
      console.error('Error subiendo video:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      alert('Error: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Copiado al portapapeles');
    }).catch(() => {
      alert('❌ Error al copiar');
    });
  };

  const getStoryExplorerUrl = (ipId: string) => {
    // URL del explorador de Story Protocol para Aeneid testnet
    return `https://aeneid.storyscan.io/token/${ipId}`;
  };

  const getBlockExplorerUrl = (hash: string) => {
    // URL del explorador de bloques para Aeneid testnet
    return `https://aeneid.storyscan.io/tx/${hash}`;
  };

  if (success) {
    return (
      <div className="upload-success">
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
              href={getStoryExplorerUrl(registeredIpId)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code 
                onClick={() => copyToClipboard(txHash)}
                style={{
                  flex: 1,
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
                  fontSize: '0.9em'
                }}
              >
                🔗 Ver TX
              </a>
            </div>
          </div>
        )}

        {imdbData?.poster && (
          <div style={{ marginTop: '20px' }}>
            <p>🎮 Crea un puzzle con el póster para gamificar el acceso:</p>
            <a 
              href={`/puzzle?poster=${encodeURIComponent(imdbData.poster)}&ipId=${registeredIpId || ''}&title=${encodeURIComponent(imdbData.title)}&year=${imdbData.year}`}
              className="btn-primary"
              style={{ display: 'inline-block', marginTop: '10px' }}
            >
              🧩 Crear Puzzle
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="upload">
      <h2>📤 Subir Video</h2>
      
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

