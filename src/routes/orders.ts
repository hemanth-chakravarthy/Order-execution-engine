import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { Order, OrderType, OrderStatus } from '../types';
import { OrderQueueService } from '../services/orderQueue';
import { WebSocketManager } from '../services/websocketManager';
import { pool } from '../config/database';

interface OrderExecuteBody {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

export async function orderRoutes(
  fastify: FastifyInstance,
  queueService: OrderQueueService,
  wsManager: WebSocketManager
) {
  // POST /api/orders/execute - Submit order and upgrade to WebSocket
  fastify.route({
    method: 'POST',
    url: '/api/orders/execute',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, tokenIn, tokenOut, amountIn } = request.body;

      // Validate input
      if (!type || !tokenIn || !tokenOut || !amountIn || amountIn <= 0) {
        return reply.code(400).send({ error: 'Invalid order parameters' });
      }

      const orderId = randomUUID();
      const order: Order = {
        orderId,
        type,
        tokenIn,
        tokenOut,
        amountIn,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
      };

      // Save to database
      await pool.query(
        `INSERT INTO orders (order_id, type, token_in, token_out, amount_in, status, created_at, updated_at, attempts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [order.orderId, order.type, order.tokenIn, order.tokenOut, order.amountIn, order.status, order.createdAt, order.updatedAt, order.attempts]
      );

      // Add to queue
      await queueService.addOrder(order);

      // Return orderId and upgrade instructions
      return reply.code(201).send({
        orderId,
        message: 'Order submitted. Connect to WebSocket for live updates.',
        websocketUrl: `/api/orders/${orderId}/ws`
      });
    }
  });

  // WebSocket endpoint for order status updates
  fastify.get('/api/orders/:orderId/ws', { websocket: true }, (socket, request) => {
    const { orderId } = request.params as { orderId: string };
    
    console.log(`🔌 WebSocket connection established for order: ${orderId}`);
    wsManager.register(orderId, socket);

    socket.on('close', () => {
      wsManager.unregister(orderId);
    });

    socket.on('error', (error) => {
      console.error(`WebSocket error for ${orderId}:`, error);
      wsManager.unregister(orderId);
    });
  });

  // WebSocket endpoint for submitting orders via WebSocket
  fastify.get('/api/orders/ws', { websocket: true }, async (socket, request) => {
    console.log(`🔌 WebSocket connection established for order submission`);
    
    socket.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Received WebSocket message:`, message);
        
        const { tokenIn, tokenOut, amount } = message;
        
        // Validation
        if (!tokenIn || !tokenOut || !amount) {
          socket.send(JSON.stringify({
            error: 'Invalid input: tokenIn, tokenOut, and amount are required'
          }));
          return;
        }

        if (tokenIn === tokenOut) {
          socket.send(JSON.stringify({
            error: 'Invalid input: tokenIn and tokenOut cannot be the same'
          }));
          return;
        }

        if (amount <= 0) {
          socket.send(JSON.stringify({
            error: 'Invalid input: amount must be greater than 0'
          }));
          return;
        }

        // Create order
        const orderId = randomUUID();
        const order: Order = {
          orderId,
          type: OrderType.MARKET,
          tokenIn,
          tokenOut,
          amountIn: amount,
          status: OrderStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          attempts: 0,
        };

        // Send initial response with orderId
        socket.send(JSON.stringify({
          orderId,
          message: 'Order submitted successfully',
          status: 'processing'
        }));

        // Register this socket for status updates
        wsManager.register(orderId, socket);

        // Save to database
        await pool.query(
          `INSERT INTO orders (order_id, type, token_in, token_out, amount_in, status, created_at, updated_at, attempts)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [order.orderId, order.type, order.tokenIn, order.tokenOut, order.amountIn, order.status, order.createdAt, order.updatedAt, order.attempts]
        );

        // Add to queue for processing
        await queueService.addOrder(order);

      } catch (error: any) {
        console.error('❌ WebSocket message error:', error);
        socket.send(JSON.stringify({
          error: 'Failed to process order: ' + error.message
        }));
      }
    });

    socket.on('close', () => {
      console.log(`🔌 WebSocket connection closed`);
    });

    socket.on('error', (error) => {
      console.error(`WebSocket error:`, error);
    });
  });

  // GET /api/orders/:orderId - Get order details
  fastify.get('/api/orders/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orderId } = request.params;
    
    const result = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    return reply.send(result.rows[0]);
  });

  // GET /api/orders - List all orders
  fastify.get('/api/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
    return reply.send(result.rows);
  });

  // GET /api/queue/stats - Get queue statistics
  fastify.get('/api/queue/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await queueService.getQueueStats();
    return reply.send(stats);
  });
}