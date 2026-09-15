import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export function resolveClientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return request.ip ?? null;
}

export const ClientIp = createParamDecorator((_: unknown, context: ExecutionContext) =>
  resolveClientIp(context.switchToHttp().getRequest<Request>()),
);
