import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { storyRouter } from './routes/story';
import { imdbRouter } from './routes/imdb';
import { puzzleRouter } from './routes/puzzle';
import { ipRouter } from './routes/ip';
import { marketplaceRouter } from './routes/marketplace';
import { uploadRouter } from './routes/upload';
import { walletRouter } from './routes/wallet';
import { balanceRouter } from './routes/balance';
import { userRouter } from './routes/user';
import { royaltiesRouter } from './routes/royalties';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Log del puerto al iniciar
console.log(`📡 Backend configurado para puerto: ${PORT}`);

// Configurar CORS para permitir peticiones desde ngrok y otros dominios
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://localhost:5173',
    /\.ngrok\.io$/,
    /\.ngrok-free\.app$/,
    /\.ngrok\.app$/,
    /\.cloudflared\.net$/,
    /\.loca\.lt$/,
  ],
  credentials: true,
}));
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/story', storyRouter);
app.use('/api/imdb', imdbRouter);
app.use('/api/puzzle', puzzleRouter);
app.use('/api/ip', ipRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/balance', balanceRouter);
app.use('/api/user', userRouter);
app.use('/api/royalties', royaltiesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend iniciado en puerto ${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Puerto ${PORT} ya está en uso.`);
    console.error(`💡 Solución: Cambia el puerto en .env o detén el proceso que usa el puerto ${PORT}`);
    process.exit(1);
  }
  throw err;
});
