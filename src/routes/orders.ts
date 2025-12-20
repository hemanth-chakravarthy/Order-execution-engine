import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { Order, OrderType, OrderStatus } from '../types';
import { OrderQueueService } from '../services/orderQueue';
import { WebSocketManager } from '../services/websocketManager';
import { pool } from '../config/database';

/* =======================
   Interfaces
======================= */

interface OrderExecuteBody {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
}

interface OrderParams {
  orderId: string;
}

/* =======================
   Routes
======================= */

export async function orderRoutes(
  fastify: FastifyInstance,
  queueService: OrderQueueService,
  wsManager: WebSocketManager
) {

  /* =======================
     POST /api/orders/execute
  ======================= */
  fastify.route({
    method: 'POST',
    url: '/api/orders/execute',
    handler: async (
      request: FastifyRequest<{ Body: OrderExecuteBody }>,
      reply: FastifyReply
    ) => {
      const { type, tokenIn, tokenOut, amountIn } = request.body;

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

      await pool.query(
        `INSERT INTO orders
         (order_id, type, token_in, token_out, amount_in, status, created_at, updated_at, attempts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          order.orderId,
          order.type,
          order.tokenIn,
          order.tokenOut,
          order.amountIn,
          order.status,
          order.createdAt,
          order.updatedAt,
          order.attempts,
        ]
      );

      await queueService.addOrder(order);

      return reply.code(201).send({
        orderId,
        message: 'Order submitted. Connect to WebSocket for live updates.',
        websocketUrl: `/api/orders/${orderId}/ws`,
      });
    },
  });

  /* =======================
     WebSocket: order updates
  ======================= */
  fastify.get('/api/orders/:orderId/ws', { websocket: true }, (socket, request) => {
    const { orderId } = request.params as OrderParams;

    console.log(`🔌 WebSocket connected for order ${orderId}`);
    wsManager.register(orderId, socket);

    socket.on('close', () => {
      wsManager.unregister(orderId);
    });

    socket.on('error', (err) => {
      console.error(`WebSocket error for ${orderId}`, err);
      wsManager.unregister(orderId);
    });
  });

  /* =======================
     WebSocket: submit order
  ======================= */
  fastify.get('/api/orders/ws', { websocket: true }, async (socket) => {
    console.log('🔌 WebSocket connected for order submission');

    socket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const { tokenIn, tokenOut, amount } = message;

        if (!tokenIn || !tokenOut || !amount || amount <= 0) {
          socket.send(JSON.stringify({ error: 'Invalid input' }));
          return;
        }

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

        socket.send(JSON.stringify({
          orderId,
          message: 'Order submitted',
          status: 'processing',
        }));

        wsManager.register(orderId, socket);

        await pool.query(
          `INSERT INTO orders
           (order_id, type, token_in, token_out, amount_in, status, created_at, updated_at, attempts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            order.orderId,
            order.type,
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            order.status,
            order.createdAt,
            order.updatedAt,
            order.attempts,
          ]
        );

        await queueService.addOrder(order);

      } catch (err: any) {
        socket.send(JSON.stringify({ error: err.message }));
      }
    });
  });

  // Test endpoint to verify WebSocket route exists
fastify.get('/api/orders/ws-test', async (request, reply) => {
  return { 
    message: 'WebSocket route is registered',
    endpoint: '/api/orders/ws',
    protocol: 'ws:// or wss://'
  };
});

  /* =======================
     GET /api/orders/:orderId
  ======================= */
  fastify.get(
    '/api/orders/:orderId',
    async (
      request: FastifyRequest<{ Params: OrderParams }>,
      reply: FastifyReply
    ) => {
      const { orderId } = request.params;

      const result = await pool.query(
        'SELECT * FROM orders WHERE order_id = $1',
        [orderId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return reply.send(result.rows[0]);
    }
  );

  /* =======================
     GET /api/orders
  ======================= */
  fastify.get('/api/orders', async (_, reply) => {
    const result = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100'
    );
    return reply.send(result.rows);
  });

  /* =======================
     GET /api/queue/stats
  ======================= */
  fastify.get('/api/queue/stats', async () => {
    const queueStats = await queueService.getQueueStats();

    const totalOrders = await pool.query(
      'SELECT COUNT(*)::int AS total FROM orders'
    );

    const activeOrders = await pool.query(
      "SELECT COUNT(*)::int AS active FROM orders WHERE status NOT IN ('confirmed','failed')"
    );

    return {
      ...queueStats,
      websockets: wsManager.getActiveConnectionsCount(),
      activeOrders: activeOrders.rows[0].active,
      totalOrders: totalOrders.rows[0].total,
    };
  });

  /* =======================
     DELETE /api/queue/reset
  ======================= */
  fastify.delete('/api/queue/reset', async () => {
    await queueService.resetQueue();
    return { message: 'Queue stats reset successfully' };
  });
}
