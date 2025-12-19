import { FastifyInstance } from 'fastify';
import { WebSocketMessage } from '../types';

export class WebSocketManager {
  private connections: Map<string, any> = new Map(); // Add <string, any>

  register(orderId: string, socket: any) {
    this.connections.set(orderId, socket);
    console.log(`🔌 WebSocket registered for order: ${orderId}`);
  }

  sendUpdate(orderId: string, message: WebSocketMessage) {
    const socket = this.connections.get(orderId);
    if (socket && socket.readyState === 1) { // 1 = OPEN
      socket.send(JSON.stringify(message));
      console.log(`📤 Sent update for ${orderId}: ${message.status}`);
    }
  }

  unregister(orderId: string) {
    this.connections.delete(orderId);
    console.log(`🔌 WebSocket unregistered for order: ${orderId}`);
  }

  closeConnection(orderId: string) {
    const socket = this.connections.get(orderId);
    if (socket) {
      socket.close();
      this.unregister(orderId);
    }
  }
}