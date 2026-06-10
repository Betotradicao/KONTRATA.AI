import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { AppDataSource } from './config/database';
import { swaggerSpec } from './config/swagger';

// Core / Auth
import healthRouter from './routes/health.routes';
import authRouter from './routes/auth.routes';
import setupRouter from './routes/setup.routes';
import passwordRecoveryRouter from './routes/password-recovery.routes';
import configRouter from './routes/config.routes';
import configurationsRouter from './routes/configurations.routes';
import systemRouter from './routes/system.routes';
import companiesRouter from './routes/companies.routes';
import sectorsRouter from './routes/sectors.routes';
import employeesRouter from './routes/employees.routes';

// RH
import rhRouter from './routes/rh.routes';
import rhRecrutadorRouter from './routes/rh-recrutador.routes';
import pesquisaClimaRouter from './routes/pesquisa-clima.routes';
import curriculosRouter from './routes/curriculos.routes';
import holidaysRouter from './routes/holidays.routes';
import lgpdRouter from './routes/lgpd.routes';
import accessLogsRouter from './routes/access-logs.routes';
import denunciasRouter from './routes/denuncias.routes';
import { accessLogMiddleware } from './middleware/access-log.middleware';

import { minioService } from './services/minio.service';
import { seedMasterUser } from './database/seeds/masterUser.seed';
import seedConfigurations from './scripts/seed-configurations';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — restringe origens permitidas
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      /\.kontrata\.ai$/,
      /\.prevencaonoradar\.com\.br$/,
      /\.prevencaonoradar\.com$/,
      /^https?:\/\/10\.\d+\.\d+\.\d+/,
      /^https?:\/\/192\.168\.\d+\.\d+/,
      /^https?:\/\/172\.\d+\.\d+\.\d+/,
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
      /\.ngrok\.io$/,
      /\.ngrok-free\.app$/,
      /\.trycloudflare\.com$/,
    ];
    const isAllowed = allowed.some(pattern => pattern.test(origin));
    if (isAllowed) callback(null, true);
    else {
      console.warn(`⚠️ CORS bloqueado: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  // 2000/min em dev pra nao incomodar quando a tela faz N chamadas em
  // paralelo (Banco de Curriculos, filtros, etc). Em producao mantem 200
  // por IP — protege contra abuso.
  max: process.env.NODE_ENV === 'production' ? 200 : 2000,
  message: { error: 'Muitas requisições. Tente novamente em alguns instantes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de log de acesso (LGPD/Marco Civil) — captura toda request
app.use(accessLogMiddleware);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Rotas publicas
app.use('/api/setup', setupRouter);
app.use('/api/password-recovery', passwordRecoveryRouter);

// Rotas protegidas — core/auth
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/config', configRouter);
app.use('/api/configurations', configurationsRouter);
app.use('/api/system', systemRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/sectors', sectorsRouter);
app.use('/api/employees', employeesRouter);

// Rotas RH
app.use('/api/rh', rhRouter);
app.use('/api/recrutador', rhRecrutadorRouter);
app.use('/api/pesquisa-clima', pesquisaClimaRouter);
app.use('/api/curriculos', curriculosRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/lgpd', lgpdRouter);
app.use('/api/access-logs', accessLogsRouter);
app.use('/api/denuncias', denunciasRouter);

// Endpoint generico de upload de imagem usado por varios formularios
// (foto da empresa, foto do colaborador, foto da loja, etc).
// Path "/checklist/upload-imagem" mantido por compatibilidade com o
// frontend que herdou esse caminho do prevencao-radar.
import multer from 'multer';
const uploadImagemMulter = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/checklist/upload-imagem', uploadImagemMulter.single('imagem'), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Arquivo obrigatorio' });
    const ext = (file.originalname || 'jpg').split('.').pop() || 'jpg';
    const objectName = `uploads/imagens/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'image/jpeg');
    res.json({ success: true, url });
  } catch (e: any) {
    console.error('[upload-imagem]:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    await seedConfigurations();
    await seedMasterUser(AppDataSource);

    setInterval(async () => {
      try {
        await AppDataSource.query('SELECT 1');
      } catch (error) {
        console.error('❌ Database connection lost, attempting to reconnect...');
        try {
          if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('✅ Database reconnected successfully');
          }
        } catch (reconnectError) {
          console.error('❌ Failed to reconnect:', reconnectError);
        }
      }
    }, 20000);
  } catch (error) {
    console.warn('⚠️ Database connection failed:', error);
    console.log('Starting server without database connection...');

    setInterval(async () => {
      if (!AppDataSource.isInitialized) {
        try {
          await AppDataSource.initialize();
          console.log('✅ Database connected successfully');
        } catch (retryError: any) {
          console.error('❌ Retry failed:', retryError?.message || retryError);
        }
      }
    }, 30000);
  }

  try {
    await minioService.ensureBucketExists();
    console.log('✅ MinIO initialized successfully');
  } catch (error) {
    console.error('❌ MinIO initialization failed:', error);
    console.log('Continuing without MinIO (uploads will fail)');
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
  });
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 310000;
};

startServer();
