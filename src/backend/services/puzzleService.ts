import axios from 'axios';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

interface PuzzlePiece {
  id: number;
  position: { x: number; y: number };
  currentPosition: { x: number; y: number };
  imageData: string;
}

interface Puzzle {
  id: string;
  pieces: PuzzlePiece[];
  solution: number[];
  difficulty: number;
}

const puzzles: Map<string, Puzzle> = new Map();

export async function createPuzzle(imageUrl: string, difficulty: number = 3): Promise<Puzzle> {
  try {
    // Validar URL
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      throw new Error('URL de imagen inválida');
    }
    
    // Descargar imagen con timeout y manejo de errores mejorado
    // Intentar múltiples veces si falla (problemas de red comunes)
    let imageResponse;
    let retries = 3;
    let lastError: any;
    
    while (retries > 0) {
      try {
        imageResponse = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 15000, // 15 segundos timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*',
          },
          maxRedirects: 5,
        });
        
        if (imageResponse.data && imageResponse.data.length > 0) {
          break; // Éxito
        }
      } catch (error: any) {
        lastError = error;
        retries--;
        if (retries > 0) {
          console.warn(`Intento fallido al descargar imagen. Reintentando... (${retries} intentos restantes)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo antes de reintentar
        }
      }
    }
    
    if (!imageResponse || !imageResponse.data) {
      throw new Error(`No se pudo descargar la imagen después de 3 intentos. ${lastError?.message || 'Error desconocido'}`);
    }
    
    const imageBuffer = Buffer.from(imageResponse.data);

    // Procesar imagen con sharp
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 400;
    const height = metadata.height || 600;

    // Dividir en piezas
    const pieces: PuzzlePiece[] = [];
    const pieceWidth = Math.floor(width / difficulty);
    const pieceHeight = Math.floor(height / difficulty);
    const totalPieces = difficulty * difficulty;

    for (let i = 0; i < totalPieces; i++) {
      const row = Math.floor(i / difficulty);
      const col = i % difficulty;
      const x = col * pieceWidth;
      const y = row * pieceHeight;

      // Extraer pieza
      const pieceBuffer = await sharp(imageBuffer)
        .extract({
          left: x,
          top: y,
          width: pieceWidth,
          height: pieceHeight,
        })
        .toBuffer();

      // Convertir a base64 para el frontend
      const imageData = `data:image/png;base64,${pieceBuffer.toString('base64')}`;

      pieces.push({
        id: i,
        position: { x, y },
        currentPosition: { x: Math.random() * (width - pieceWidth), y: Math.random() * (height - pieceHeight) },
        imageData,
      });
    }

    // Mezclar piezas (excepto la primera)
    const shuffled = [...pieces];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const puzzle: Puzzle = {
      id: randomUUID(),
      pieces: shuffled,
      solution: pieces.map((p) => p.id),
      difficulty,
    };

    puzzles.set(puzzle.id, puzzle);

    return puzzle;
  } catch (error) {
    console.error('Error creando puzzle:', error);
    throw new Error('No se pudo crear el puzzle');
  }
}

export async function validatePuzzleSolution(puzzleId: string, solution: number[]): Promise<boolean> {
  const puzzle = puzzles.get(puzzleId);
  if (!puzzle) {
    return false;
  }

  // Verificar que la solución coincida
  return JSON.stringify(solution) === JSON.stringify(puzzle.solution);
}

export function getPuzzle(puzzleId: string): Puzzle | undefined {
  return puzzles.get(puzzleId);
}

