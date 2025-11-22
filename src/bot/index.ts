import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

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
  const videoLink = `https://t.me/${ctx.from?.username || 'user'}/${ctx.message.message_id}`;
  
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
    `Para registrar este video como IP, proporciona:\n` +
    `1. Nombre de la película/serie\n` +
    `2. Año de lanzamiento\n\n` +
    `O haz clic en "Registrar IP" para usar el asistente completo.`;
  
  await ctx.reply(infoText, replyOptions);
});

// Manejo de errores
bot.catch((err, ctx) => {
  console.error(`Error para ${ctx.updateType}:`, err);
});

// Iniciar bot
bot.launch().then(() => {
  console.log('🤖 Bot de Telegram iniciado');
}).catch((err) => {
  console.error('Error al iniciar bot:', err);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

