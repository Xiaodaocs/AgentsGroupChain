import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }
  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** Broadcast any orchestrator event to all clients */
  emitOrchestratorEvent(sessionId: string, event: any) {
    this.server?.emit('orchestrator:event', { sessionId, ...event });
  }

  emitTaskCreated(sessionId: string, taskGraph: any) {
    this.server?.emit('task:created', {
      sessionId,
      nodes: taskGraph.nodes,
      edges: taskGraph.edges,
    });
  }

  emitSessionResult(sessionId: string, aggregatedResult: string) {
    this.server?.emit('session:result', { sessionId, aggregatedResult });
  }
}
