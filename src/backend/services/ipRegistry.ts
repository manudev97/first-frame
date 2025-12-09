// Servicio simple para registrar IPs (en producción, usar una base de datos)
import fs from 'fs/promises';
import path from 'path';

export interface RegisteredIP {
  ipId: string;
  tokenId?: string; // Token ID (instance number) para construir la URL del explorador
  title: string;
  year?: number;
  posterUrl?: string;
  description?: string;
  imdbId?: string;
  metadataUri: string;
  nftMetadataUri: string;
  txHash: string;
  createdAt: string;
  uploader?: string;
  uploaderName?: string; // Nombre del usuario que subió el video
  channelMessageId?: number; // ID del mensaje en el canal privado
  videoFileId?: string; // File ID del video para reenviar directamente
}

const REGISTRY_FILE = path.join(process.cwd(), 'data', 'ip-registry.json');

// Asegurar que el directorio existe
async function ensureDataDir() {
  const dataDir = path.dirname(REGISTRY_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Cargar IPs registrados
export async function loadRegisteredIPs(): Promise<RegisteredIP[]> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(REGISTRY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error cargando IPs registrados:', error);
    return [];
  }
}

// Guardar IP registrado
export async function saveRegisteredIP(ip: RegisteredIP): Promise<void> {
  try {
    await ensureDataDir();
    const ips = await loadRegisteredIPs();
    
    // Evitar duplicados por IP ID
    const existingIndex = ips.findIndex((existing) => existing.ipId.toLowerCase() === ip.ipId.toLowerCase());
    if (existingIndex !== -1) {
      console.warn(`⚠️  IP ${ip.ipId} ya está registrado, actualizando...`);
      // Actualizar el IP existente con nueva información
      ips[existingIndex] = { ...ips[existingIndex], ...ip };
    } else {
      // Agregar nuevo IP
      ips.push(ip);
    }
    
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(ips, null, 2), 'utf-8');
    console.log(`✅ IP guardado en marketplace: ${ip.ipId} - ${ip.title} (uploader: ${ip.uploader || 'N/A'})`);
  } catch (error) {
    console.error('❌ Error guardando IP registrado:', error);
    // No lanzar error - el registro puede continuar aunque falle el guardado
    throw error; // Pero lanzar para que el backend sepa que falló
  }
}

// Buscar IPs por query
export async function searchIPs(query: string): Promise<RegisteredIP[]> {
  const ips = await loadRegisteredIPs();
  const lowerQuery = query.toLowerCase();
  
  return ips.filter((ip) => {
    const titleMatch = ip.title.toLowerCase().includes(lowerQuery);
    const yearMatch = ip.year?.toString().includes(lowerQuery);
    const descMatch = ip.description?.toLowerCase().includes(lowerQuery);
    
    return titleMatch || yearMatch || descMatch;
  });
}

// Obtener IP por ID
export async function getIPById(ipId: string): Promise<RegisteredIP | null> {
  const ips = await loadRegisteredIPs();
  return ips.find((ip) => ip.ipId.toLowerCase() === ipId.toLowerCase()) || null;
}

// Obtener IPs registrados por un usuario específico
export async function getIPsByUploader(uploader: string): Promise<RegisteredIP[]> {
  const ips = await loadRegisteredIPs();
  // Comparación case-insensitive y permitir coincidencias parciales
  return ips.filter((ip) => {
    if (!ip.uploader) return false;
    return ip.uploader.toLowerCase() === uploader.toLowerCase();
  });
}

