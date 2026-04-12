import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Try cookie first, then Bearer header (for mobile)
    const token =
      req.cookies?.session ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No session token');
    }

    const payload = this.authService.verifySession(token);
    req.userId = payload.userId;
    req.userRole = payload.role;
    return true;
  }
}
