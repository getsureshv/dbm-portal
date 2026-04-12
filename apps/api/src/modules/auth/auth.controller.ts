import { Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('session')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create session from Firebase ID token' })
  async createSession(
    @Body() body: { firebaseIdToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, sessionToken } = await this.authService.createSession(body.firebaseIdToken);

    // Set httpOnly cookie for web
    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        onboardingComplete: user.onboardingComplete,
      },
      // Also return token for mobile (Bearer auth)
      token: sessionToken,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear session' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('session');
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Req() req: Request) {
    const userId = (req as any).userId;
    const user = await this.authService.getUserById(userId);
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        providerType: user.providerType,
        name: user.name,
        phone: user.phone,
        onboardingComplete: user.onboardingComplete,
        verificationStatus: user.verificationStatus,
      },
    };
  }
}
