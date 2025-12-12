import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { setBotInstance } from '../backend/routes/upload';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const LOGIN_URL = process.env.TELEGRAM_WEBAPP_URL; // Usar TELEGRAM_WEBAPP_URL en lugar de LOGIN_URL

if (!TOKEN || !LOGIN_URL) {
  console.error('⚠️  Por favor agrega TELEGRAM_BOT_TOKEN y TELEGRAM_WEBAPP_URL a tu archivo .env');
  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN no está configurado');
  }
  if (!LOGIN_URL) {
    console.error('❌ TELEGRAM_WEBAPP_URL no está configurado');
  }
}

const bot = new Telegraf(TOKEN);

// Exportar instancia del bot para que el backend pueda usarlo
export { bot };

// Configurar instancia del bot en el módulo de upload
// Nota: Esto se ejecuta cuando se importa este módulo
setBotInstance(bot);

/**
 * OPTIMIZACIÓN CRÍTICA: Cachear TELEGRAM_SECRET para no calcularlo cada vez
 * El hash SHA-256 del TOKEN es constante, no necesita recalcularse
 * Esto mejora significativamente el rendimiento con múltiples usuarios concurrentes
 */
const TELEGRAM_SECRET = crypto
  .createHash('sha256')
  .update(TOKEN)
  .digest();

/**
 * Genera hash HMAC para autenticación de Telegram
 * OPTIMIZADO: Usa TELEGRAM_SECRET cacheado para mejor rendimiento
 * Basado en: https://github.com/dynamic-labs/telegram-miniapp-dynamic
 */
function generateTelegramHash(data: {
  authDate: number;
  firstName: string;
  lastName: string;
  username?: string;
  id: number;
  photoURL: string;
}): string {
  // Preparar objeto de datos con campos requeridos
  const useData: { [key: string]: string } = {
    auth_date: String(data.authDate),
    first_name: data.firstName,
    id: String(data.id),
    last_name: data.lastName,
    photo_url: data.photoURL,
    username: data.username || '',
  };

  // Filtrar valores undefined o vacíos de forma más eficiente
  const filteredUseData: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(useData)) {
    if (value) filteredUseData[key] = value;
  }

  // Ordenar entradas y crear data check string de forma más eficiente
  const sortedKeys = Object.keys(filteredUseData).sort();
  const dataCheckArr = sortedKeys
    .map(key => `${key}=${filteredUseData[key]}`)
    .join('\n');

  // Generar HMAC-SHA256 hash usando el SECRET cacheado
  // Esto es mucho más rápido que calcular el hash del TOKEN cada vez
  return crypto
    .createHmac('sha256', TELEGRAM_SECRET)
    .update(dataCheckArr)
    .digest('hex');
}

