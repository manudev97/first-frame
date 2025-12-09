// Servicio para rastrear puzzles completados por usuario
import fs from 'fs/promises';
import path from 'path';

export interface PuzzleCompletion {
  id: string;
  telegramUserId: number;
  ipId: string;
  puzzleId: string;
  completedAt: string;
  timeSeconds: number;
}

const PUZZLES_FILE = path.join(process.cwd(), 'data', 'puzzle-completions.json');

// Asegurar que el directorio existe
async function ensureDataDir() {
  const dataDir = path.dirname(PUZZLES_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Cargar completaciones de puzzles
export async function loadPuzzleCompletions(): Promise<PuzzleCompletion[]> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(PUZZLES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error cargando completaciones de puzzles:', error);
    return [];
  }
}

// Guardar completaciones
async function savePuzzleCompletions(completions: PuzzleCompletion[]): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(PUZZLES_FILE, JSON.stringify(completions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error guardando completaciones de puzzles:', error);
    throw error;
  }
}

/**
 * Registrar una completación de puzzle
 */
export async function recordPuzzleCompletion(
  telegramUserId: number,
  ipId: string,
  puzzleId: string,
  timeSeconds: number
): Promise<PuzzleCompletion> {
  const completions = await loadPuzzleCompletions();
  
  const completion: PuzzleCompletion = {
    id: `${telegramUserId}_${ipId}_${Date.now()}`,
    telegramUserId,
    ipId,
    puzzleId,
    completedAt: new Date().toISOString(),
    timeSeconds,
  };
  
  completions.push(completion);
  await savePuzzleCompletions(completions);
  
  console.log(`✅ Puzzle completado registrado: ${completion.id} para usuario ${telegramUserId}`);
  return completion;
}

/**
 * Obtener número de puzzles completados por un usuario
 */
export async function getPuzzleCompletionsCount(telegramUserId: number): Promise<number> {
  const completions = await loadPuzzleCompletions();
  return completions.filter((c) => c.telegramUserId === telegramUserId).length;
}

/**
 * Obtener todas las completaciones de un usuario
 */
export async function getPuzzleCompletionsByUser(telegramUserId: number): Promise<PuzzleCompletion[]> {
  const completions = await loadPuzzleCompletions();
  return completions.filter((c) => c.telegramUserId === telegramUserId);
}


