import { WebSocketManager } from '../src/services/websocketManager';
import { OrderStatus } from '../src/types';

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;
  let mockSocket: any;

  beforeEach(() => {
    wsManager = new WebSocketManager();
    mockSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      close: jest.fn()
    };
  });

  test('should register WebSocket connection', () => {
    const orderId = 'test-order-123';
    
    expect(() => {
      wsManager.register(orderId, mockSocket);
    }).not.toThrow();
  });

  test('should send update through WebSocket', () => {
    const orderId = 'test-order-123';
    wsManager.register(orderId, mockSocket);
    
    const message = {
      orderId,
      status: OrderStatus.PENDING,
      timestamp: new Date()
    };
    
    wsManager.sendUpdate(orderId, message);
    
    expect(mockSocket.send).toHaveBeenCalledTimes(1);
    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  test('should not send update if socket is closed', () => {
    const orderId = 'test-order-123';
    mockSocket.readyState = 3; // CLOSED
    
    wsManager.register(orderId, mockSocket);
    
    const message = {
      orderId,
      status: OrderStatus.PENDING,
      timestamp: new Date()
    };
    
    wsManager.sendUpdate(orderId, message);
    
    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  test('should unregister WebSocket connection', () => {
    const orderId = 'test-order-123';
    wsManager.register(orderId, mockSocket);
    
    wsManager.unregister(orderId);
    
    const message = {
      orderId,
      status: OrderStatus.PENDING,
      timestamp: new Date()
    };
    
    wsManager.sendUpdate(orderId, message);
    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  test('should close connection and unregister', () => {
    const orderId = 'test-order-123';
    wsManager.register(orderId, mockSocket);
    
    wsManager.closeConnection(orderId);
    
    expect(mockSocket.close).toHaveBeenCalledTimes(1);
  });

  test('should handle multiple WebSocket connections', () => {
    const orderIds = ['order-1', 'order-2', 'order-3'];
    const sockets = orderIds.map(() => ({
      readyState: 1,
      send: jest.fn(),
      close: jest.fn()
    }));
    
    orderIds.forEach((orderId, index) => {
      wsManager.register(orderId, sockets[index]);
    });
    
    orderIds.forEach((orderId) => {
      const message = {
        orderId,
        status: OrderStatus.ROUTING,
        timestamp: new Date()
      };
      wsManager.sendUpdate(orderId, message);
    });
    
    sockets.forEach((socket) => {
      expect(socket.send).toHaveBeenCalledTimes(1);
    });
  });
});