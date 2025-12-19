import { WebSocketManager } from '../src/services/websocketManager';
import { Order, OrderType, OrderStatus } from '../src/types';
import { randomUUID } from 'crypto';

// Mock the database pool
jest.mock('../src/config/database', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    })
  }
}));

// Mock BullMQ to avoid worker issues
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(5),
    getFailedCount: jest.fn().mockResolvedValue(0),
    close: jest.fn().mockResolvedValue(undefined)
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('OrderQueueService', () => {
  // Import after mocks are set up
  const { OrderQueueService } = require('../src/services/orderQueue');
  
  let queueService: any;
  let wsManager: WebSocketManager;

  beforeEach(() => {
    wsManager = new WebSocketManager();
    queueService = new OrderQueueService(wsManager);
  });

  test('should add order to queue', async () => {
    const order: Order = {
      orderId: randomUUID(),
      type: OrderType.MARKET,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0
    };

    await expect(queueService.addOrder(order)).resolves.not.toThrow();
  });

  test('should get queue statistics', async () => {
    const stats = await queueService.getQueueStats();
    
    expect(stats).toHaveProperty('waiting');
    expect(stats).toHaveProperty('active');
    expect(stats).toHaveProperty('completed');
    expect(stats).toHaveProperty('failed');
    
    expect(typeof stats.waiting).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.completed).toBe('number');
    expect(typeof stats.failed).toBe('number');
  });

  test('should handle adding multiple orders', async () => {
    const orders: Order[] = [];
    
    for (let i = 0; i < 5; i++) {
      orders.push({
        orderId: randomUUID(),
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100 + i,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0
      });
    }

    const promises = orders.map(order => queueService.addOrder(order));
    await expect(Promise.all(promises)).resolves.not.toThrow();
  });
});