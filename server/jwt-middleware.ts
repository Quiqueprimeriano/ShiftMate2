import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from './auth-utils';
import { storage } from './storage';

// Extend Express Request interface
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export const jwtAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = AuthUtils.verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired access token' });
    }

    // Verify user still exists
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email
    };

    next();
  } catch (error) {
    console.error('JWT Auth error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

// Optional auth middleware - doesn't fail if no token provided
export const optionalJwtAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    console.log('OptionalJwtAuth - Authorization header:', authHeader ? 'present' : 'none');
    console.log('OptionalJwtAuth - Token extracted:', token ? 'present' : 'none');

    if (token) {
      const decoded = AuthUtils.verifyAccessToken(token);
      console.log('OptionalJwtAuth - Token decoded:', decoded ? 'success' : 'failed');
      
      if (decoded) {
        const user = await storage.getUser(decoded.userId);
        console.log('OptionalJwtAuth - User found:', user ? `user ${user.id}` : 'not found');
        
        if (user) {
          req.user = {
            id: user.id,
            email: user.email
          };
          console.log('OptionalJwtAuth - User set in request:', req.user.id);
        }
      }
    }

    next();
  } catch (error) {
    console.error('OptionalJwtAuth error:', error);
    // Don't fail, just continue without user
    next();
  }
};