// Comandos básicos
bot.command('start', async (ctx: Context) => {
  if (!LOGIN_URL || LOGIN_URL.includes('localhost')) {
    console.warn('⚠️  TELEGRAM_WEBAPP_URL no está configurado o usa localhost. Los botones de Mini App no funcionarán.');
  await ctx.reply(
    '🎬 Welcome to FirstFrame!\n\n' +
    'Protect your audiovisual content and gain exclusive access by solving puzzles.\n\n' +
    'Available commands:\n' +
    '/upload - Upload video for registration\n' +
    '/puzzle - Play puzzle\n' +
    '/profile - View your profile\n' +
    '/claim - Claim royalties\n' +
    '/report - Report infringement\n\n' +
    '⚠️ Configure TELEGRAM_WEBAPP_URL with a valid HTTPS URL (use ngrok for development)'
  );
    return;
  }

  if (!TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN no está configurado. Telegram Auto-Wallets no funcionará.');
    await ctx.reply(
      '🎬 Welcome to FirstFrame!\n\n' +
      '⚠️ Error: TELEGRAM_BOT_TOKEN is not configured.\n\n' +
      'Please configure the token in your .env file'
    );
    return;
  }

  // Extraer datos del usuario del contexto
  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ Error: Could not retrieve user data.');
    return;
  }

  const userData = {
    authDate: Math.floor(new Date().getTime() / 1000), // Timestamp en segundos
    firstName: from.first_name || '',
    lastName: from.last_name || '',
    username: from.username || '',
    id: from.id,
    photoURL: '', // Telegram no proporciona photoURL directamente
  };

  // Generar hash para autenticación de Telegram
  const hash = generateTelegramHash(userData);

  // Crear JWT con datos del usuario y hash
  const telegramAuthToken = jwt.sign(
    {
      ...userData,
      hash,
    },
    TOKEN, // Usar el bot token para firmar el JWT
    { algorithm: 'HS256' }
  );

  console.log('[DEBUG] JWT generado para usuario', { id: userData.id, username: userData.username });

  // URL-encode el JWT generado para uso seguro en URL
  const encodedTelegramAuthToken = encodeURIComponent(telegramAuthToken);

  // Crear URL con el token como query parameter
  const webappUrlWithToken = `${LOGIN_URL}/?telegramAuthToken=${encodedTelegramAuthToken}`;

  await ctx.reply(
    '🎬 Welcome to FirstFrame!\n\n' +
    'Protect your audiovisual content and gain exclusive access by solving puzzles.\n\n' +
    'Available commands:\n' +
    '/upload - Upload video for registration\n' +
    '/puzzle - Play puzzle\n' +
    '/profile - View your profile\n' +
    '/claim - Claim royalties\n' +
    '/report - Report infringement',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Open Mini App', web_app: { url: webappUrlWithToken } }
        ]]
      }
    }
  );
});

bot.command('upload', async (ctx: Context) => {
  const replyOptions: any = {};
  
  // Generar URL con token para el usuario actual
  const from = ctx.from;
  if (from && LOGIN_URL && !LOGIN_URL.includes('localhost') && TOKEN) {
    const userData = {
      authDate: Math.floor(new Date().getTime() / 1000),
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      username: from.username || '',
      id: from.id,
      photoURL: '',
    };
    const hash = generateTelegramHash(userData);
    const telegramAuthToken = jwt.sign(
      { ...userData, hash },
      TOKEN,
      { algorithm: 'HS256' }
    );
    const encodedToken = encodeURIComponent(telegramAuthToken);
    const url = `${LOGIN_URL}/upload?telegramAuthToken=${encodedToken}`;
    
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📤 Upload Video', web_app: { url } }
      ]]
    };
  }
  
  await ctx.reply(
    '📤 To upload a video:\n\n' +
    '1. Send the video or video link\n' +
    '2. Provide the movie/series name\n' +
    '3. Provide the release year\n\n' +
    'The system will automatically register your content as IP on Story Protocol.',
    replyOptions
  );
});

bot.command('puzzle', async (ctx: Context) => {
  const replyOptions: any = {};
  
  const from = ctx.from;
  if (from && LOGIN_URL && !LOGIN_URL.includes('localhost') && TOKEN) {
    const userData = {
      authDate: Math.floor(new Date().getTime() / 1000),
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      username: from.username || '',
      id: from.id,
      photoURL: '',
    };
    const hash = generateTelegramHash(userData);
    const telegramAuthToken = jwt.sign(
      { ...userData, hash },
      TOKEN,
      { algorithm: 'HS256' }
    );
    const encodedToken = encodeURIComponent(telegramAuthToken);
    const url = `${LOGIN_URL}/puzzle?telegramAuthToken=${encodedToken}`;
    
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '🎮 Play Now', web_app: { url } }
      ]]
    };
  }
  
  await ctx.reply(
    '🧩 Solve the puzzle and gain exclusive access!\n\n' +
    'The first to complete the puzzle get access to the private channel.',
    replyOptions
  );
});

