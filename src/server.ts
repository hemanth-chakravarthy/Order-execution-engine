import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import { OrderQueueService } from './services/orderQueue';
import { WebSocketManager } from './services/websocketManager';
import { orderRoutes } from './routes/orders';
import path from 'path';
import fastifyStatic from '@fastify/static';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000');

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register CORS support
  await fastify.register(cors, {
    origin: true, // Allow all origins for development
    credentials: true
  });

  // Serve static files
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/',
  });

  // Register WebSocket support
  await fastify.register(websocket);

  // Initialize services
  const wsManager = new WebSocketManager();
  const queueService = new OrderQueueService(wsManager);

  // Register routes
  await fastify.register(async (instance) => {
    await orderRoutes(instance, queueService, wsManager);
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

async function start() {
  try {
    console.log('🚀 Starting Order Execution Engine...');
    
    // Initialize database
    await initializeDatabase();
    
    // Build and start server
    const fastify = await buildServer();
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} to test the application`);
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

start();