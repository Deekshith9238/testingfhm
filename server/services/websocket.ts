import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { storage } from '../storage';

interface WebSocketClient extends WebSocket {
  userId?: number;
  isAlive: boolean;
}

class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<number, Set<WebSocketClient>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWebSocketServer();

    // Handle upgrade requests
    server.on('upgrade', async (request, socket, head) => {
      try {
        const { query } = parse(request.url || '', true);
        const token = query.token as string;

        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Verify session and get user
        const session = await storage.getSession(token);
        if (!session?.userId) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          const client = ws as WebSocketClient;
          client.userId = session.userId;
          client.isAlive = true;
          this.wss.emit('connection', client, request);
        });
      } catch (error) {
        console.error('WebSocket upgrade error:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocketClient) => {
      const userId = ws.userId;
      if (!userId) return;

      // Add client to clients map
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)?.add(ws);

      // Setup ping-pong
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.get(userId)?.delete(ws);
        if (this.clients.get(userId)?.size === 0) {
          this.clients.delete(userId);
        }
      });
    });

    // Ping all clients every 30 seconds
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) {
          this.clients.get(ws.userId!)?.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  // Send notification to specific user
  async sendToUser(userId: number, data: any) {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const message = JSON.stringify(data);
    userClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Send notification to multiple users
  async sendToUsers(userIds: number[], data: any) {
    const message = JSON.stringify(data);
    userIds.forEach(userId => {
      const userClients = this.clients.get(userId);
      if (!userClients) return;

      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  }
}

let wsService: WebSocketService;

export function setupWebSocket(server: Server) {
  wsService = new WebSocketService(server);
  return wsService;
}

export function getWebSocketService() {
  if (!wsService) {
    throw new Error('WebSocket service not initialized');
  }
  return wsService;
} 