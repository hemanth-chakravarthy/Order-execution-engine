import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Order, OrderStatus } from '../types';
import { MockDexRouter } from './dexRouter';
import { WebSocketManager } from './websocketManager';
import { pool } from '../config/database';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

export class OrderQueueService {
  private queue: Queue;
  private worker: Worker;
  private dexRouter: MockDexRouter;
  private wsManager: WebSocketManager;

  constructor(wsManager: WebSocketManager) {
    this.dexRouter = new MockDexRouter();
    this.wsManager = wsManager;

    this.queue = new Queue('order-execution', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    this.worker = new Worker(
      'order-execution',
      async (job: Job<Order>) => {
        await this.processOrder(job);
      },
      {
        connection,
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ Order ${job.data.orderId} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Order ${job?.data?.orderId} failed:`, err.message);
    });
  }

  async addOrder(order: Order): Promise<void> {
    await this.queue.add('execute-order', order, {
      jobId: order.orderId,
    });
  }

  private async processOrder(job: Job<Order>): Promise<void> {
    const order = job.data;
    console.log(`🔄 Processing order: ${order.orderId}`);

    try {
      await this.updateOrderStatus(order.orderId, OrderStatus.PENDING);

      await this.updateOrderStatus(order.orderId, OrderStatus.ROUTING);
      const bestQuote = await this.dexRouter.getBestQuote(
        order.tokenIn,
        order.tokenOut,
        order.amountIn
      );

      console.log(
        `🎯 Best quote from ${bestQuote.dex}: ${bestQuote.estimatedOutput.toFixed(6)}`
      );

      await this.updateOrderStatus(order.orderId, OrderStatus.BUILDING, {
        dex: bestQuote.dex,
        price: bestQuote.price,
      });

      await this.updateOrderStatus(order.orderId, OrderStatus.SUBMITTED);

      const result = await this.dexRouter.executeSwap(order, bestQuote);

      await this.updateOrderStatus(order.orderId, OrderStatus.CONFIRMED, {
        txHash: result.txHash,
        price: result.executedPrice,
        dex: result.dex,
      });

      await this.saveOrderResult(order.orderId, result);
    } catch (error: any) {
      await this.updateOrderStatus(order.orderId, OrderStatus.FAILED, {
        error: error.message,
      });
      await this.saveOrderError(order.orderId, error.message);
      throw error;
    }
  }

  private async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    data?: any
  ): Promise<void> {
    this.wsManager.sendUpdate(orderId, {
      orderId,
      status,
      timestamp: new Date(),
      data,
    });

    await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
      [status, orderId]
    );
  }

  private async saveOrderResult(orderId: string, result: any): Promise<void> {
    await pool.query(
      `UPDATE orders
       SET dex = $1, executed_price = $2, tx_hash = $3, updated_at = NOW()
       WHERE order_id = $4`,
      [result.dex, result.executedPrice, result.txHash, orderId]
    );
  }

  private async saveOrderError(orderId: string, error: string): Promise<void> {
    await pool.query(
      `UPDATE orders
       SET error = $1, attempts = attempts + 1, updated_at = NOW()
       WHERE order_id = $2`,
      [error, orderId]
    );
  }

  async getQueueStats() {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
  ] = await Promise.all([
    this.queue.getWaitingCount(),
    this.queue.getActiveCount(),
    this.queue.getCompletedCount(),
    this.queue.getFailedCount(),
    this.queue.getDelayedCount(),
  ]);

  return {
    queue: {
      waiting,
      active,
      completed,
      failed,
      delayed,
    },
  };
}

async resetQueue(): Promise<void> {
  // Remove all completed jobs
  await this.queue.clean(0, 10000, 'completed');

  // Remove all failed jobs
  await this.queue.clean(0, 10000, 'failed');

  // Remove waiting & delayed jobs
  await this.queue.clean(0, 10000, 'waiting');
  await this.queue.clean(0, 10000, 'delayed');

  // Remove paused jobs
  await this.queue.clean(0, 10000, 'paused');
}

}
