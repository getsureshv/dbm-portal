import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import * as jwt from 'jsonwebtoken';

// In production, use firebase-admin to verify tokens.
// For local dev, we support a bypass mode.

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.jwtSecret = this.config.get('SESSION_SECRET') || 'dev-secret-change-me';
  }

  /**
   * Verify Firebase ID token and upsert user.
   * In dev mode (no Firebase config), accepts a mock token with { email, uid }.
   */
  async createSession(firebaseIdToken: string) {
    let email: string;
    let uid: string;

    const firebaseProjectId = this.config.get('FIREBASE_PROJECT_ID');
    const nodeEnv = this.config.get('NODE_ENV') || 'development';
    const firebasePrivateKey = this.config.get('FIREBASE_PRIVATE_KEY');

    if (nodeEnv !== 'development' && firebaseProjectId && firebasePrivateKey) {
      // Production: verify with Firebase Admin SDK
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseProjectId,
            clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
            privateKey: this.config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
          }),
        });
      }
      const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
      email = decoded.email!;
      uid = decoded.uid;
    } else {
      // Dev mode: parse mock token as JSON { email, uid }
      try {
        const mock = JSON.parse(firebaseIdToken);
        email = mock.email;
        uid = mock.uid;
      } catch {
        throw new UnauthorizedException('Invalid token. In dev mode, send JSON: { "email": "...", "uid": "..." }');
      }
    }

    // Upsert user
    const user = await this.prisma.user.upsert({
      where: { firebaseUid: uid },
      create: { email, firebaseUid: uid },
      update: { email },
    });

    // Sign session JWT
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: '7d' },
    );

    return { user, sessionToken };
  }

  /**
   * Verify session token (from cookie or Bearer header).
   */
  verifySession(token: string): { userId: string; email: string; role: string | null } {
    try {
      return jwt.verify(token, this.jwtSecret) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
