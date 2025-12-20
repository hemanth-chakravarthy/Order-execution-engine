import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import path from 'path';
import fastifyStatic from '@fastify/static';

import { initializeDatabase } from './config/database';
import { OrderQueueService } from './services/orderQueue';
import { WebSocketManager } from './services/websocketManager';
import { orderRoutes } from './routes/orders';

dotenv.config();

/* ---------------------------------------------------
   Railway-safe PORT handling
--------------------------------------------------- */
const PORT = Number(process.env.PORT);
if (!PORT) {
  throw new Error('PORT environment variable is not defined');
}

/* ---------------------------------------------------
   Build Fastify server
--------------------------------------------------- */
async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
    },
  });

  /* ---------------- CORS ---------------- */
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  /* ---------------- WebSocket ---------------- */
  await fastify.register(websocket);

  /* ---------------- Health + Debug (MUST be before static) ---------------- */
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/debug', async () => ({
    nodeEnv: process.env.NODE_ENV,
    port: PORT,
    dirname: __dirname,
  }));

  /* ---------------- Static files (SAFE PREFIX) ---------------- */
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/public/', // 🚨 DO NOT use '/'
  });

  /* ---------------- Services ---------------- */
  const wsManager = new WebSocketManager();
  const queueService = new OrderQueueService(wsManager);

  /* ---------------- API Routes ---------------- */
  console.log('🔧 Registering order routes...');
  await fastify.register(async (instance) => {
    await orderRoutes(instance, queueService, wsManager);
  });
  console.log('✅ Order routes registered');

  /* ---------------- Debug: Print Routes ---------------- */
  console.log('📋 Available routes:\n');
  console.log(fastify.printRoutes());

  return fastify;
}

/* ---------------------------------------------------
   Start server
--------------------------------------------------- */
async function start() {
  try {
    console.log('🚀 Starting Order Execution Engine...');
    console.log('🚪 PORT:', PORT);

    await initializeDatabase();

    const fastify = await buildServer();

    await fastify.listen({
      port: PORT,
      host: '0.0.0.0',
    });

    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

/* ---------------------------------------------------
   Graceful shutdown (Railway-friendly)
--------------------------------------------------- */
const shutdown = async () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
