import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { setBotInstance } from '../backend/routes/upload';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Exportar instancia del bot para que el backend pueda usarlo
export { bot };

// Configurar instancia del bot en el módulo de upload
// Nota: Esto se ejecuta cuando se importa este módulo
setBotInstance(bot);

// Comandos básicos
bot.command('start', async (ctx: Context) => {
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  
  if (!webappUrl || webappUrl.includes('localhost')) {
    console.warn('⚠️  TELEGRAM_WEBAPP_URL no está configurado o usa localhost. Los botones de Mini App no funcionarán.');
    await ctx.reply(
      '🎬 ¡Bienvenido a FirstFrame!\n\n' +
      'Protege tu contenido audiovisual y gana acceso exclusivo resolviendo rompecabezas.\n\n' +
      'Comandos disponibles:\n' +
      '/upload - Subir video para registro\n' +
      '/puzzle - Jugar rompecabezas\n' +
      '/profile - Ver tu perfil\n' +
      '/claim - Reclamar regalías\n' +
      '/report - Reportar infracción\n\n' +
      '⚠️ Configura TELEGRAM_WEBAPP_URL con una URL HTTPS válida (usa ngrok para desarrollo)'
    );
    return;
  }
  
  await ctx.reply(
    '🎬 ¡Bienvenido a FirstFrame!\n\n' +
    'Protege tu contenido audiovisual y gana acceso exclusivo resolviendo rompecabezas.\n\n' +
    'Comandos disponibles:\n' +
    '/upload - Subir video para registro\n' +
    '/puzzle - Jugar rompecabezas\n' +
    '/profile - Ver tu perfil\n' +
    '/claim - Reclamar regalías\n' +
    '/report - Reportar infracción',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🎮 Abrir Mini App', web_app: { url: webappUrl } }
        ]]
      }
    }
  );
});

bot.command('upload', async (ctx: Context) => {
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  const replyOptions: any = {};
  
  if (webappUrl && !webappUrl.includes('localhost')) {
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📤 Subir Video', web_app: { url: `${webappUrl}/upload` } }
      ]]
    };
  }
  
  await ctx.reply(
    '📤 Para subir un video:\n\n' +
    '1. Envía el video o link del video\n' +
    '2. Proporciona el nombre de la película/serie\n' +
    '3. Proporciona el año de lanzamiento\n\n' +
    'El sistema registrará automáticamente tu contenido como IP en Story Protocol.',
    replyOptions
  );
});

bot.command('puzzle', async (ctx: Context) => {
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  const replyOptions: any = {};
  
  if (webappUrl && !webappUrl.includes('localhost')) {
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '🎮 Jugar Ahora', web_app: { url: `${webappUrl}/puzzle` } }
      ]]
    };
  }
  
  await ctx.reply(
    '🧩 ¡Resuelve el rompecabezas y gana acceso exclusivo!\n\n' +
    'Los primeros en completar el rompecabezas obtienen acceso al canal privado.',
    replyOptions
  );
});

bot.command('profile', async (ctx: Context) => {
  const userId = ctx.from?.id;
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  const replyOptions: any = {};
  
  if (webappUrl && !webappUrl.includes('localhost')) {
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📊 Ver Detalles', web_app: { url: `${webappUrl}/profile` } }
      ]]
    };
  }
  
  await ctx.reply(
    '👤 Tu Perfil\n\n' +
    `ID: ${userId}\n` +
    'IPs Registrados: 0\n' +
    'Rompecabezas Completados: 0\n' +
    'Regalías Pendientes: 0 $IP',
    replyOptions
  );
});

bot.command('claim', async (ctx: Context) => {
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  const replyOptions: any = {};
  
  if (webappUrl && !webappUrl.includes('localhost')) {
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '💳 Reclamar', web_app: { url: `${webappUrl}/claim` } }
      ]]
    };
  }
  
  await ctx.reply(
    '💰 Reclamar Regalías\n\n' +
    'Tus regalías se distribuyen automáticamente según los términos de licencia.',
    replyOptions
  );
});

bot.command('report', async (ctx: Context) => {
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
  const replyOptions: any = {};
  
  if (webappUrl && !webappUrl.includes('localhost')) {
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📝 Reportar', web_app: { url: `${webappUrl}/report` } }
      ]]
    };
  }
  
  await ctx.reply(
    '🚨 Reportar Infracción\n\n' +
    'Si detectas que alguien está usando tu contenido sin autorización, repórtalo aquí.',
    replyOptions
  );
});

// Manejo de mensajes con video
bot.on(message('video'), async (ctx: Context) => {
  const webappUrl = process.env.TELEGRAM_WEBAPP_URL;
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
  
  if (webappUrl && !webappUrl.includes('localhost')) {
    // Pasar metadatos del video a la webapp
    const webappUrlWithParams = `${webappUrl}/upload?` + new URLSearchParams({
      fileId: videoInfo.fileId,
      fileName: videoInfo.fileName,
      fileSizeMB: videoInfo.fileSize || '',
      durationMinutes: videoInfo.duration?.toString() || '',
      videoLink: videoLink,
    }).toString();
    
    replyOptions.reply_markup = {
      inline_keyboard: [[
        { text: '📤 Registrar IP', web_app: { url: webappUrlWithParams } }
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

