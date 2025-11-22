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

// Función para obtener imagen de mayor calidad de IMDB
async function getHighQualityImage(originalUrl: string): Promise<string> {
  try {
    // Si la URL ya es de alta calidad o no es de IMDB, devolver tal cual
    if (!originalUrl.includes('media-imdb.com') && !originalUrl.includes('media-amazon.com')) {
      return originalUrl;
    }

    // Mejorar URL de IMDB para máxima calidad
    let improvedUrl = originalUrl
      .replace('http://', 'https://')
      .replace(/_V1_SX(\d+)\./g, '_V1_SX1000.') // Reemplazar cualquier tamaño por 1000px
      .replace(/_V1_UX(\d+)\./g, '_V1_SX1000.')
      .replace(/_V1_UY(\d+)\./g, '_V1_SX1000.')
      .replace(/\._V1_/g, '._V1_SX1000.'); // Si no tiene tamaño, agregar SX1000

    // Verificar que la URL mejorada funcione
    try {
      const testResponse = await axios.head(improvedUrl, { timeout: 5000 });
      if (testResponse.status === 200) {
        return improvedUrl;
      }
    } catch {
      // Si falla, usar la original
      console.warn('URL mejorada no disponible, usando original');
    }

    return originalUrl;
  } catch (error) {
    console.warn('Error mejorando calidad de imagen:', error);
    return originalUrl;
  }
}

export async function createPuzzle(imageUrl: string, difficulty: number = 2): Promise<Puzzle> {
  try {
    // Validar URL
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      throw new Error('URL de imagen inválida');
    }
    
    // Obtener URL de mayor calidad
    const highQualityUrl = await getHighQualityImage(imageUrl);
    console.log(`📸 Usando imagen de alta calidad: ${highQualityUrl}`);
    
    // Descargar imagen con timeout y manejo de errores mejorado
    // Intentar múltiples veces si falla (problemas de red comunes)
    let imageResponse;
    let retries = 3;
    let lastError: any;
    
    while (retries > 0) {
      try {
        imageResponse = await axios.get(highQualityUrl, { 
          responseType: 'arraybuffer',
          timeout: 15000, // 15 segundos timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.imdb.com/',
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

    // Procesar imagen con sharp - redimensionar a tamaño óptimo para el puzzle
    // Asegurar que la imagen tenga un tamaño razonable pero mantenga calidad
    const processedImage = await sharp(imageBuffer)
      .resize(800, 1200, { // Tamaño óptimo: 800x1200 mantiene calidad y es manejable
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();
    
    const metadata = await sharp(processedImage).metadata();
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

      // Extraer pieza de la imagen procesada
      const pieceBuffer = await sharp(processedImage)
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

    // Mezclar piezas de forma inteligente (mantener algunas juntas para hacer más fácil)
    // Para dificultad 2 (4 piezas), mezclar menos para que sea más fácil
    const shuffled = [...pieces];
    
    if (difficulty <= 2) {
      // Para 2x2, solo intercambiar algunas piezas para que sea más fácil
      const swapCount = Math.floor(totalPieces / 2);
      for (let i = 0; i < swapCount; i++) {
        const idx1 = Math.floor(Math.random() * totalPieces);
        const idx2 = Math.floor(Math.random() * totalPieces);
        if (idx1 !== idx2) {
          [shuffled[idx1], shuffled[idx2]] = [shuffled[idx2], shuffled[idx1]];
        }
      }
    } else {
      // Para dificultad mayor, mezclar completamente
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
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

