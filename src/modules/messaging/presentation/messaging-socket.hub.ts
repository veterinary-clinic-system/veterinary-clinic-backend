import { Injectable, Logger } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import { MessagingEventsPort } from '@/modules/messaging/application';

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Bản cài đặt MessagingEventsPort bằng Socket.IO. Tách khỏi gateway để các service không
 * phụ thuộc vào gateway (gateway lại phụ thuộc service) - tránh vòng DI. Gateway gắn
 * namespace vào đây trong afterInit.
 */
@Injectable()
export class MessagingSocketHub extends MessagingEventsPort {
  private readonly logger = new Logger(MessagingSocketHub.name);
  private namespace: Namespace | null = null;

  attach(namespace: Namespace) {
    this.namespace = namespace;
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.namespace) return;
    try {
      const rooms = [...new Set(userIds)].map(userRoom);
      this.namespace.to(rooms).emit(event, payload);
    } catch (error) {
      this.logger.error(`Không phát được ${event}: ${(error as Error).message}`);
    }
  }

  emitToSocket(socketId: string, event: string, payload: unknown): void {
    this.namespace?.to(socketId).emit(event, payload);
  }

  isUserOnline(userId: string): boolean {
    return (this.namespace?.adapter.rooms.get(userRoom(userId))?.size ?? 0) > 0;
  }
}
