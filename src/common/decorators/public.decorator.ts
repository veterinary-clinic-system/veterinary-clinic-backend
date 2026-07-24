import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a JWT (e.g. login, guest booking, the public
 * free/busy calendar). `JwtAuthGuard` is registered globally in AppModule, so every
 * other route requires auth by default - this is the explicit opt-out.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
