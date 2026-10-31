import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import profiles from './routes/profiles';
import social from './routes/social';
import chats from './routes/chats';
import emergency from './routes/emergency';
import { getAdminApp } from './lib/firebase-admin';

dotenv.config();

const app = express();
getAdminApp();

const allowedOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
];

const corsOrigin = process.env.CORS_ORIGIN === '*' ? true : allowedOrigins;

app.use(
  cors({
    origin: corsOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options('*', cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/profiles', profiles);
app.use('/social', social);
app.use('/chats', chats);
app.use('/emergencyState', emergency);

app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[server] unhandled error:', err);
  res.status(err?.status || 500).json({
    message: err?.message || 'Error interno del servidor',
  });
});

const port = Number(process.env.PORT) || 8085;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
