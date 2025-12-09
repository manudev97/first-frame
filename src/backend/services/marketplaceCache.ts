// Servicio de caché para el marketplace
import { RegisteredIP } from './ipRegistry';

interface CacheEntry {
  data: RegisteredIP[];
  timestamp: number;
  disponible: RegisteredIP[];
  noDisponible: RegisteredIP[];
}

let marketplaceCache: CacheEntry | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene datos del marketplace desde caché si están disponibles y no han expirado
 */
export function getCachedMarketplace(): CacheEntry | null {
  if (!marketplaceCache) {
    return null;
  }

  const now = Date.now();
  if (now - marketplaceCache.timestamp > CACHE_DURATION) {
    // Cache expirado
    marketplaceCache = null;
    return null;
  }

  return marketplaceCache;
}

/**
 * Guarda datos del marketplace en caché
 */
export function setCachedMarketplace(
  data: RegisteredIP[],
  disponible: RegisteredIP[],
  noDisponible: RegisteredIP[]
): void {
  marketplaceCache = {
    data,
    disponible,
    noDisponible,
    timestamp: Date.now(),
  };
}

/**
 * Limpia el caché del marketplace
 */
export function clearMarketplaceCache(): void {
  marketplaceCache = null;
}

