import { useState, useEffect } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { getTelegramUser } from '../utils/telegram';
import { useDynamicWallet } from '../hooks/useDynamicWallet';
import './Puzzle.css';

// CRÍTICO: En producción, VITE_API_URL DEBE estar configurado en Vercel
// En desarrollo, usa el proxy de Vite (/api)
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

interface PuzzlePiece {
  id: number;
  position: { x: number; y: number };
  currentPosition: { x: number; y: number };
  imageData: string;
}

function Puzzle() {
  const [puzzle, setPuzzle] = useState<any>(null);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [time, setTime] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false); // CRÍTICO: Estado para pausar el timer
  const [showPreview, setShowPreview] = useState(true); // Mostrar vista previa por defecto
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [derivativeIpId, setDerivativeIpId] = useState<string | null>(null);
  const [derivativeTokenId, setDerivativeTokenId] = useState<string | null>(null); // CRÍTICO: Token ID del derivado
  const [derivativeTxHash, setDerivativeTxHash] = useState<string | null>(null);
  
  // CRÍTICO: Obtener address de Dynamic del usuario
  const dynamicWallet = useDynamicWallet();

  useEffect(() => {
    loadPuzzle();
  }, []);

  // Timer que solo inicia cuando el puzzle está cargado Y las piezas están listas
  useEffect(() => {
    if (!puzzle || !pieces.length || solved) {
      // Si el puzzle está resuelto, detener el timer
      if (solved) {
        return;
      }
      return;
    }
    
    // Iniciar timer solo cuando el puzzle está completamente listo
    if (!timerStarted) {
      setTimerStarted(true);
      setTime(0); // Reiniciar a 0 cuando inicia
    }
    
    const interval = setInterval(() => {
      setTime((t) => {
        // No incrementar si el puzzle está resuelto o el timer está pausado
        if (solved || timerPaused) {
          return t;
        }
        return t + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [puzzle, pieces, solved, timerStarted, timerPaused]);

  const loadPuzzle = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const posterUrl = urlParams.get('poster');
      const ipId = urlParams.get('ipId');
      
      if (!posterUrl) {
        alert('❌ No se proporcionó URL del póster. Debes acceder al puzzle desde un IP registrado.');
        return;
      }

      // Guardar URL original para vista previa
      setOriginalImageUrl(posterUrl);
      
      const response = await axios.post(`${API_URL}/puzzle/create`, {
        imageUrl: posterUrl,
        difficulty: 2, // 2x2 = 4 piezas (más fácil)
        ipId: ipId,
      });
      
      if (response.data.success) {
        setPuzzle(response.data);
        setPieces(response.data.pieces);
      } else {
        alert('Error creando puzzle: ' + (response.data.error || 'Error desconocido'));
      }
    } catch (error: any) {
      console.error('Error cargando puzzle:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error al cargar puzzle';
      alert('Error: ' + errorMsg + '\n\n💡 Asegúrate de que la URL del póster de IMDB sea válida y accesible.');
    }
  };

  const handlePieceClick = (pieceId: number) => {
    if (selectedPiece === null) {
      setSelectedPiece(pieceId);
    } else if (selectedPiece === pieceId) {
      // Deseleccionar si se hace clic en la misma pieza
      setSelectedPiece(null);
    } else {
      // Intercambiar piezas
      const newPieces = [...pieces];
      const piece1Index = newPieces.findIndex((p) => p.id === selectedPiece);
      const piece2Index = newPieces.findIndex((p) => p.id === pieceId);
      
      [newPieces[piece1Index], newPieces[piece2Index]] = [
        newPieces[piece2Index],
        newPieces[piece1Index],
      ];
      
      setPieces(newPieces);
      setSelectedPiece(null);
      
      // Verificar si está resuelto
      checkSolution(newPieces);
    }
  };

  const checkSolution = async (currentPieces: PuzzlePiece[]) => {
    if (!puzzle || !puzzle.puzzleId) {
      console.error('Puzzle no está cargado');
      return;
    }
    
    const solution = currentPieces.map((p) => p.id);
    const urlParams = new URLSearchParams(window.location.search);
    const ipId = urlParams.get('ipId');
    const posterUrl = urlParams.get('poster');
    const title = urlParams.get('title');
    const tokenId = urlParams.get('tokenId'); // CRÍTICO: Obtener tokenId de los parámetros
    
    // Obtener telegramUserId
    const telegramUser = getTelegramUser();
    const telegramUserId = telegramUser?.id;
    
    // IMPORTANTE: Capturar el tiempo actual antes de enviar la validación
    // Esto asegura que el tiempo se capture correctamente incluso si el timer se detiene
    const currentTime = time;
    console.log(`⏱️  Tiempo del puzzle capturado: ${currentTime} segundos`);
    
    // CRÍTICO: Obtener address de Dynamic del usuario que resolvió el puzzle
    // Esto es necesario para enviar el token derivado a la wallet correcta
    const userDynamicAddress = dynamicWallet.address;
    console.log(`🔍 Address de Dynamic del usuario: ${userDynamicAddress || 'No disponible'}`);
    console.log(`🔍 Parámetros del puzzle:`, { ipId, tokenId, title, posterUrl });
    
    try {
      const response = await axios.post(`${API_URL}/puzzle/validate`, {
        puzzleId: puzzle.puzzleId,
        solution,
        ipId: ipId,
        tokenId: tokenId, // CRÍTICO: Enviar tokenId para identificar el IP correcto
        title: title, // CRÍTICO: Enviar título para búsqueda alternativa
        posterUrl: posterUrl,
        telegramUserId: telegramUserId, // Enviar telegramUserId al backend
        puzzleTimeSeconds: currentTime, // Enviar tiempo actual del puzzle
        userDynamicAddress: userDynamicAddress, // CRÍTICO: Enviar address de Dynamic si está disponible
      });
      
      // Verificar si hay regalías pendientes
      if (response.data.hasPendingRoyalties) {
        alert(
          `⚠️ Tienes ${response.data.pendingCount} regalía${response.data.pendingCount > 1 ? 's' : ''} pendiente${response.data.pendingCount > 1 ? 's' : ''}.\n\n` +
          `Debes pagar tus regalías antes de resolver más puzzles.\n\n` +
          `💳 Usa el comando /profile en el bot para pagar tus regalías pendientes.`
        );
        return;
      }
      
      // IMPORTANTE: Solo mostrar notificación si el puzzle está realmente resuelto
      if (response.data.success && response.data.accessGranted) {
        setSolved(true);
        setShowPreview(false);
        
        // Guardar datos del IP derivado y canal para mostrar en la UI
        const derivativeIpIdValue = response.data.derivativeIpId;
        const derivativeTokenIdValue = response.data.derivativeTokenId; // CRÍTICO: Token ID del derivado
        const derivativeContractAddress = response.data.derivativeContractAddress; // CRÍTICO: Contract address
        const derivativeTxHashValue = response.data.derivativeTxHash;
        
        setDerivativeIpId(derivativeIpIdValue);
        setDerivativeTokenId(derivativeTokenIdValue); // CRÍTICO: Guardar token ID
        setDerivativeTxHash(derivativeTxHashValue);
        
        // CRÍTICO: Guardar contract address para construir URL correcta
        if (derivativeContractAddress) {
          // Almacenar en estado local para usar en el link
          (window as any).derivativeContractAddress = derivativeContractAddress;
        }
        
        // NUEVA LÓGICA: Mostrar mensaje sobre video reenviado y regalía creada
        let successMessage = `🎉 ¡Puzzle completado en ${formatTime(time)}!\n\n`;
        
        if (response.data.videoForwarded) {
          successMessage += `✅ Video reenviado a tu chat privado\n`;
        }
        
        if (response.data.royaltyCreated) {
          successMessage += `💰 Regalía pendiente creada (0.1 IP)\n`;
          successMessage += `💳 Usa el comando /profile en el bot para pagar tus regalías\n\n`;
        }
        
        if (derivativeIpIdValue) {
          successMessage += `📸 Póster registrado como IP derivado\n`;
        }
        
        successMessage += `\n⚠️ IMPORTANTE: Si tienes regalías pendientes, no podrás resolver más puzzles hasta pagarlas.`;
        
        alert(successMessage);
      } else {
        // Feedback visual sin alert intrusivo - NO mostrar notificación si no está resuelto
        console.log('Solución incorrecta, continuar intentando...');
        // NO mostrar ninguna notificación si el puzzle no está resuelto
      }
    } catch (error: any) {
      console.error('Error validando solución:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!puzzle) {
    return (
      <div className="puzzle">
        <Navigation title="Rompecabezas" />
        <div className="puzzle-loading">
          <div className="loading-spinner"></div>
          <p>Cargando puzzle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="puzzle">
      <Navigation title="Rompecabezas" />
      
      <div className="puzzle-container">
        {/* Vista previa de la imagen original */}
        {showPreview && originalImageUrl && !solved && (
          <div className="puzzle-preview">
            <button 
              className="preview-toggle"
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? "Ocultar vista previa" : "Mostrar vista previa"}
            >
              {showPreview ? "👁️ Ocultar" : "👁️ Ver"} Vista Previa
            </button>
            <div className="preview-image-container">
              <img 
                src={originalImageUrl} 
                alt="Vista previa del póster" 
                className="preview-image"
              />
              <div className="preview-overlay">
                <p>📸 Vista Previa</p>
                <p className="preview-hint">Usa esta imagen como referencia</p>
              </div>
            </div>
          </div>
        )}

        {!showPreview && !solved && (
          <button 
            className="preview-toggle-show"
            onClick={() => setShowPreview(true)}
          >
            👁️ Mostrar Vista Previa
          </button>
        )}

        {/* Timer y info */}
        <div className="puzzle-header">
          <div className="timer">
            ⏱️ {formatTime(time)}
            {timerPaused && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#ffa500' }}>⏸️ Pausado</span>}
          </div>
          {!solved && (
            <button
              className="btn-complete"
              onClick={() => {
                setTimerPaused(true);
                // Verificar solución cuando se marca como completado
                checkSolution(pieces);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: timerPaused ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                marginLeft: '10px',
              }}
            >
              {timerPaused ? '✅ Completado' : '✓ Marcar como Completado'}
            </button>
          )}
          <div className="puzzle-info">
            {selectedPiece !== null && (
              <span className="selection-hint">Pieza {selectedPiece + 1} seleccionada - Haz clic en otra para intercambiar</span>
            )}
            {selectedPiece === null && (
              <span className="selection-hint">Haz clic en una pieza para seleccionarla</span>
            )}
          </div>
        </div>

        {solved ? (
          <div className="puzzle-solved">
            <div className="solved-animation">🎉</div>
            <h3>¡Felicidades!</h3>
            <p className="solved-time">Completado en {formatTime(time)}</p>
            <p className="solved-message">Tu acceso al canal privado ha sido otorgado</p>
            {derivativeIpId && (
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                borderRadius: '8px' 
              }}>
                <p className="solved-message" style={{ marginBottom: '10px' }}>
                  📸 Póster registrado como IP derivado
                </p>
                {derivativeTokenId && (
                  <a 
                    href={(() => {
                      // CRÍTICO: Construir URL correcta usando contract address + tokenId
                      // Formato: https://aeneid.storyscan.io/token/{contractAddress}/instance/{tokenId}
                      const contractAddress = (window as any).derivativeContractAddress || '0x407bfbB5C3bf61F1F6B5d2243b2D75d85C908815';
                      return `https://aeneid.storyscan.io/token/${contractAddress}/instance/${derivativeTokenId}`;
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#A78BFA',
                      textDecoration: 'underline',
                      wordBreak: 'break-all',
                      display: 'block',
                      marginBottom: '10px',
                      fontSize: '0.9rem'
                    }}
                  >
                    Ver IP en Explorer: Token #{derivativeTokenId}
                  </a>
                )}
                {derivativeTxHash && (
                  <a 
                    href={`https://aeneid.storyscan.io/tx/${derivativeTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#A78BFA',
                      textDecoration: 'underline',
                      wordBreak: 'break-all',
                      display: 'block',
                      fontSize: '0.85rem'
                    }}
                  >
                    Ver Transacción: {derivativeTxHash.substring(0, 20)}...
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="puzzle-board">
            <div className="puzzle-grid">
              {pieces.map((piece, index) => {
                // Cada pieza tiene su propia imageData (imagen completa de esa pieza)
                // No necesitamos backgroundPosition porque cada pieza es una imagen individual
                return (
                  <div
                    key={piece.id}
                    className={`puzzle-piece ${selectedPiece === piece.id ? 'selected' : ''} ${selectedPiece !== null && selectedPiece !== piece.id ? 'hoverable' : ''}`}
                    onClick={() => handlePieceClick(piece.id)}
                    style={{
                      backgroundImage: `url(${piece.imageData})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                  >
                    {selectedPiece === piece.id && (
                      <div className="piece-selected-indicator">✓</div>
                    )}
                    <div className="piece-number">{piece.id + 1}</div>
                  </div>
                );
              })}
            </div>
            <p className="puzzle-hint">
              💡 <strong>Tip:</strong> Haz clic en dos piezas para intercambiarlas. Usa la vista previa como referencia.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Puzzle;
