import { createPublicClient, http, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Obtiene el IP ID correcto (address del contrato NFT) y el token ID (instance)
 * desde los eventos de la transacción de registro de IP
 */
export async function getIPDetailsFromTransaction(
  txHash: `0x${string}`,
  spgNftContract: `0x${string}`
): Promise<{ ipId: string; tokenId: bigint | null } | null> {
  try {
    if (!process.env.STORY_RPC_URL) {
      throw new Error('STORY_RPC_URL no está configurado');
    }

    // Crear cliente público para leer la blockchain
    const publicClient = createPublicClient({
      transport: http(process.env.STORY_RPC_URL),
    });

    // Obtener el receipt de la transacción
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

    if (!receipt) {
      console.warn('⚠️  No se pudo obtener el receipt de la transacción');
      return null;
    }

    // ABI del evento Transfer de ERC721 (estándar)
    const transferEventAbi = [
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: true, name: 'tokenId', type: 'uint256' },
        ],
        name: 'Transfer',
        type: 'event',
      },
    ] as const;

    // Buscar eventos Transfer del contrato SPG NFT
    const transferLogs = parseEventLogs({
      abi: transferEventAbi,
      logs: receipt.logs,
    }).filter((log) => log.address.toLowerCase() === spgNftContract.toLowerCase());

    if (transferLogs.length === 0) {
      console.warn('⚠️  No se encontraron eventos Transfer en la transacción');
      // Intentar obtener el IP ID desde el SDK response (fallback)
      return null;
    }

    // El último evento Transfer debería ser el mint (from = address(0))
    const mintEvent = transferLogs.find((log) => log.args.from === '0x0000000000000000000000000000000000000000');
    const transferEvent = mintEvent || transferLogs[transferLogs.length - 1];

    if (!transferEvent || !transferEvent.args.tokenId) {
      console.warn('⚠️  No se pudo extraer el tokenId del evento Transfer');
      return null;
    }

    const tokenId = transferEvent.args.tokenId;
    
    // El IP ID correcto es el address del contrato NFT (spgNftContract)
    // Pero según la URL del explorador, parece que el IP ID es un address diferente
    // Necesitamos buscar el evento IPAssetRegistered del contrato IPAssetRegistry
    
    // En Story Protocol, el IP ID se calcula usando getIPId(nftContract, tokenId)
    // El SDK debería devolver el IP ID correcto, pero a veces devuelve un hash
    // Necesitamos buscar el evento IPAssetRegistered del contrato IPAssetRegistry
    
    // ABI del evento IPAssetRegistered de Story Protocol
    const ipAssetRegisteredAbi = [
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'ipId', type: 'address' },
          { indexed: true, name: 'nftContract', type: 'address' },
          { indexed: true, name: 'tokenId', type: 'uint256' },
          { indexed: false, name: 'metadataURI', type: 'string' },
        ],
        name: 'IPAssetRegistered',
        type: 'event',
      },
    ] as const;

    // Buscar el evento IPAssetRegistered en todos los logs
    // El IP ID real debería estar en este evento
    let ipId: string | null = null;
    
    try {
      // Intentar parsear con el ABI completo primero
      const ipAssetLogs = parseEventLogs({
        abi: ipAssetRegisteredAbi,
        logs: receipt.logs,
      });

      if (ipAssetLogs.length > 0) {
        const ipAssetEvent = ipAssetLogs[0];
        if (ipAssetEvent.args.ipId) {
          ipId = ipAssetEvent.args.ipId as string;
          console.log('✅ IP ID encontrado en evento IPAssetRegistered:', ipId);
        }
      }
    } catch (parseError) {
      console.warn('⚠️  No se pudo parsear eventos IPAssetRegistered con ABI completo, intentando búsqueda manual...');
      
      // Si el parseo falla, buscar manualmente en los logs
      // El evento IPAssetRegistered tiene el IP ID como primer topic (indexed)
      // Buscar logs que no sean del contrato NFT y que tengan un address en el primer topic
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== spgNftContract.toLowerCase() && 
            log.topics.length >= 1) {
          // El primer topic podría ser el IP ID (si es un evento IPAssetRegistered)
          const potentialIpId = '0x' + log.topics[0].slice(-40);
          // Verificar que sea un address válido (no zero address)
          if (potentialIpId !== '0x0000000000000000000000000000000000000000' &&
              potentialIpId.length === 42) {
            // Verificar que el segundo topic sea el contrato NFT (nftContract)
            if (log.topics.length >= 2) {
              const nftContractInEvent = '0x' + log.topics[1].slice(-40);
              if (nftContractInEvent.toLowerCase() === spgNftContract.toLowerCase()) {
                ipId = potentialIpId;
                console.log('✅ IP ID encontrado manualmente en logs:', ipId);
                break;
              }
            }
          }
        }
      }
    }

    // Si aún no encontramos el IP ID, usar el SDK response como fallback
    // pero esto debería ser raro si los eventos están correctos
    if (!ipId) {
      console.warn('⚠️  No se pudo encontrar IP ID en eventos, se usará el del SDK como fallback');
      // El IP ID se obtendrá del SDK response en el código que llama a esta función
    }

    console.log('✅ IP Details extraídos de la transacción:', {
      ipId,
      tokenId: tokenId.toString(),
      txHash,
    });

    return {
      ipId: ipId || spgNftContract, // Fallback al contrato NFT si no encontramos el IP ID
      tokenId,
    };
  } catch (error: any) {
    console.error('❌ Error obteniendo IP details de la transacción:', error);
    return null;
  }
}

