import { useState, useEffect } from 'react';
import axios from 'axios';
import './Puzzle.css';

// Usar proxy de Vite en desarrollo, o URL configurada en producción
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

  useEffect(() => {
    // Obtener puzzle desde el backend
    loadPuzzle();
    
    // Timer
    const interval = setInterval(() => {
      if (!solved) {
        setTime((t) => t + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [solved]);

  const loadPuzzle = async () => {
    try {
      // Obtener el poster desde la URL o parámetros
      const urlParams = new URLSearchParams(window.location.search);
      const posterUrl = urlParams.get('poster');
      const ipId = urlParams.get('ipId');
      
      if (!posterUrl) {
        // Si no hay poster, obtener uno de ejemplo o mostrar error
        alert('❌ No se proporcionó URL del póster. Debes acceder al puzzle desde un IP registrado.');
        return;
      }
      
      const response = await axios.post(`${API_URL}/puzzle/create`, {
        imageUrl: posterUrl,
        difficulty: 3,
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
        const message = `🎉 ¡Puzzle completado en ${formatTime(time)}!\n\n` +
          `✅ Acceso otorgado al canal privado\n` +
          (response.data.derivativeIpId ? `📸 Póster registrado como IP derivado: ${response.data.derivativeIpId}\n` : '') +
          (response.data.channelLink ? `🔗 Canal: ${response.data.channelLink}` : '');
        alert(message);
      } else {
        alert('❌ Solución incorrecta. Intenta de nuevo.');
      }
    } catch (error: any) {
      console.error('Error validando solución:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error al validar solución';
      alert('Error: ' + errorMsg);
    }
  };

  // Esta función ya no es necesaria - el backend maneja el registro del derivado

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!puzzle) {
    return <div className="puzzle-loading">Cargando puzzle...</div>;
  }

  return (
    <div className="puzzle">
      <div className="puzzle-header">
        <h2>🧩 Rompecabezas</h2>
        <div className="timer">⏱️ {formatTime(time)}</div>
      </div>

      {solved ? (
        <div className="puzzle-solved">
          <h3>🎉 ¡Felicidades!</h3>
          <p>Has completado el puzzle en {formatTime(time)}</p>
          <p>Tu acceso al canal privado ha sido otorgado.</p>
          <p>El póster ha sido registrado como IP en Story Protocol.</p>
        </div>
      ) : (
        <div className="puzzle-board">
          <div className="puzzle-grid">
            {pieces.map((piece) => (
              <div
                key={piece.id}
                className={`puzzle-piece ${selectedPiece === piece.id ? 'selected' : ''}`}
                onClick={() => handlePieceClick(piece.id)}
                style={{
                  backgroundImage: `url(${piece.imageData})`,
                  backgroundSize: '300% 300%',
                  backgroundPosition: `${-(piece.id % 3) * 33.33}% ${-Math.floor(piece.id / 3) * 33.33}%`,
                }}
              />
            ))}
          </div>
          <p className="puzzle-hint">Haz clic en dos piezas para intercambiarlas</p>
        </div>
      )}
    </div>
  );
}

export default Puzzle;

