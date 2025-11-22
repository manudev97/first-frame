import { useState, useEffect } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import './Puzzle.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3001/api');

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
  const [showPreview, setShowPreview] = useState(true); // Mostrar vista previa por defecto
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadPuzzle();
    
    const interval = setInterval(() => {
      if (!solved) {
        setTime((t) => t + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [solved]);

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
    
    try {
      const response = await axios.post(`${API_URL}/puzzle/validate`, {
        puzzleId: puzzle.puzzleId,
        solution,
        ipId: ipId,
        posterUrl: posterUrl,
      });
      
      if (response.data.success && response.data.accessGranted) {
        setSolved(true);
        setShowPreview(false);
        
        // Mostrar mensaje de éxito más atractivo con link al canal
        let successMessage = `🎉 ¡Puzzle completado en ${formatTime(time)}!\n\n`;
        successMessage += `✅ Acceso otorgado al canal privado\n`;
        if (response.data.derivativeIpId) {
          successMessage += `📸 Póster registrado como IP derivado\n`;
        }
        if (response.data.channelLink) {
          successMessage += `\n🔗 Accede al canal: ${response.data.channelLink}`;
          // También mostrar botón para abrir el canal
          const openChannel = window.confirm(successMessage + '\n\n¿Deseas abrir el canal ahora?');
          if (openChannel) {
            window.open(response.data.channelLink, '_blank');
          }
        } else {
          alert(successMessage);
        }
      } else {
        // Feedback visual sin alert intrusivo
        console.log('Solución incorrecta, continuar intentando...');
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
          <div className="timer">⏱️ {formatTime(time)}</div>
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
            <p className="solved-message">El póster ha sido registrado como IP en Story Protocol</p>
          </div>
        ) : (
          <div className="puzzle-board">
            <div className="puzzle-grid">
              {pieces.map((piece) => (
                <div
                  key={piece.id}
                  className={`puzzle-piece ${selectedPiece === piece.id ? 'selected' : ''} ${selectedPiece !== null && selectedPiece !== piece.id ? 'hoverable' : ''}`}
                  onClick={() => handlePieceClick(piece.id)}
                  style={{
                    backgroundImage: `url(${piece.imageData})`,
                    backgroundSize: '200% 200%', // 2x2 = 200%
                    backgroundPosition: `${-(piece.id % 2) * 50}% ${-Math.floor(piece.id / 2) * 50}%`,
                  }}
                >
                  {selectedPiece === piece.id && (
                    <div className="piece-selected-indicator">✓</div>
                  )}
                  <div className="piece-number">{piece.id + 1}</div>
                </div>
              ))}
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
