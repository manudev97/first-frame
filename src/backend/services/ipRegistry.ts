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

// Lock para evitar escrituras concurrentes
let writeLock: Promise<void> = Promise.resolve();
let isWriting = false;

// Asegurar que el directorio existe
async function ensureDataDir() {
  const dataDir = path.dirname(REGISTRY_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    // Verificar nuevamente que se creó correctamente
    await fs.access(dataDir);
  }
}

// Cargar IPs registrados
export async function loadRegisteredIPs(): Promise<RegisteredIP[]> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(REGISTRY_FILE, 'utf-8');
    
    // CRÍTICO: Validar que el contenido no esté vacío
    if (!content || content.trim() === '') {
      console.warn('⚠️  Archivo de registry está vacío, retornando array vacío');
      return [];
    }
    
    // CRÍTICO: Intentar parsear el JSON con manejo de errores mejorado
    try {
      const parsed = JSON.parse(content);
      // Validar que sea un array
      if (!Array.isArray(parsed)) {
        console.error('❌ El registry no es un array válido, retornando array vacío');
        return [];
      }
      return parsed;
    } catch (parseError: any) {
      console.error('❌ Error parseando JSON del registry:', parseError.message);
      console.error('   Posición del error:', parseError.message.match(/position (\d+)/)?.[1] || 'desconocida');
      
      // CRÍTICO: Intentar recuperar el JSON corrupto
      try {
        // Intentar leer el archivo de respaldo si existe
        const backupFile = REGISTRY_FILE + '.backup';
        const backupContent = await fs.readFile(backupFile, 'utf-8');
        if (backupContent && backupContent.trim() !== '') {
          const backupParsed = JSON.parse(backupContent);
          if (Array.isArray(backupParsed)) {
            console.log('✅ Recuperado desde archivo de respaldo');
            // Restaurar desde el backup
            await fs.writeFile(REGISTRY_FILE, JSON.stringify(backupParsed, null, 2), 'utf-8');
            return backupParsed;
          }
        }
      } catch (backupError) {
        console.warn('⚠️  No se pudo recuperar desde backup:', backupError);
      }
      
      // Si no se puede recuperar, retornar array vacío
      console.warn('⚠️  Retornando array vacío debido a JSON corrupto');
      return [];
    }
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
  // CRÍTICO: Esperar a que cualquier escritura anterior termine (lock)
  while (isWriting) {
    await writeLock;
  }
  
  // Marcar que estamos escribiendo
  isWriting = true;
  
  // Crear una nueva promesa de lock para esta escritura
  let resolveLock: () => void;
  writeLock = new Promise((resolve) => {
    resolveLock = resolve;
  });
  
  try {
    // CRÍTICO: Asegurar que el directorio existe ANTES de cualquier operación
    await ensureDataDir();
    
    const ips = await loadRegisteredIPs();
    
    // CRÍTICO: Buscar duplicados por tokenId si está disponible (más preciso)
    // Si no hay tokenId, buscar por ipId + título como fallback
    let existingIndex = -1;
    
    if (ip.tokenId) {
      // PRIORIDAD 1: Buscar por tokenId (clave única)
      const ipTokenId = ip.tokenId; // Guardar en variable para evitar errores de TypeScript
      existingIndex = ips.findIndex((existing) => 
        existing.tokenId === ipTokenId || 
        existing.tokenId === ipTokenId.toString() ||
        (existing.tokenId && existing.tokenId.toString() === ipTokenId.toString())
      );
      if (existingIndex !== -1) {
        console.log(`✅ IP encontrado por tokenId ${ipTokenId}, actualizando...`);
      }
    }
    
    // PRIORIDAD 2: Si no se encontró por tokenId, buscar por ipId + título
    if (existingIndex === -1 && ip.title) {
      existingIndex = ips.findIndex((existing) => 
        existing.ipId.toLowerCase() === ip.ipId.toLowerCase() &&
        existing.title?.toLowerCase().trim() === ip.title.toLowerCase().trim()
      );
      if (existingIndex !== -1) {
        console.log(`✅ IP encontrado por ipId + título "${ip.title}", actualizando...`);
      }
    }
    
    // PRIORIDAD 3: Si aún no se encontró, buscar solo por ipId (último recurso)
    if (existingIndex === -1) {
      existingIndex = ips.findIndex((existing) => existing.ipId.toLowerCase() === ip.ipId.toLowerCase());
      if (existingIndex !== -1) {
        console.warn(`⚠️  IP ${ip.ipId} encontrado solo por ipId (sin tokenId ni título único), actualizando...`);
        console.warn(`   Esto puede sobrescribir un IP diferente con el mismo contrato. TokenId del existente: ${ips[existingIndex].tokenId || 'N/A'}, TokenId del nuevo: ${ip.tokenId || 'N/A'}`);
      }
    }
    
    if (existingIndex !== -1) {
      // Actualizar el IP existente con nueva información, preservando tokenId si el nuevo no lo tiene
      const existing = ips[existingIndex];
      ips[existingIndex] = { 
        ...existing, 
        ...ip,
        // CRÍTICO: Preservar tokenId del existente si el nuevo no lo tiene
        tokenId: ip.tokenId || existing.tokenId,
        // Preservar información del canal si existe
        channelMessageId: ip.channelMessageId || existing.channelMessageId,
        videoFileId: ip.videoFileId || existing.videoFileId,
      };
      console.log(`✅ IP actualizado: ${ip.ipId}${ip.tokenId ? ` (Token ID: ${ip.tokenId})` : ''} - ${ip.title}`);
    } else {
      // Agregar nuevo IP
      ips.push(ip);
      console.log(`✅ IP nuevo agregado: ${ip.ipId}${ip.tokenId ? ` (Token ID: ${ip.tokenId})` : ''} - ${ip.title}`);
    }
    
    // CRÍTICO: Escribir de forma atómica para evitar corrupción del archivo
    // 1. Asegurar que el directorio existe ANTES de cualquier operación de escritura
    await ensureDataDir();
    
    // 2. Verificar que el directorio existe (con reintento si es necesario)
    const dataDir = path.dirname(REGISTRY_FILE);
    try {
      await fs.access(dataDir);
    } catch {
      // Si no existe, crearlo con recursive: true
      await fs.mkdir(dataDir, { recursive: true });
      // Verificar nuevamente que se creó correctamente
      await fs.access(dataDir);
    }
    
    // 3. Crear archivo temporal
    const tempFile = REGISTRY_FILE + '.tmp';
    const jsonContent = JSON.stringify(ips, null, 2);
    
    // 4. Validar que el JSON es válido antes de escribir
    try {
      JSON.parse(jsonContent);
    } catch (validationError) {
      throw new Error('JSON generado es inválido - no se puede guardar');
    }
    
    // 5. Crear backup antes de escribir
    try {
      const currentContent = await fs.readFile(REGISTRY_FILE, 'utf-8').catch(() => '[]');
      if (currentContent && currentContent.trim() !== '') {
        const backupFile = REGISTRY_FILE + '.backup';
        await fs.writeFile(backupFile, currentContent, 'utf-8');
      }
    } catch (backupError) {
      // No crítico si falla el backup
      console.warn('⚠️  No se pudo crear backup:', backupError);
    }
    
    // 6. Asegurar que el directorio existe una vez más antes de escribir (por si acaso)
    await ensureDataDir();
    
    // 7. Escribir al archivo temporal primero
    await fs.writeFile(tempFile, jsonContent, 'utf-8');
    
    // 8. Verificar que el archivo temporal se escribió correctamente
    try {
      await fs.access(tempFile);
    } catch {
      throw new Error('No se pudo escribir el archivo temporal');
    }
    
    // 9. Asegurar que el directorio existe antes de renombrar
    await ensureDataDir();
    
    // 10. Reemplazar el archivo original con el temporal (operación atómica)
    await fs.rename(tempFile, REGISTRY_FILE);
    
    console.log(`✅ IP guardado en marketplace: ${ip.ipId}${ip.tokenId ? ` (Token ID: ${ip.tokenId})` : ''} - ${ip.title} (uploader: ${ip.uploader || 'N/A'})`);
    
    // CRÍTICO: Liberar el lock después de escribir exitosamente
    isWriting = false;
    resolveLock!();
  } catch (error) {
    console.error('❌ Error guardando IP registrado:', error);
    // Limpiar archivo temporal si existe
    try {
      await fs.unlink(REGISTRY_FILE + '.tmp').catch(() => {});
    } catch {}
    // CRÍTICO: Liberar el lock incluso si hay error
    isWriting = false;
    resolveLock!();
    throw error;
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

// Obtener IP por tokenId (más preciso que por ipId)
export async function getIPByTokenId(tokenId: string): Promise<RegisteredIP | null> {
  const ips = await loadRegisteredIPs();
  return ips.find((ip) => 
    ip.tokenId === tokenId || 
    ip.tokenId === tokenId.toString() ||
    (ip.tokenId && ip.tokenId.toString() === tokenId.toString())
  ) || null;
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

