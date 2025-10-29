import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { storage } from './storage';

// Enforce JWT_SECRET is set - no fallback allowed for security
if (!process.env.JWT_SECRET) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. ' +
    'JWT authentication cannot function securely without a secret key. ' +
    'Please set JWT_SECRET in your environment variables before starting the application.'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = 'shiftmate-app';

export interface JWTPayload {
  userId: number;
  email: string;
  userType?: string;
  role?: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface RefreshTokenData {
  userId: number;
  rememberMe: boolean;
}

export class AuthUtils {
  // Generate access token (short-lived: 15 minutes)
  static async generateAccessToken(userId: number, email: string): Promise<string> {
    // Fetch user details to include userType and role in token
    const user = await storage.getUser(userId);
    
    return jwt.sign(
      {
        userId,
        email,
        userType: user?.userType,
        role: user?.role,
        iss: JWT_ISSUER
      },
      JWT_SECRET,
      {
        expiresIn: '15m'
      }
    );
  }

  // Generate refresh token (cryptographically secure)
  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  // Verify access token
  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Hash a token using SHA-256
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Store refresh token in database
  static async storeRefreshToken(
    token: string, 
    userId: number, 
    rememberMe: boolean
  ): Promise<void> {
    const expiresAt = new Date();
    
    if (rememberMe) {
      // 30 days for "Remember me"
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else {
      // 24 hours for regular sessions
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    // Hash the token before storing
    const tokenHash = this.hashToken(token);

    await storage.createRefreshToken({
      userId,
      tokenHash,
      expiresAt
    });
  }

  // Validate and rotate refresh token
  static async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; newRefreshToken: string } | null> {
    try {
      // Hash the refresh token to find it in database
      const tokenHash = this.hashToken(refreshToken);
      
      // Get refresh token from database
      const tokenRecord = await storage.getRefreshTokenByHash(tokenHash);
      
      if (!tokenRecord || tokenRecord.revokedAt || new Date() > tokenRecord.expiresAt) {
        return null;
      }

      // Get user data
      const user = await storage.getUser(tokenRecord.userId);
      if (!user) {
        return null;
      }

      // Revoke old refresh token
      await storage.revokeRefreshToken(tokenHash);

      // Generate new tokens
      const newAccessToken = await this.generateAccessToken(user.id, user.email);
      const newRefreshToken = this.generateRefreshToken();

      // Determine if it was a "remember me" session (based on original expiry)
      const originalExpiryDays = Math.ceil(
        (tokenRecord.expiresAt.getTime() - tokenRecord.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const wasRememberMe = originalExpiryDays > 7; // If original expiry was more than 7 days

      // Store new refresh token with same expiry pattern
      await this.storeRefreshToken(newRefreshToken, user.id, wasRememberMe);

      return {
        accessToken: newAccessToken,
        newRefreshToken
      };
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      return null;
    }
  }

  // Revoke refresh token (for logout)
  static async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await storage.revokeRefreshToken(tokenHash);
  }

  // Clean up expired tokens (should be run periodically)
  static async cleanupExpiredTokens(): Promise<void> {
    await storage.cleanupExpiredTokens();
  }
}