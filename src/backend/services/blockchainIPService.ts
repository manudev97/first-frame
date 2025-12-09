// Servicio para consultar IPs registrados desde la blockchain
import { createPublicClient, http, parseEventLogs } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Obtiene el número de IPs (NFTs) registrados por una dirección usando balanceOf del contrato ERC721
 * Esta es una forma más eficiente que consultar eventos históricos
 */
export async function getIPCountByAddress(userAddress: `0x${string}`): Promise<number> {
  try {
    if (!process.env.STORY_RPC_URL) {
      throw new Error('STORY_RPC_URL no está configurado');
    }

    if (!process.env.STORY_SPG_NFT_CONTRACT) {
      throw new Error('STORY_SPG_NFT_CONTRACT no está configurado');
    }

    const publicClient = createPublicClient({
      transport: http(process.env.STORY_RPC_URL),
    });

    const spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`;

    // ABI mínimo de ERC721 para balanceOf
    const erc721Abi = [
      {
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    console.log(`🔍 Consultando balance de NFTs para ${userAddress}...`);

    // Obtener el balance de NFTs del usuario (número de IPs que posee)
    const balance = await publicClient.readContract({
      address: spgNftContract,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    });

    const count = Number(balance);
    console.log(`✅ Balance de NFTs para ${userAddress}: ${count}`);
    
    return count;
  } catch (error: any) {
    console.error('Error obteniendo conteo de IPs desde blockchain:', error);
    // No lanzar error - devolver 0 para que el sistema pueda usar el registry local como fallback
    return 0;
  }
}

/**
 * Obtiene los IPs registrados por una dirección desde la blockchain
 * Consulta eventos Transfer donde el usuario recibió tokens (mints)
 */
export async function getIPsByAddress(userAddress: `0x${string}`): Promise<Array<{
  ipId: string;
  tokenId: string;
  txHash: string;
  blockNumber: bigint;
}>> {
  try {
    if (!process.env.STORY_RPC_URL) {
      throw new Error('STORY_RPC_URL no está configurado');
    }

    if (!process.env.STORY_SPG_NFT_CONTRACT) {
      throw new Error('STORY_SPG_NFT_CONTRACT no está configurado');
    }

    const publicClient = createPublicClient({
      transport: http(process.env.STORY_RPC_URL),
    });

    const spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`;

    // ABI del evento Transfer (ERC721)
    const transferAbi = [
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

    console.log(`🔍 Buscando IPs registrados para ${userAddress}...`);

    // Buscar eventos Transfer donde el usuario recibió tokens (mints)
    // Usar un rango de bloques razonable (últimos 100,000 bloques) para optimizar
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 100000n ? currentBlock - 100000n : 0n;
    const toBlock = 'latest';

    const transferLogs = await publicClient.getLogs({
      address: spgNftContract,
      event: transferAbi[0],
      args: {
        to: userAddress,
      },
      fromBlock,
      toBlock,
    });

    console.log(`📊 Encontrados ${transferLogs.length} eventos Transfer para ${userAddress}`);
    
    // Filtrar solo mints (from = address(0))
    const mintLogs = transferLogs.filter((log) => 
      log.args.from?.toLowerCase() === '0x0000000000000000000000000000000000000000'
    );
    
    console.log(`📊 De esos, ${mintLogs.length} son mints (from = address(0))`);

    const ipAssets: Array<{
      ipId: string;
      tokenId: string;
      txHash: string;
      blockNumber: bigint;
    }> = [];

    // Para cada Transfer (mint), obtener el IP ID desde la transacción
    for (const transferLog of mintLogs) {
      try {
        const tokenId = transferLog.args.tokenId;
        if (!tokenId) {
          console.warn(`⚠️  Transfer sin tokenId: ${transferLog.transactionHash}`);
          continue;
        }
        
        console.log(`\n🔍 Procesando mint: Token ID ${tokenId}, TX ${transferLog.transactionHash}`);

        // Obtener el receipt de la transacción
        const receipt = await publicClient.getTransactionReceipt({
          hash: transferLog.transactionHash,
        });

        // Intentar obtener el IP ID usando la función que ya tenemos
        let ipId: string | null = null;
        try {
          const { getIPDetailsFromTransaction } = await import('./txParser');
          const ipDetails = await getIPDetailsFromTransaction(
            transferLog.transactionHash,
            spgNftContract
          );
          
          if (ipDetails && ipDetails.ipId) {
            ipId = ipDetails.ipId;
          }
        } catch (parseError: any) {
          console.warn(`⚠️  Error obteniendo IP ID desde txParser para ${transferLog.transactionHash}:`, parseError.message);
        }

        // Si no obtuvimos el IP ID desde txParser, intentar desde eventos IPAssetRegistered
        if (!ipId) {
          try {
            const ipAssetLogs = parseEventLogs({
              abi: ipAssetRegisteredAbi,
              logs: receipt.logs,
            }).filter((log) => 
              log.args.nftContract?.toLowerCase() === spgNftContract.toLowerCase() &&
              log.args.tokenId === tokenId
            );

            if (ipAssetLogs.length > 0) {
              ipId = ipAssetLogs[0].args.ipId as string;
            }
          } catch (eventError: any) {
            console.warn(`⚠️  Error buscando evento IPAssetRegistered:`, eventError.message);
          }
        }

        // IMPORTANTE: Si encontramos un mint (Transfer from address(0)), SIEMPRE incluirlo
        // aunque no tengamos el IP ID. El endpoint buscará los detalles en el registry local.
        // El tokenId y txHash son suficientes para identificar el IP.
        
        if (!ipId) {
          console.warn(`⚠️  No se pudo obtener IP ID para tokenId ${tokenId}, pero el mint existe. Se buscará en el registry local.`);
        } else {
          console.log(`✅ IP ID obtenido para tokenId ${tokenId}: ${ipId}`);
        }

        // SIEMPRE agregar el IP encontrado (mint verificado)
        // El endpoint buscará los detalles en el registry local usando tokenId o txHash
        ipAssets.push({
          ipId: ipId || `PLACEHOLDER_${tokenId.toString()}`, // Placeholder que se resolverá en el endpoint
          tokenId: tokenId.toString(),
          txHash: transferLog.transactionHash,
          blockNumber: receipt.blockNumber,
        });
        
        console.log(`✅ IP agregado: Token ID ${tokenId}, TX ${transferLog.transactionHash}, IP ID: ${ipId || 'PLACEHOLDER'}`);
      } catch (error: any) {
        console.warn(`⚠️  Error procesando Transfer ${transferLog.transactionHash}:`, error.message);
        // Continuar con el siguiente
      }
    }

    console.log(`✅ Encontrados ${ipAssets.length} IPs registrados para ${userAddress}`);
    return ipAssets;
  } catch (error: any) {
    console.error('Error obteniendo IPs desde blockchain:', error);
    throw error;
  }
}