bot.command('profile', async (ctx: Context) => {
  const userId = ctx.from?.id;
  
  // Verificar que userId existe antes de continuar
  if (!userId) {
    await ctx.reply('❌ No se pudo identificar tu usuario.');
    return;
  }
  
  const replyOptions: any = {};
  
  const from = ctx.from;
  if (from && LOGIN_URL && !LOGIN_URL.includes('localhost') && TOKEN) {
    const userData = {
      authDate: Math.floor(new Date().getTime() / 1000),
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      username: from.username || '',
      id: from.id,
      photoURL: '',
    };
    const hash = generateTelegramHash(userData);
    const telegramAuthToken = jwt.sign(
      { ...userData, hash },
      TOKEN,
      { algorithm: 'HS256' }
    );
    const encodedToken = encodeURIComponent(telegramAuthToken);
    const url = `${LOGIN_URL}/profile?telegramAuthToken=${encodedToken}`;
    
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📊 View Details', web_app: { url } }
      ]]
    };
  }

  // CRÍTICO: Obtener estadísticas usando la API del backend
  // El backend intentará usar Dynamic wallet si está disponible
  let statsMessage = `👤 Your Profile\n\nID: ${userId}\n`;
  
  try {
    // CRÍTICO: Llamar al endpoint del backend
    // El backend usará Dynamic wallet si está disponible, sino determinística
    const backendUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    const statsResponse = await axios.get(`${backendUrl}/api/user/stats/${userId}`);
    
    if (statsResponse.data.success) {
      const stats = statsResponse.data.stats;
      const walletAddress = statsResponse.data.walletAddress;
      const walletType = statsResponse.data.walletType;
      
      if (walletType === 'dynamic' && walletAddress) {
        // CRÍTICO: Mostrar datos de Dynamic wallet
        statsMessage += `💼 Wallet: ${walletAddress.substring(0, 8)}...${walletAddress.substring(36)} (Dynamic ✅)\n\n`;
        statsMessage += `Registered IPs: ${stats?.ipsRegistered || 0}\n`;
        statsMessage += `Puzzles Completed: ${stats?.puzzlesCompleted || 0}\n`;
        statsMessage += `Pending Royalties: ${stats?.royaltiesPending || '0.00'} IP\n\n`;
        statsMessage += `💰 Balances:\n`;
        statsMessage += `   Native IP: ${stats?.balances?.ip || '0.00'} IP (for gas)\n`;
        statsMessage += `   MockERC20: ${stats?.balances?.mockToken || '0.00'} tokens (for royalties)`;
      } else {
        // No hay Dynamic wallet conectada
        statsMessage += `\n⚠️ No Dynamic wallet connected.\n\n`;
        statsMessage += `To view your full profile:\n`;
        statsMessage += `1. Open the mini-app using the button below\n`;
        statsMessage += `2. Connect your Dynamic wallet\n`;
        statsMessage += `3. Use /profile again to view your statistics`;
      }
    } else {
      throw new Error('Error en respuesta del backend');
    }
  } catch (error: any) {
    console.error('Error obteniendo estadísticas del usuario:', error);
    statsMessage += 'Registered IPs: 0\n';
    statsMessage += 'Puzzles Completed: 0\n';
    statsMessage += 'Pending Royalties: 0 IP\n';
    statsMessage += '💰 IP Balance: N/A';
    statsMessage += '\n\n⚠️ Could not load full statistics. Open the mini-app to use Dynamic.';
  }
  
  await ctx.reply(statsMessage, replyOptions);
});

