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
   * Supports both real Firebase tokens (Google/Apple sign-in) and
   * dev mock tokens (JSON: { email, uid }) when NODE_ENV=development.
   */
  async createSession(firebaseIdToken: string) {
    let email: string;
    let uid: string;

    const firebaseProjectId = this.config.get('FIREBASE_PROJECT_ID');
    const nodeEnv = this.config.get('NODE_ENV') || 'development';

    // Check if this looks like a dev mock token (starts with '{')
    const isMockToken = firebaseIdToken.trimStart().startsWith('{');

    if (isMockToken && nodeEnv === 'development') {
      // Dev mode: parse mock token as JSON { email, uid }
      try {
        const mock = JSON.parse(firebaseIdToken);
        email = mock.email;
        uid = mock.uid;
        if (!email || !uid) {
          throw new Error('Missing email or uid');
        }
      } catch {
        throw new UnauthorizedException('Invalid mock token. Send JSON: { "email": "...", "uid": "..." }');
      }
    } else if (firebaseProjectId) {
      // Real Firebase token — verify with Firebase Admin SDK
      try {
        const admin = await import('firebase-admin');
        if (!admin.apps.length) {
          const privateKey = this.config.get('FIREBASE_PRIVATE_KEY');
          const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');

          if (privateKey && clientEmail && !privateKey.includes('vZ5vZ5vZ')) {
            // Use service account credentials if they look real
            admin.initializeApp({
              credential: admin.credential.cert({
                projectId: firebaseProjectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
              }),
            });
          } else {
            // Use Application Default Credentials or project ID only
            admin.initializeApp({ projectId: firebaseProjectId });
          }
        }
        const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
        email = decoded.email!;
        uid = decoded.uid;
      } catch (err: any) {
        console.error('Firebase token verification failed:', err.message);
        throw new UnauthorizedException('Invalid Firebase token: ' + (err.message || 'verification failed'));
      }
    } else {
      throw new UnauthorizedException('Firebase is not configured on the server');
    }

    // Upsert user — handle both firebaseUid match and email match
    let user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });

    if (!user) {
      // No user with this firebaseUid — check if email already exists
      // (e.g., user previously logged in via dev mock and now uses Google)
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        // Link the real Firebase UID to the existing account
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { firebaseUid: uid },
        });
      } else {
        // Brand new user
        user = await this.prisma.user.create({
          data: { email, firebaseUid: uid },
        });
      }
    } else {
      // Update email in case it changed
      if (user.email !== email) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { email },
        });
      }
    }

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
