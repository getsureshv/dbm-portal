import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Try cookie first, then Bearer header (for mobile), then a `?token=`
    // query param. The query-param path exists for browser EventSource (SSE)
    // connections, which cannot set custom Authorization headers; it's harmless
    // for normal routes since header/cookie auth is preferred and checked first.
    const token =
      req.cookies?.session ||
      req.headers.authorization?.replace('Bearer ', '') ||
      req.query?.token;

    if (!token) {
      throw new UnauthorizedException('No session token');
    }

    const payload = this.authService.verifySession(token);
    req.userId = payload.userId;
    req.userRole = payload.role;
    return true;
  }
}