bot.command('claim', async (ctx: Context) => {
  const userId = ctx.from?.id;
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  
  if (!userId) {
    await ctx.reply('❌ No se pudo identificar tu usuario.');
    return;
  }
  
  try {
    // Reclamar regalías on-chain
    const API_URL = process.env.API_URL || 'http://localhost:3001/api';
    const claimResponse = await axios.post(`${API_URL}/royalties/claim`, {
      telegramUserId: userId,
    });
    
    if (claimResponse.data.success) {
      const { totalAmount, totalClaimed, royaltiesClaimed, balances } = claimResponse.data;
      
      let message = `✅ Royalties Claimed Successfully\n\n`;
      message += `💰 Total Claimed: ${totalClaimed} IP\n`;
      message += `📊 Royalties Processed: ${royaltiesClaimed}\n`;
      
      if (balances) {
        message += `\n📊 Balances:\n`;
        message += `Before: ${parseFloat(balances.before).toFixed(4)} IP\n`;
        message += `After: ${parseFloat(balances.after).toFixed(4)} IP\n`;
        message += `Difference: ${balances.difference} IP\n`;
      }
      
      message += `\n💡 Royalties are now in your Story Testnet wallet.`;
      
      await ctx.reply(message);
    } else {
      await ctx.reply(
        `ℹ️ ${claimResponse.data.message || 'You have no claimable royalties at this time.'}`
      );
    }
  } catch (error: any) {
    console.error('Error reclamando regalías:', error);
    const errorMsg = error.response?.data?.error || error.message || 'Error claiming royalties';
    await ctx.reply(`❌ Error: ${errorMsg}`);
  }
});

bot.command('report', async (ctx: Context) => {
  const replyOptions: any = {};
  
  const from = ctx.from;
  if (from && LOGIN_URL && !LOGIN_URL.includes('localhost') && TOKEN) {
    const userData = {
      authDate: Math.floor(new Date().getTime() / 1000),
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      username: from.username || '',
      id: from.id,
      photoURL: '',
    };
    const hash = generateTelegramHash(userData);
    const telegramAuthToken = jwt.sign(
      { ...userData, hash },
      TOKEN,
      { algorithm: 'HS256' }
    );
    const encodedToken = encodeURIComponent(telegramAuthToken);
    const url = `${LOGIN_URL}/report?telegramAuthToken=${encodedToken}`;
    
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📝 Report', web_app: { url } }
      ]]
    };
  }
  
  await ctx.reply(
    '🚨 Report Infringement\n\n' +
    'If you detect someone using your content without authorization, report it here.',
    replyOptions
  );
});

// Manejo de mensajes con video
bot.on(message('video'), async (ctx: Context) => {
  // Verificar que ctx.message existe y tiene video
  if (!ctx.message || !('video' in ctx.message)) {
    console.warn('⚠️ Mensaje sin video recibido');
    return;
  }

  const video = ctx.message.video;
  const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_LINK;
  
  // Extraer metadatos del video de Telegram
  const videoInfo = {
    fileId: video.file_id,
    fileUniqueId: video.file_unique_id,
    fileName: video.file_name || 'video.mp4',
    fileSize: video.file_size ? (video.file_size / (1024 * 1024)).toFixed(2) : null, // MB
    duration: video.duration ? Math.round(video.duration / 60 * 10) / 10 : null, // Minutos (redondeado a 1 decimal)
    width: video.width,
    height: video.height,
    mimeType: video.mime_type,
  };
  
  // Crear link del video (usando file_id para acceso)
  const chatId = ctx.chat?.id;
  const messageId = ctx.message.message_id;
  const videoLink = `https://t.me/c/${Math.abs(chatId!)}/${messageId}`;
  
  const replyOptions: any = {};
  
  const from = ctx.from;
  if (from && LOGIN_URL && !LOGIN_URL.includes('localhost') && TOKEN) {
    // Generar token para el usuario
    const userData = {
      authDate: Math.floor(new Date().getTime() / 1000),
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      username: from.username || '',
      id: from.id,
      photoURL: '',
    };
    const hash = generateTelegramHash(userData);
    const telegramAuthToken = jwt.sign(
      { ...userData, hash },
      TOKEN,
      { algorithm: 'HS256' }
    );
    const encodedToken = encodeURIComponent(telegramAuthToken);
    
    // Pasar metadatos del video y token a la webapp
    const params = new URLSearchParams({
      fileId: videoInfo.fileId,
      fileName: videoInfo.fileName,
      fileSizeMB: videoInfo.fileSize || '',
      durationMinutes: videoInfo.duration?.toString() || '',
      videoLink: videoLink,
      telegramAuthToken: encodedToken,
    });
    
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📤 Register IP', web_app: { url: `${LOGIN_URL}/upload?${params.toString()}` } }
      ]]
    };
  }
  
  const infoText = `📹 Video detected:\n\n` +
    `📁 Name: ${videoInfo.fileName}\n` +
    (videoInfo.fileSize ? `💾 Size: ${videoInfo.fileSize} MB\n` : '') +
    (videoInfo.duration ? `⏱️ Duration: ${videoInfo.duration} minutes\n` : '') +
    `🔗 Link: ${videoLink}\n\n` +
    `✅ This video will be forwarded to the private channel once you register it as IP.\n\n` +
    `To register this video as IP, click "Register IP" and complete the information.`;
  
  await ctx.reply(infoText, replyOptions);
  
  // NOTA: El reenvío al canal se hace automáticamente cuando el usuario completa
  // el registro del IP en la Mini App. Ver src/backend/routes/upload.ts para la lógica completa.
});

