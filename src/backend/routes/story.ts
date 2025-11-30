import { Router } from 'express';
import { StoryClient } from '@story-protocol/core-sdk';
import { createStoryClient } from '../services/storyClient';
import { privateKeyToAccount } from 'viem/accounts';
import { saveRegisteredIP } from '../services/ipRegistry';
import { getIPDetailsFromTransaction } from '../services/txParser';

const router = Router();

// Registrar IP Asset
router.post('/register-ip', async (req, res) => {
  try {
    const { metadata } = req.body;
    // NO recibir licenseTerms aquí - se registrarán después para evitar el error
    // LicenseAttachmentWorkflows_NoLicenseTermsData
    
    if (!metadata || !metadata.uri || !metadata.hash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Metadata con uri y hash son requeridos' 
      });
    }

    if (!process.env.STORY_SPG_NFT_CONTRACT) {
      return res.status(500).json({ 
        success: false, 
        error: 'STORY_SPG_NFT_CONTRACT no está configurado' 
      });
    }
    
    const client = await createStoryClient();
    
    // Obtener la dirección del recipient desde la private key
    if (!process.env.STORY_PRIVATE_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'STORY_PRIVATE_KEY no está configurado' 
      });
    }
    
    const account = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);
    const recipient = account.address;
    
    // Registrar IP Asset usando registerIpAsset (mint y register en una transacción)
    // IMPORTANTE: NO pasar licenseTermsData si está vacío para evitar el error
    // LicenseAttachmentWorkflows_NoLicenseTermsData
    // Los términos de licencia se registrarán después usando register-license
    const tx = await client.ipAsset.registerIpAsset({
      nft: {
        type: 'mint', // Tipo requerido: 'mint' para mint y register en una transacción
        spgNftContract: process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`,
        recipient: recipient, // Dirección que recibirá el NFT
      },
      ipMetadata: {
        ipMetadataURI: metadata.uri, // Cambiado de metadataURI a ipMetadataURI (formato correcto del SDK)
        ipMetadataHash: metadata.hash as `0x${string}`, // Cambiado de metadataHash a ipMetadataHash
        nftMetadataURI: metadata.nftUri || metadata.uri,
        nftMetadataHash: metadata.nftHash || metadata.hash as `0x${string}`,
      },
      // NO pasar licenseTermsData aquí - se registrarán después
    });

    // Guardar IP en el registry para el marketplace
    // Obtener metadata del request si está disponible
    try {
      const metadataUriStr: string = typeof metadata.uri === 'string' ? metadata.uri : '';
      const nftMetadataUriStr: string = typeof metadata.nftUri === 'string' ? metadata.nftUri : metadataUriStr;
      
      // Guardar IP después de obtener el IP ID correcto y token ID
      // Esto se hará después de parsear la transacción
    } catch (saveError) {
      console.warn('No se pudo guardar IP en registry (no crítico):', saveError);
    }

            // Verificar que la respuesta tenga los campos necesarios
            if (!tx.ipId || !tx.txHash) {
              console.error('❌ Respuesta del SDK sin ipId o txHash:', tx);
              return res.status(500).json({
                success: false,
                error: 'El SDK no devolvió ipId o txHash',
                details: JSON.stringify(tx),
              });
            }

            // Obtener el IP ID correcto y el token ID desde los eventos de la transacción
            let correctIpId = tx.ipId; // Fallback al IP ID del SDK
            let tokenId: bigint | null = null;
            
            try {
              const ipDetails = await getIPDetailsFromTransaction(
                tx.txHash as `0x${string}`,
                process.env.STORY_SPG_NFT_CONTRACT as `0x${string}`
              );
              
              if (ipDetails) {
                // Usar el IP ID desde los eventos si está disponible
                if (ipDetails.ipId) {
                  console.log('🔄 IP ID obtenido desde eventos de transacción:');
                  console.log(`   SDK IP ID: ${tx.ipId}`);
                  console.log(`   Event IP ID: ${ipDetails.ipId}`);
                  correctIpId = ipDetails.ipId;
                }
                tokenId = ipDetails.tokenId;
              } else {
                console.warn('⚠️  No se pudieron extraer IP details desde eventos, usando SDK IP ID');
              }
            } catch (parseError: any) {
              console.warn('⚠️  Error obteniendo IP details desde eventos (usando SDK IP ID):', parseError.message);
            }

            // Actualizar el registro del IP con el IP ID correcto y token ID
            try {
              const metadataUriStr: string = typeof metadata.uri === 'string' ? metadata.uri : '';
              const nftMetadataUriStr: string = typeof metadata.nftUri === 'string' ? metadata.nftUri : metadataUriStr;
              
              if (metadataUriStr && correctIpId && tx.txHash) {
                await saveRegisteredIP({
                  ipId: correctIpId, // Usar el IP ID correcto
                  tokenId: tokenId ? tokenId.toString() : undefined,
                  title: req.body.title || 'Untitled',
                  year: req.body.year,
                  posterUrl: req.body.posterUrl,
                  description: req.body.description,
                  imdbId: req.body.imdbId,
                  metadataUri: metadataUriStr,
                  nftMetadataUri: nftMetadataUriStr,
                  txHash: tx.txHash,
                  createdAt: new Date().toISOString(),
                  uploader: req.body.uploader,
                });
              }
            } catch (saveError) {
              console.warn('No se pudo actualizar IP en registry con IP ID correcto (no crítico):', saveError);
            }

            console.log('✅ IP registrado exitosamente:', {
              sdkIpId: tx.ipId,
              correctIpId: correctIpId,
              tokenId: tokenId ? tokenId.toString() : null,
              txHash: tx.txHash,
            });

            res.json({ 
              success: true, 
              txHash: tx.txHash, 
              ipId: correctIpId, // Usar el IP ID correcto
              tokenId: tokenId ? tokenId.toString() : null, // Incluir token ID si está disponible
            });
          } catch (error: any) {
            console.error('❌ Error registrando IP:', error);
            console.error('Detalles del error:', {
              message: error.message,
              stack: error.stack,
              response: error.response?.data,
            });
            res.status(500).json({ 
              success: false, 
              error: error.message || 'Error desconocido al registrar IP',
              details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
          }
});

// Registrar derivado (póster del puzzle)
router.post('/register-derivative', async (req, res) => {
  try {
    const { parentIpId, posterMetadata, licenseTokenId } = req.body;
    
    const client = await createStoryClient();
    
    // Usar registerIpAndMakeDerivative - requiere formato diferente
    const account = privateKeyToAccount(process.env.STORY_PRIVATE_KEY as `0x${string}`);
    const recipient = account.address;
    
    // TODO: Verificar el formato correcto de registerIpAndMakeDerivative
    // Por ahora, usamos registerIpAsset y luego attachamos como derivado
    const tx = await client.ipAsset.registerIpAsset({
      nft: {
        type: 'mint',
        spgNftContract: process.env.STORY_SPG_NFT_CONTRACT! as `0x${string}`,
        recipient: recipient,
      },
      ipMetadata: {
        ipMetadataURI: posterMetadata.uri,
        ipMetadataHash: posterMetadata.hash,
        nftMetadataURI: posterMetadata.nftUri,
        nftMetadataHash: posterMetadata.nftHash,
      },
    });

    // TODO: Después de registrar, necesitamos hacer attach como derivado
    // Esto requiere una llamada adicional al SDK

    res.json({ success: true, txHash: tx.txHash, ipId: tx.ipId });
  } catch (error: any) {
    console.error('Error registrando derivado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Registrar términos de licencia
router.post('/register-license', async (req, res) => {
  try {
    const { ipId, licenseTerms } = req.body;
    
    const client = await createStoryClient();
    
    // CRÍTICO: El SDK valida ANTES de procesar, por lo que debemos corregir los valores
    // ANTES de pasarlos al SDK. Si commercialUse=true o commercialRevShare>0 sin currency,
    // el SDK lanzará "Royalty policy requires currency token"
    
    // Obtener valores originales
    const originalCommercialRevShare = Number(licenseTerms.commercialRevShare) || 0;
    const originalCommercialUse = Boolean(licenseTerms.commercialUse);
    const currency = licenseTerms.currency;
    
    // Validar currency token
    const hasValidCurrency = currency && 
                            currency !== '0x0000000000000000000000000000000000000000' &&
                            currency !== '' &&
                            currency !== null &&
                            currency !== undefined;
    
    // CORRECCIÓN: Si no hay currency token válido, FORZAR commercialUse=false y commercialRevShare=0
    // Esto debe hacerse ANTES de llamar al SDK para evitar el error de validación
    let finalCommercialRevShare = originalCommercialRevShare;
    let finalCommercialUse = originalCommercialUse;
    
    if (!hasValidCurrency) {
      // Si no hay currency token, NO se pueden tener regalías comerciales
      if (originalCommercialRevShare > 0 || originalCommercialUse) {
        console.warn('⚠️  CORRECCIÓN: No hay currency token válido. Forzando:');
        console.warn(`   - commercialRevShare: ${originalCommercialRevShare} → 0`);
        console.warn(`   - commercialUse: ${originalCommercialUse} → false`);
        finalCommercialRevShare = 0;
        finalCommercialUse = false;
      }
    } else {
      // Si hay currency token válido, usar los valores originales
      console.log('✅ Currency token válido detectado:', currency);
    }
    
    // Log de los valores finales que se enviarán al SDK
    console.log('📋 Valores finales para registerPILTerms:');
    console.log(`   - commercialRevShare: ${finalCommercialRevShare}`);
    console.log(`   - commercialUse: ${finalCommercialUse}`);
    console.log(`   - currency: ${hasValidCurrency ? currency : '0x0000...0000'}`);
    
    // CRÍTICO: Si el SDK sigue lanzando el error incluso con commercialRevShare=0 y commercialUse=false,
    // puede ser que el SDK valide el campo currency incluso cuando no se necesita.
    // Solución: Si no hay currency token y no hay regalías comerciales, usar un currency token "zero" válido
    // O mejor aún, verificar si podemos omitir completamente el registro de licencia si no hay regalías
    
    // Si no hay currency token y no hay regalías comerciales, intentar registrar sin currency
    // Pero el SDK puede requerir currency de todos modos, así que usamos el address zero
    const finalCurrency = hasValidCurrency ? currency : '0x0000000000000000000000000000000000000000';
    
    // Asegurar que todos los campos numéricos tengan valores válidos (no undefined)
    // El SDK convierte algunos campos a BigInt, por lo que no pueden ser undefined
    try {
      const tx = await client.license.registerPILTerms({
        transferable: licenseTerms.transferable ?? false,
        commercialRevShare: finalCommercialRevShare, // SIEMPRE 0 si no hay currency
        commercialUse: finalCommercialUse, // SIEMPRE false si no hay currency
        commercialAttribution: licenseTerms.commercialAttribution ?? false,
        derivativesAllowed: licenseTerms.derivativesAllowed ?? false,
        derivativesAttribution: licenseTerms.derivativesAttribution ?? false,
        derivativesApproval: licenseTerms.derivativesApproval ?? false,
        derivativesReciprocal: licenseTerms.derivativesReciprocal ?? false,
        // Campos requeridos por el SDK
        defaultMintingFee: licenseTerms.mintingFee || '0', // String para BigInt
        expiration: 0, // 0 = sin expiración
        commercialRevCeiling: 0, // 0 = sin límite
        derivativeRevCeiling: 0, // 0 = sin límite
        commercializerChecker: '0x0000000000000000000000000000000000000000',
        commercializerCheckerData: '0x',
        currency: finalCurrency,
        uri: '', // URI opcional para términos de licencia
      });
      
      res.json({ success: true, txHash: tx.txHash, licenseTermsId: tx.licenseTermsId });
    } catch (sdkError: any) {
      // Si el SDK sigue lanzando el error incluso con valores correctos,
      // puede ser un bug del SDK o una validación adicional que no conocemos
      console.error('❌ Error del SDK al registrar licencia:', sdkError.message);
      console.error('📋 Valores que se intentaron enviar:', {
        commercialRevShare: finalCommercialRevShare,
        commercialUse: finalCommercialUse,
        currency: finalCurrency,
        hasValidCurrency,
      });
      
      // Si el error es específicamente sobre currency token y no hay regalías comerciales,
      // podemos intentar omitir el registro de licencia (el IP ya está registrado)
      if (sdkError.message.includes('currency token') && finalCommercialRevShare === 0 && !finalCommercialUse) {
        console.warn('⚠️  El SDK requiere currency token incluso sin regalías comerciales.');
        console.warn('💡 El IP está registrado correctamente, pero la licencia no se pudo registrar.');
        console.warn('💡 Para registrar la licencia, necesitas un wrapped IP token address.');
        console.warn('💡 Por ahora, el IP funcionará sin licencia registrada.');
        // Retornar éxito parcial - el IP está registrado, solo la licencia falló
        return res.status(200).json({ 
          success: false, 
          warning: true,
          message: 'IP registrado correctamente, pero la licencia no se pudo registrar porque el SDK requiere currency token incluso sin regalías comerciales.',
          ipId: ipId,
          skipLicense: true,
        });
      }
      
      throw sdkError;
    }
  } catch (error: any) {
    console.error('Error registrando licencia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Pagar regalías
router.post('/pay-royalty', async (req, res) => {
  try {
    const { ipId, amount, currency } = req.body;
    
    const client = await createStoryClient();
    
    // TODO: Verificar la API correcta del SDK para payRoyalty
    // Por ahora, retornamos error indicando que necesita implementación
    return res.status(501).json({ 
      success: false, 
      error: 'payRoyalty endpoint necesita verificación de API del SDK' 
    });
  } catch (error: any) {
    console.error('Error pagando regalías:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reclamar regalías
router.post('/claim-royalty', async (req, res) => {
  try {
    const { ipId } = req.body;
    
    if (!ipId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ipId es requerido para reclamar regalías' 
      });
    }
    
    const client = await createStoryClient();
    
    // TODO: Verificar la API correcta del SDK para claimAllRevenue
    // Por ahora, retornamos error indicando que necesita implementación
    return res.status(501).json({ 
      success: false, 
      error: 'claimAllRevenue endpoint necesita verificación de API del SDK' 
    });
  } catch (error: any) {
    console.error('Error reclamando regalías:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error desconocido al reclamar regalías' 
    });
  }
});

// Crear disputa
router.post('/create-dispute', async (req, res) => {
  try {
    const { targetIpId, reason, evidence } = req.body;
    
    const client = await createStoryClient();
    
    // TODO: Verificar la API correcta del SDK para raiseDispute
    // Por ahora, retornamos error indicando que necesita implementación
    return res.status(501).json({ 
      success: false, 
      error: 'raiseDispute endpoint necesita verificación de API del SDK' 
    });
  } catch (error: any) {
    console.error('Error creando disputa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as storyRouter };

