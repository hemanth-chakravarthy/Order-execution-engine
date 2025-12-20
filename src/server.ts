import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000');

async function buildServer() {
  const fastify = Fastify({
    logger: true // Simple logger for production
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // Register WebSocket
  await fastify.register(websocket);

  // Simple health check
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV 
    };
  });

  // Simple WebSocket test
  fastify.get('/ws-simple', { websocket: true }, (socket) => {
    socket.on('message', (msg) => {
      socket.send(JSON.stringify({ received: msg.toString() }));
    });
  });

  return fastify;
}

async function start() {
  try {
    console.log('🚀 Starting simplified server...');
    
    const fastify = await buildServer();
    
    await fastify.listen({ 
      port: PORT, 
      host: '0.0.0.0'
    });

    console.log(`✅ Server running on port ${PORT}`);
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

start();