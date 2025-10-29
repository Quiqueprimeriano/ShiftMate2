import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'shiftmate-jwt-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

export interface JWTPayload {
  userId: number;
  email: string;
  name: string;
  userType: string;
  companyId?: number | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiry: Date;
}

/**
 * Generate access token (15 minutes expiry)
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'shiftmate',
    audience: 'shiftmate-api',
  });
}

/**
 * Generate refresh token (30 days expiry)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JWTPayload): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken();
  
  // Calculate refresh token expiry (30 days from now)
  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiry,
  };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'shiftmate',
      audience: 'shiftmate-api',
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Hash refresh token for secure storage
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Verify refresh token hash matches
 */
export function verifyRefreshTokenHash(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
}
