// Servicio para gestionar regalías pendientes
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface PendingRoyalty {
  id: string;
  telegramUserId: number;
  ipId: string;
  tokenId?: string;
  videoTitle: string;
  amount: string; // Monto en IP (ej: "0.1")
  uploaderTelegramId: number;
  uploaderName?: string;
  channelMessageId?: number; // ID del mensaje en el canal para reenviar
  videoFileId?: string; // File ID del video para reenviar directamente
  createdAt: string;
  expiresAt: string; // Fecha de expiración (ej: 24 horas después de resolver el puzzle)
  paid: boolean;
  paidAt?: string;
  paymentId?: string; // ID del pago de Halliday
  claimed?: boolean; // Si la regalía fue reclamada por el uploader
  claimedAt?: string; // Fecha de reclamación
}

const ROYALTIES_FILE = path.join(process.cwd(), 'data', 'pending-royalties.json');

// Asegurar que el directorio existe
async function ensureDataDir() {
  const dataDir = path.dirname(ROYALTIES_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Cargar regalías pendientes
export async function loadPendingRoyalties(): Promise<PendingRoyalty[]> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(ROYALTIES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error cargando regalías pendientes:', error);
    return [];
  }
}

// Guardar regalías pendientes
export async function savePendingRoyalties(royalties: PendingRoyalty[]): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(ROYALTIES_FILE, JSON.stringify(royalties, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error guardando regalías pendientes:', error);
    throw error;
  }
}

/**
 * Crear una nueva regalía pendiente
 */
export async function createPendingRoyalty(
  telegramUserId: number,
  ipId: string,
  videoTitle: string,
  amount: string,
  uploaderTelegramId: number,
  uploaderName?: string,
  tokenId?: string,
  channelMessageId?: number,
  videoFileId?: string
): Promise<PendingRoyalty> {
  const royalties = await loadPendingRoyalties();
  
  // CRÍTICO: Verificar si ya existe una regalía pendiente para este usuario e IP
  const existingRoyalty = royalties.find(
    (r) => r.telegramUserId === telegramUserId && 
           r.ipId.toLowerCase() === ipId.toLowerCase() && 
           !r.paid
  );
  
  if (existingRoyalty) {
    console.warn(`⚠️  Regalía pendiente ya existe para usuario ${telegramUserId} e IP ${ipId}. Retornando existente.`);
    console.warn(`   - Regalía ID: ${existingRoyalty.id}`);
    console.warn(`   - Creada: ${existingRoyalty.createdAt}`);
    // Actualizar videoFileId y channelMessageId si no estaban guardados
    if (!existingRoyalty.videoFileId && videoFileId) {
      existingRoyalty.videoFileId = videoFileId;
      await savePendingRoyalties(royalties);
      console.log(`✅ VideoFileId actualizado en regalía existente`);
    }
    if (!existingRoyalty.channelMessageId && channelMessageId) {
      existingRoyalty.channelMessageId = channelMessageId;
      await savePendingRoyalties(royalties);
      console.log(`✅ ChannelMessageId actualizado en regalía existente`);
    }
    return existingRoyalty;
  }
  
  const royalty: PendingRoyalty = {
    id: crypto.randomUUID(),
    telegramUserId,
    ipId,
    tokenId,
    videoTitle,
    amount,
    uploaderTelegramId,
    uploaderName,
    channelMessageId,
    videoFileId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
    paid: false,
  };
  
  royalties.push(royalty);
  await savePendingRoyalties(royalties);
  
  console.log(`✅ Regalía pendiente creada: ${royalty.id} para usuario ${telegramUserId}`);
  return royalty;
}

/**
 * Obtener regalías pendientes de un usuario
 */
export async function getPendingRoyaltiesByUser(telegramUserId: number): Promise<PendingRoyalty[]> {
  const royalties = await loadPendingRoyalties();
  return royalties.filter(
    (r) => r.telegramUserId === telegramUserId && !r.paid
  );
}

/**
 * Obtener regalías pendientes no pagadas (para verificar expiración)
 */
export async function getUnpaidRoyalties(): Promise<PendingRoyalty[]> {
  const royalties = await loadPendingRoyalties();
  return royalties.filter((r) => !r.paid);
}

/**
 * Marcar una regalía como pagada
 */
export async function markRoyaltyAsPaid(
  royaltyId: string,
  paymentId?: string
): Promise<boolean> {
  const royalties = await loadPendingRoyalties();
  const royalty = royalties.find((r) => r.id === royaltyId);
  
  if (!royalty) {
    return false;
  }
  
  royalty.paid = true;
  royalty.paidAt = new Date().toISOString();
  if (paymentId) {
    royalty.paymentId = paymentId;
  }
  
  await savePendingRoyalties(royalties);
  console.log(`✅ Regalía ${royaltyId} marcada como pagada`);
  return true;
}

/**
 * Verificar si un usuario tiene regalías pendientes
 */
export async function hasPendingRoyalties(telegramUserId: number): Promise<boolean> {
  const pending = await getPendingRoyaltiesByUser(telegramUserId);
  return pending.length > 0;
}

/**
 * Obtener el número de regalías pendientes de un usuario
 */
export async function getPendingRoyaltiesCount(telegramUserId: number): Promise<number> {
  const pending = await getPendingRoyaltiesByUser(telegramUserId);
  return pending.length;
}