// Manejo de errores
bot.catch((err, ctx) => {
  console.error(`Error para ${ctx.updateType}:`, err);
});

// Iniciar bot con manejo mejorado de errores
// IMPORTANTE: El bot puede funcionar sin polling si solo se usa para enviar mensajes
// Para evitar conflictos de múltiples instancias, intentamos iniciar el bot pero no fallamos si hay conflicto
const startBot = async () => {
  try {
    // Verificar si el bot token está configurado
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn('⚠️  TELEGRAM_BOT_TOKEN no está configurado. El bot no se iniciará.');
      console.warn('💡 El backend seguirá funcionando, pero no se podrán enviar mensajes al canal.');
      return;
    }

    // Intentar iniciar el bot con opciones para evitar conflictos
    // Usar dropPendingUpdates para evitar procesar mensajes antiguos
    await bot.launch({
      dropPendingUpdates: true, // Ignorar actualizaciones pendientes al iniciar
    });
    console.log('🤖 Bot de Telegram iniciado correctamente');
  } catch (err: any) {
    // Si el error es por múltiples instancias, solo mostrar advertencia pero no fallar
    if (err.response?.error_code === 409 || err.message?.includes('409') || err.message?.includes('Conflict')) {
      console.warn('⚠️  Advertencia: Ya hay otra instancia del bot corriendo.');
      console.warn('💡 El bot puede seguir funcionando para enviar mensajes al canal, pero solo una instancia recibirá comandos.');
      console.warn('💡 Para evitar esto, detén todas las instancias del bot antes de iniciar una nueva.');
      console.warn('💡 El backend seguirá funcionando normalmente y podrá enviar videos al canal.');
      // No salir del proceso - permitir que el backend siga funcionando
      // El bot puede seguir siendo usado para enviar mensajes incluso sin polling activo
      // Intentar usar el bot sin polling activo (solo para enviar mensajes)
      return;
    }
    
    // Si es un error de token, es crítico pero no detenemos el backend
    if (err.message?.includes('token') || err.message?.includes('Unauthorized')) {
      console.error('❌ Error crítico: Token del bot inválido o no autorizado.');
      console.error('💡 Verifica que TELEGRAM_BOT_TOKEN esté configurado correctamente en tu .env');
      // No salir del proceso - el backend puede seguir funcionando sin el bot
      return;
    }
    
    console.error('⚠️  Error al iniciar bot:', err.message || err);
    console.warn('💡 El backend seguirá funcionando, pero el bot puede no estar disponible.');
  }
};

// Iniciar bot de forma asíncrona (no bloquea el proceso)
// Esto permite que el backend siga funcionando incluso si el bot no se puede iniciar
startBot().catch((err) => {
  console.error('Error en startBot:', err);
  // No hacer nada - el backend debe seguir funcionando
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

