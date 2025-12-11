"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const filters_1 = require("telegraf/filters");
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const upload_1 = require("../backend/routes/upload");
dotenv_1.default.config();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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
const bot = new telegraf_1.Telegraf(TOKEN);
exports.bot = bot;
// Configurar instancia del bot en el módulo de upload
// Nota: Esto se ejecuta cuando se importa este módulo
(0, upload_1.setBotInstance)(bot);
/**
 * OPTIMIZACIÓN CRÍTICA: Cachear TELEGRAM_SECRET para no calcularlo cada vez
 * El hash SHA-256 del TOKEN es constante, no necesita recalcularse
 * Esto mejora significativamente el rendimiento con múltiples usuarios concurrentes
 */
const TELEGRAM_SECRET = crypto_1.default
    .createHash('sha256')
    .update(TOKEN)
    .digest();
/**
 * Genera hash HMAC para autenticación de Telegram
 * OPTIMIZADO: Usa TELEGRAM_SECRET cacheado para mejor rendimiento
 * Basado en: https://github.com/dynamic-labs/telegram-miniapp-dynamic
 */
function generateTelegramHash(data) {
    // Preparar objeto de datos con campos requeridos
    const useData = {
        auth_date: String(data.authDate),
        first_name: data.firstName,
        id: String(data.id),
        last_name: data.lastName,
        photo_url: data.photoURL,
        username: data.username || '',
    };
    // Filtrar valores undefined o vacíos de forma más eficiente
    const filteredUseData = {};
    for (const [key, value] of Object.entries(useData)) {
        if (value)
            filteredUseData[key] = value;
    }
    // Ordenar entradas y crear data check string de forma más eficiente
    const sortedKeys = Object.keys(filteredUseData).sort();
    const dataCheckArr = sortedKeys
        .map(key => `${key}=${filteredUseData[key]}`)
        .join('\n');
    // Generar HMAC-SHA256 hash usando el SECRET cacheado
    // Esto es mucho más rápido que calcular el hash del TOKEN cada vez
    return crypto_1.default
        .createHmac('sha256', TELEGRAM_SECRET)
        .update(dataCheckArr)
        .digest('hex');
}
// Comandos básicos
bot.command('start', async (ctx) => {
    if (!LOGIN_URL || LOGIN_URL.includes('localhost')) {
        console.warn('⚠️  TELEGRAM_WEBAPP_URL no está configurado o usa localhost. Los botones de Mini App no funcionarán.');
        await ctx.reply('🎬 ¡Bienvenido a FirstFrame!\n\n' +
            'Protege tu contenido audiovisual y gana acceso exclusivo resolviendo rompecabezas.\n\n' +
            'Comandos disponibles:\n' +
            '/upload - Subir video para registro\n' +
            '/puzzle - Jugar rompecabezas\n' +
            '/profile - Ver tu perfil\n' +
            '/claim - Reclamar regalías\n' +
            '/report - Reportar infracción\n\n' +
            '⚠️ Configura TELEGRAM_WEBAPP_URL con una URL HTTPS válida (usa ngrok para desarrollo)');
        return;
    }
    if (!TOKEN) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN no está configurado. Telegram Auto-Wallets no funcionará.');
        await ctx.reply('🎬 ¡Bienvenido a FirstFrame!\n\n' +
            '⚠️ Error: TELEGRAM_BOT_TOKEN no está configurado.\n\n' +
            'Por favor configura el token en tu archivo .env');
        return;
    }
    // Extraer datos del usuario del contexto
    const from = ctx.from;
    if (!from) {
        await ctx.reply('❌ Error: No se pudieron obtener los datos del usuario.');
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
    const telegramAuthToken = jsonwebtoken_1.default.sign({
        ...userData,
        hash,
    }, TOKEN, // Usar el bot token para firmar el JWT
    { algorithm: 'HS256' });
    console.log('[DEBUG] JWT generado para usuario', { id: userData.id, username: userData.username });
    // URL-encode el JWT generado para uso seguro en URL
    const encodedTelegramAuthToken = encodeURIComponent(telegramAuthToken);
    // Crear URL con el token como query parameter
    const webappUrlWithToken = `${LOGIN_URL}/?telegramAuthToken=${encodedTelegramAuthToken}`;
    await ctx.reply('🎬 ¡Bienvenido a FirstFrame!\n\n' +
        'Protege tu contenido audiovisual y gana acceso exclusivo resolviendo rompecabezas.\n\n' +
        'Comandos disponibles:\n' +
        '/upload - Subir video para registro\n' +
        '/puzzle - Jugar rompecabezas\n' +
        '/profile - Ver tu perfil\n' +
        '/claim - Reclamar regalías\n' +
        '/report - Reportar infracción', {
        reply_markup: {
            inline_keyboard: [[
                    { text: '🎮 Abrir Mini App', web_app: { url: webappUrlWithToken } }
                ]]
        }
    });
});
bot.command('upload', async (ctx) => {
    const replyOptions = {};
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
        const telegramAuthToken = jsonwebtoken_1.default.sign({ ...userData, hash }, TOKEN, { algorithm: 'HS256' });
        const encodedToken = encodeURIComponent(telegramAuthToken);
        const url = `${LOGIN_URL}/upload?telegramAuthToken=${encodedToken}`;
        replyOptions.reply_markup = {
            inline_keyboard: [[
                    { text: '📤 Subir Video', web_app: { url } }
                ]]
        };
    }
    await ctx.reply('📤 Para subir un video:\n\n' +
        '1. Envía el video o link del video\n' +
        '2. Proporciona el nombre de la película/serie\n' +
        '3. Proporciona el año de lanzamiento\n\n' +
        'El sistema registrará automáticamente tu contenido como IP en Story Protocol.', replyOptions);
});
bot.command('puzzle', async (ctx) => {
    const replyOptions = {};
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
        const telegramAuthToken = jsonwebtoken_1.default.sign({ ...userData, hash }, TOKEN, { algorithm: 'HS256' });
        const encodedToken = encodeURIComponent(telegramAuthToken);
        const url = `${LOGIN_URL}/puzzle?telegramAuthToken=${encodedToken}`;
        replyOptions.reply_markup = {
            inline_keyboard: [[
                    { text: '🎮 Jugar Ahora', web_app: { url } }
                ]]
        };
    }
    await ctx.reply('🧩 ¡Resuelve el rompecabezas y gana acceso exclusivo!\n\n' +
        'Los primeros en completar el rompecabezas obtienen acceso al canal privado.', replyOptions);
});
bot.command('profile', async (ctx) => {
    const userId = ctx.from?.id;
    // Verificar que userId existe antes de continuar
    if (!userId) {
        await ctx.reply('❌ No se pudo identificar tu usuario.');
        return;
    }
    const replyOptions = {};
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
        const telegramAuthToken = jsonwebtoken_1.default.sign({ ...userData, hash }, TOKEN, { algorithm: 'HS256' });
        const encodedToken = encodeURIComponent(telegramAuthToken);
        const url = `${LOGIN_URL}/profile?telegramAuthToken=${encodedToken}`;
        replyOptions.reply_markup = {
            inline_keyboard: [[
                    { text: '📊 Ver Detalles', web_app: { url } }
                ]]
        };
    }
    // Obtener estadísticas reales del usuario
    // Usar la función directamente en lugar de HTTP para evitar problemas de conexión
    let statsMessage = `👤 Tu Perfil\n\nID: ${userId}\n`;
    try {
        // Importar funciones necesarias
        const { getIPsByUploader } = await Promise.resolve().then(() => __importStar(require('../backend/services/ipRegistry')));
        const { getStoryBalance } = await Promise.resolve().then(() => __importStar(require('../backend/services/balanceService')));
        const { getIPCountByAddress } = await Promise.resolve().then(() => __importStar(require('../backend/services/blockchainIPService')));
        const crypto = require('crypto');
        // Función para generar wallet determinística (mismo algoritmo que el backend)
        function generateDeterministicWallet(telegramUserId) {
            const seed = `firstframe_telegram_${telegramUserId}_wallet_seed_v1`;
            const hash = crypto.createHash('sha256').update(seed).digest('hex');
            return '0x' + hash.substring(0, 40);
        }
        const userWalletAddress = generateDeterministicWallet(userId);
        // Obtener IPs desde la blockchain (fuente de verdad)
        let ipsFromBlockchain = 0;
        try {
            ipsFromBlockchain = await getIPCountByAddress(userWalletAddress);
            console.log(`✅ IPs obtenidos desde blockchain para ${userWalletAddress}: ${ipsFromBlockchain}`);
        }
        catch (blockchainError) {
            console.warn('⚠️  No se pudieron obtener IPs desde blockchain, usando registry local:', blockchainError.message);
            // Fallback: usar registry local
            const uploaderId = `TelegramUser_${userId}`;
            const userIPs = await getIPsByUploader(uploaderId);
            ipsFromBlockchain = userIPs.length;
        }
        // Obtener wallet del usuario para mostrar balance (IP nativo y MockERC20)
        let ipBalance = '0.00';
        let mockTokenBalance = '0.00';
        try {
            const userBalance = await getStoryBalance(userWalletAddress);
            ipBalance = parseFloat(userBalance).toFixed(2);
            // Obtener balance de MockERC20
            const { getTokenBalance, getRoyaltyTokenAddress } = await Promise.resolve().then(() => __importStar(require('../backend/services/tokenBalanceService')));
            const tokenAddress = getRoyaltyTokenAddress();
            const tokenBalance = await getTokenBalance(tokenAddress, userWalletAddress);
            mockTokenBalance = parseFloat(tokenBalance).toFixed(2);
        }
        catch (balanceError) {
            console.warn('No se pudo obtener balance del usuario:', balanceError.message);
            ipBalance = 'N/A';
            mockTokenBalance = 'N/A';
        }
        // Obtener puzzles completados
        let puzzlesCompleted = 0;
        try {
            const { getPuzzleCompletionsCount } = await Promise.resolve().then(() => __importStar(require('../backend/services/puzzleTrackingService')));
            puzzlesCompleted = await getPuzzleCompletionsCount(userId);
        }
        catch (puzzleError) {
            console.warn('No se pudo obtener conteo de puzzles:', puzzleError.message);
        }
        // Obtener regalías pendientes
        let royaltiesPending = '0';
        let royaltiesCount = 0;
        try {
            const { getPendingRoyaltiesByUser } = await Promise.resolve().then(() => __importStar(require('../backend/services/royaltyService')));
            const pendingRoyalties = await getPendingRoyaltiesByUser(userId);
            royaltiesCount = pendingRoyalties.length;
            // Calcular monto total de regalías pendientes
            const totalAmount = pendingRoyalties.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
            royaltiesPending = totalAmount.toFixed(2);
        }
        catch (royaltyError) {
            console.warn('No se pudo obtener regalías pendientes:', royaltyError.message);
        }
        const stats = {
            ipsRegistered: ipsFromBlockchain, // Usar conteo desde blockchain
            puzzlesCompleted: puzzlesCompleted,
            royaltiesPending: royaltiesPending,
            balances: {
                ip: ipBalance,
                mockToken: mockTokenBalance,
            },
        };
        statsMessage += `IPs Registrados: ${stats.ipsRegistered}\n`;
        statsMessage += `Rompecabezas Completados: ${stats.puzzlesCompleted}\n`;
        statsMessage += `Regalías Pendientes: ${stats.royaltiesPending} IP\n\n`;
        statsMessage += `💰 Balances:\n`;
        statsMessage += `   IP Nativo: ${stats.balances.ip} IP (para gas)\n`;
        statsMessage += `   MockERC20: ${stats.balances.mockToken} tokens (para regalías)`;
    }
    catch (error) {
        console.error('Error obteniendo estadísticas del usuario:', error);
        // Fallback si falla
        statsMessage += 'IPs Registrados: 0\n';
        statsMessage += 'Rompecabezas Completados: 0\n';
        statsMessage += 'Regalías Pendientes: 0 IP\n';
        statsMessage += '💰 Balance IP: N/A';
        statsMessage += '\n\n⚠️ No se pudieron cargar las estadísticas completas';
    }
    await ctx.reply(statsMessage, replyOptions);
});
bot.command('claim', async (ctx) => {
    const userId = ctx.from?.id;
    const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
    if (!userId) {
        await ctx.reply('❌ No se pudo identificar tu usuario.');
        return;
    }
    try {
        // Reclamar regalías on-chain
        const API_URL = process.env.API_URL || 'http://localhost:3001/api';
        const claimResponse = await axios_1.default.post(`${API_URL}/royalties/claim`, {
            telegramUserId: userId,
        });
        if (claimResponse.data.success) {
            const { totalAmount, totalClaimed, royaltiesClaimed, balances } = claimResponse.data;
            let message = `✅ Regalías Reclamadas Exitosamente\n\n`;
            message += `💰 Total Reclamado: ${totalClaimed} IP\n`;
            message += `📊 Regalías Procesadas: ${royaltiesClaimed}\n`;
            if (balances) {
                message += `\n📊 Balances:\n`;
                message += `Antes: ${parseFloat(balances.before).toFixed(4)} IP\n`;
                message += `Después: ${parseFloat(balances.after).toFixed(4)} IP\n`;
                message += `Diferencia: ${balances.difference} IP\n`;
            }
            message += `\n💡 Las regalías ya están en tu wallet de Story Testnet.`;
            await ctx.reply(message);
        }
        else {
            await ctx.reply(`ℹ️ ${claimResponse.data.message || 'No tienes regalías reclamables en este momento.'}`);
        }
    }
    catch (error) {
        console.error('Error reclamando regalías:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Error al reclamar regalías';
        await ctx.reply(`❌ Error: ${errorMsg}`);
    }
});
bot.command('report', async (ctx) => {
    const replyOptions = {};
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
        const telegramAuthToken = jsonwebtoken_1.default.sign({ ...userData, hash }, TOKEN, { algorithm: 'HS256' });
        const encodedToken = encodeURIComponent(telegramAuthToken);
        const url = `${LOGIN_URL}/report?telegramAuthToken=${encodedToken}`;
        replyOptions.reply_markup = {
            inline_keyboard: [[
                    { text: '📝 Reportar', web_app: { url } }
                ]]
        };
    }
    await ctx.reply('🚨 Reportar Infracción\n\n' +
        'Si detectas que alguien está usando tu contenido sin autorización, repórtalo aquí.', replyOptions);
});
// Manejo de mensajes con video
bot.on((0, filters_1.message)('video'), async (ctx) => {
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
    const videoLink = `https://t.me/c/${Math.abs(chatId)}/${messageId}`;
    const replyOptions = {};
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
        const telegramAuthToken = jsonwebtoken_1.default.sign({ ...userData, hash }, TOKEN, { algorithm: 'HS256' });
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
                    { text: '📤 Registrar IP', web_app: { url: `${LOGIN_URL}/upload?${params.toString()}` } }
                ]]
        };
    }
    const infoText = `📹 Video detectado:\n\n` +
        `📁 Nombre: ${videoInfo.fileName}\n` +
        (videoInfo.fileSize ? `💾 Tamaño: ${videoInfo.fileSize} MB\n` : '') +
        (videoInfo.duration ? `⏱️ Duración: ${videoInfo.duration} minutos\n` : '') +
        `🔗 Link: ${videoLink}\n\n` +
        `✅ Este video será reenviado al canal privado una vez que lo registres como IP.\n\n` +
        `Para registrar este video como IP, haz clic en "Registrar IP" y completa la información.`;
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
    }
    catch (err) {
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
//# sourceMappingURL=index.js.map