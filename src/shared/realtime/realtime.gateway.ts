import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  afterInit() {
    this.logger.log('Realtime WebSocket Gateway initialized on namespace /realtime');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket client disconnected: ${client.id}`);
  }

  /**
   * Phát sự kiện lịch hẹn thay đổi (đặt mới, hủy, đổi trạng thái)
   */
  emitAppointmentChanged(data?: {
    appointmentId?: string;
    branchId?: string;
    doctorId?: string;
    date?: string;
  }) {
    try {
      this.server?.emit('appointment:changed', data ?? {});
    } catch (error) {
      this.logger.error('Failed to emit appointment:changed', error);
    }
  }

  /**
   * Phát sự kiện hàng chờ thay đổi (check-in, walk-in, gọi khám, hoàn tất)
   */
  emitQueueChanged(data?: {
    branchId?: string;
    queueDate?: string;
    ticketNumber?: number;
    status?: string;
  }) {
    try {
      this.server?.emit('queue:changed', data ?? {});
    } catch (error) {
      this.logger.error('Failed to emit queue:changed', error);
    }
  }
}
