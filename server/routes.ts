import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { insertUserSchema, insertShiftSchema, insertNotificationSchema } from "@shared/schema";
import { AuthUtils } from "./auth-utils";
import { jwtAuth, optionalJwtAuth } from "./jwt-middleware";
import { sendRosterEmail, sendInvitationEmail } from "./services/sendgrid";
import crypto from "crypto";
import { z } from "zod";
import session from "express-session";
import connectPg from "connect-pg-simple";
import {
  calculateShiftBilling,
  calculateMultipleShiftsBilling,
  formatCurrency,
  calculateShiftDuration,
  calculateWeeknightHours
} from "./billing-engine";
import { rateTiers, publicHolidays, insertRateTierSchema, insertPublicHolidaySchema, insertEmployeeRateSchema } from "@shared/schema";

// Extend the Request interface to include session
interface AuthenticatedRequest extends Request {
  session: any;
  userId?: number;
}

// Configure Google OAuth Strategy
function setupGoogleAuth(callbackURL: string) {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: callbackURL
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        
        if (!email || !name) {
          return done(new Error('Email or name not provided by Google'));
        }

        // Check if user exists
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
          // Create new user
          user = await storage.createUser({ email, name });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));

    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
      try {
        const user = await storage.getUser(id);
        done(null, user);
      } catch (error) {
        done(error);
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cookie parser for refresh tokens
  app.use(cookieParser());

  // Configure session middleware (keeping for Google OAuth compatibility)
  const sessionTtl = 365 * 24 * 60 * 60 * 1000; // 1 year for mobile app
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl, // 1 year for mobile persistence
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-origin for mobile apps
    }
  }));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Determine the base URL for OAuth callback
  const getCallbackURL = (req: Request) => {
    // Use REPLIT_DEV_DOMAIN if in development on Replit
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`;
    }
    // Use explicit callback URL if set
    if (process.env.GOOGLE_CALLBACK_URL) {
      return process.env.GOOGLE_CALLBACK_URL;
    }
    // Fallback to constructing from request
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}/api/auth/google/callback`;
  };

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    // Setup Google OAuth with correct callback URL for this request
    const callbackURL = getCallbackURL(req);
    setupGoogleAuth(callbackURL);
    
    // Store the intent (login or signup) in session
    (req.session as any).authIntent = req.query.intent || 'login';
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get("/api/auth/google/callback", 
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed', session: false }),
    async (req, res) => {
      try {
        const user = req.user as any;
        
        if (!user) {
          return res.redirect('/login?error=no_user');
        }

        // Generate JWT tokens
        const accessToken = await AuthUtils.generateAccessToken(user.id, user.email);
        const refreshToken = AuthUtils.generateRefreshToken();

        // Store refresh token (30 days expiry)
        await AuthUtils.storeRefreshToken(refreshToken, user.id, true);

        // Set refresh token as httpOnly cookie (30 days)
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        // Redirect to frontend with access token in URL fragment
        // The frontend will extract and store the token
        res.redirect(`/?token=${accessToken}`);
      } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        res.redirect('/login?error=token_generation_failed');
      }
    }
  );

  // JWT-based auth routes with persistent login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, name, rememberMe = false } = req.body;
      
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // User doesn't exist, create them automatically
        user = await storage.createUser({ email, name });
      }

      // Generate tokens
      const accessToken = await AuthUtils.generateAccessToken(user.id, user.email);
      const refreshToken = AuthUtils.generateRefreshToken();

      // Store refresh token
      await AuthUtils.storeRefreshToken(refreshToken, user.id, rememberMe);

      // Set refresh token as httpOnly cookie
      const cookieExpiry = rememberMe 
        ? 30 * 24 * 60 * 60 * 1000  // 30 days
        : 24 * 60 * 60 * 1000;      // 24 hours

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieExpiry
      });

      res.json({ 
        user, 
        accessToken,
        expiresIn: '15m' // Access token expiry
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, name } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        res.status(409).json({ message: "User already exists. Please log in instead." });
      } else {
        // Create new user
        const newUser = await storage.createUser({ email, name });
        (req.session as any).userId = newUser.id;
        res.json({ user: newUser });
      }
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: "Signup failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Refresh token endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.cookies;
      
      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token not provided" });
      }

      const result = await AuthUtils.refreshTokens(refreshToken);
      
      if (!result) {
        // Clear invalid cookie
        res.clearCookie('refreshToken');
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      // Update refresh token cookie
      res.cookie('refreshToken', result.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({
        accessToken: result.accessToken,
        expiresIn: '15m'
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({ message: "Token refresh failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { refreshToken } = req.cookies;
      
      if (refreshToken) {
        // Revoke the refresh token
        await AuthUtils.revokeRefreshToken(refreshToken);
      }

      // Clear cookies
      res.clearCookie('refreshToken');
      res.clearCookie('connect.sid');
      
      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
      });

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // New JWT-based auth check endpoint
  app.get("/api/auth/me", optionalJwtAuth, async (req, res) => {
    // First try JWT auth
    if (req.user) {
      try {
        const user = await storage.getUser(req.user.id);
        if (user) {
          return res.json({ user });
        }
      } catch (error) {
        console.error('JWT auth me error:', error);
      }
    }

    // Fall back to session-based auth for backward compatibility
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      (req.session as any).touch();
      res.json({ user });
    } catch (error) {
      console.error('Session auth me error:', error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Enhanced middleware to check both JWT and session authentication
  const requireAuth = (req: any, res: any, next: any) => {
    // First check JWT auth (from middleware)
    if (req.user?.id) {
      req.userId = req.user.id;
      return next();
    }

    // Fall back to session-based auth for backward compatibility
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    req.userId = userId;
    next();
  };

  // Shift routes - support both JWT and session auth
  app.get("/api/shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByUser(req.userId);
      }

      res.json(shifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get shifts" });
    }
  });

  app.post("/api/shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      // Get user data to access their companyId
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const shiftData = insertShiftSchema.parse({
        ...req.body,
        userId: req.userId,
        companyId: user.companyId // Automatically associate with user's company
      });

      const shift = await storage.createShift(shiftData);
      res.status(201).json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create shift" });
    }
  });

  app.put("/api/shifts/:id", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get user data to ensure companyId is maintained
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Verify the user owns this shift or is a manager in the same company
      const existingShift = await storage.getShift(id);
      if (!existingShift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Check authorization: user must own the shift or be a manager in the same company
      const isOwner = existingShift.userId === req.userId;
      const isCompanyManager = user.companyId && existingShift.companyId === user.companyId &&
                               (user.role === 'manager' || user.userType === 'business');

      if (!isOwner && !isCompanyManager) {
        return res.status(403).json({ message: "Not authorized to modify this shift" });
      }

      const shiftData = insertShiftSchema.partial().parse({
        ...req.body,
        // Ensure companyId is preserved/set during updates
        companyId: user.companyId
      });

      const shift = await storage.updateShift(id, shiftData);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update shift" });
    }
  });

  app.delete("/api/shifts/:id", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get user data for authorization check
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Verify the user owns this shift or is a manager in the same company
      const existingShift = await storage.getShift(id);
      if (!existingShift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Check authorization: user must own the shift or be a manager in the same company
      const isOwner = existingShift.userId === req.userId;
      const isCompanyManager = user.companyId && existingShift.companyId === user.companyId &&
                               (user.role === 'manager' || user.userType === 'business');

      if (!isOwner && !isCompanyManager) {
        return res.status(403).json({ message: "Not authorized to delete this shift" });
      }

      const success = await storage.deleteShift(id);

      if (!success) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json({ message: "Shift deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete shift" });
    }
  });

  // New endpoints to separate personal shifts from roster shifts
  
  // GET /api/personal-shifts - Get shifts created by the user themselves
  app.get("/api/personal-shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByUser(req.userId);
      }

      // Filter to only personal shifts (created by user themselves or createdBy is null)
      const personalShifts = shifts.filter((shift: any) =>
        !shift.createdBy || shift.createdBy === req.userId
      );

      res.json(personalShifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get personal shifts" });
    }
  });

  // GET /api/roster-shifts - Get shifts assigned to the user by managers
  app.get("/api/roster-shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByUser(req.userId);
      }

      // Filter to only roster shifts (created by someone else - managers)
      const rosterShifts = shifts.filter((shift: any) =>
        shift.createdBy && shift.createdBy !== req.userId
      );

      res.json(rosterShifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get roster shifts" });
    }
  });

  // Helper function to check if user is a manager
  const isManager = async (userId: number): Promise<boolean> => {
    try {
      const user = await storage.getUser(userId);
      return user?.role === 'manager' || user?.userType === 'business';
    } catch {
      return false;
    }
  };

  // Roster Management Routes - Manager only
  
  // GET /api/roster - Get full team shifts for managers (only roster shifts, not employee-uploaded)
  app.get("/api/roster", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      if (!(await isManager(req.userId))) {
        return res.status(403).json({ message: "Manager access required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "Company not found" });
      }

      const { startDate, endDate } = req.query;

      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByCompanyAndDateRange(user.companyId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByCompany(user.companyId);
      }

      // Filter to only show roster shifts (created by managers, not employee-uploaded)
      // Roster shifts have createdBy set and createdBy !== userId (manager created for employee)
      const rosterShifts = shifts.filter((shift: any) =>
        shift.createdBy && shift.createdBy !== shift.userId
      );

      res.json(rosterShifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get roster shifts" });
    }
  });

  // POST /api/roster/shifts - Assign shifts to employees (bulk or single)
  app.post("/api/roster/shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      if (!(await isManager(req.userId))) {
        return res.status(403).json({ message: "Manager access required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "Company not found" });
      }

      const { shifts: shiftsToCreate } = req.body;
      
      // Handle both single shift and bulk shifts
      const shiftsArray = Array.isArray(shiftsToCreate) ? shiftsToCreate : [shiftsToCreate || req.body];
      
      // Helper to parse time and handle overnight shifts
      const parseTimeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const checkOverlap = (s1: number, e1: number, isOvernight1: boolean, s2: number, e2: number, isOvernight2: boolean) => {
        if (!isOvernight1 && !isOvernight2) {
          return s1 < e2 && e1 > s2;
        }
        if (isOvernight1 && !isOvernight2) {
          return (s2 < 1440 && e2 > s1) || (s2 < e1);
        }
        if (!isOvernight1 && isOvernight2) {
          return (s1 < 1440 && e1 > s2) || (s1 < e2);
        }
        return true;
      };

      // Phase 1: Validate all shifts first (before any DB writes)
      const validatedShifts = [];
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

      for (const shiftData of shiftsArray) {
        // Validate required fields
        if (!shiftData.startTime || !shiftData.endTime) {
          return res.status(400).json({ message: 'Start time and end time are required' });
        }

        // Validate time format (HH:MM)
        if (!timeRegex.test(shiftData.startTime) || !timeRegex.test(shiftData.endTime)) {
          return res.status(400).json({ message: 'Invalid time format. Use HH:MM format (e.g., 09:00, 23:30)' });
        }

        // Validate start time is not the same as end time
        if (shiftData.startTime === shiftData.endTime) {
          return res.status(400).json({ message: 'Start time and end time cannot be the same' });
        }

        // Validate employee belongs to same company
        const employee = await storage.getUser(shiftData.userId);
        if (!employee || employee.companyId !== user.companyId) {
          return res.status(403).json({
            message: `Employee ${shiftData.userId} not found or not in your company`
          });
        }

        // Check for overlapping shifts for this employee
        const existingShifts = await storage.getShiftsByUserAndDate(shiftData.userId, shiftData.date);
        const newStartMins = parseTimeToMinutes(shiftData.startTime);
        const newEndMins = parseTimeToMinutes(shiftData.endTime);
        const newIsOvernight = newEndMins < newStartMins;

        const hasOverlap = existingShifts.some(existing => {
          const existingStartMins = parseTimeToMinutes(existing.startTime);
          const existingEndMins = parseTimeToMinutes(existing.endTime);
          const existingIsOvernight = existingEndMins < existingStartMins;
          return checkOverlap(newStartMins, newEndMins, newIsOvernight, existingStartMins, existingEndMins, existingIsOvernight);
        });

        if (hasOverlap) {
          return res.status(409).json({
            message: `Shift overlaps with existing shift for employee ${employee.name} on ${shiftData.date}`
          });
        }

        // Parse and validate with zod schema
        const processedShiftData = insertShiftSchema.parse({
          ...shiftData,
          companyId: user.companyId,
          createdBy: req.userId,
          status: 'scheduled'
        });

        validatedShifts.push(processedShiftData);
      }

      // Phase 2: Batch insert all validated shifts at once
      let createdShifts;
      if (validatedShifts.length === 1) {
        // Single shift - use regular create
        const shift = await storage.createShift(validatedShifts[0]);
        createdShifts = [shift];
      } else {
        // Multiple shifts - use bulk insert for better performance
        createdShifts = await storage.createBulkShifts(validatedShifts);
      }

      res.status(201).json(createdShifts.length === 1 ? createdShifts[0] : createdShifts);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create roster shifts" });
    }
  });

  // PUT /api/roster/shifts/:id - Edit assigned shift (manager only)
  app.put("/api/roster/shifts/:id", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      if (!(await isManager(req.userId))) {
        return res.status(403).json({ message: "Manager access required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "Company not found" });
      }

      const id = parseInt(req.params.id);
      
      // Verify shift belongs to manager's company
      const existingShift = await storage.getShift(id);
      if (!existingShift || existingShift.companyId !== user.companyId) {
        return res.status(404).json({ message: "Shift not found or access denied" });
      }

      const shiftData = insertShiftSchema.partial().parse({
        ...req.body,
        companyId: user.companyId,
        createdBy: req.userId
      });

      const shift = await storage.updateShift(id, shiftData);
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update roster shift" });
    }
  });

  // DELETE /api/roster/shifts/:id - Delete assigned shift (manager only)
  app.delete("/api/roster/shifts/:id", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      if (!(await isManager(req.userId))) {
        return res.status(403).json({ message: "Manager access required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "Company not found" });
      }

      const id = parseInt(req.params.id);

      // Verify shift belongs to manager's company
      const existingShift = await storage.getShift(id);
      if (!existingShift || existingShift.companyId !== user.companyId) {
        return res.status(404).json({ message: "Shift not found or access denied" });
      }

      const success = await storage.deleteShift(id);

      if (!success) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json({ message: "Roster shift deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete roster shift" });
    }
  });

  // POST /api/roster/copy-week - Copy roster from source week to target week (AC-005-7)
  app.post("/api/roster/copy-week", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      if (!(await isManager(req.userId))) {
        return res.status(403).json({ message: "Manager access required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "Company not found" });
      }

      const { sourceWeekStart, targetWeekStart } = req.body;

      if (!sourceWeekStart || !targetWeekStart) {
        return res.status(400).json({ message: "sourceWeekStart and targetWeekStart are required" });
      }

      // Get source week shifts
      const sourceStart = new Date(sourceWeekStart);
      const sourceEnd = new Date(sourceStart);
      sourceEnd.setDate(sourceEnd.getDate() + 6);

      const sourceShifts = await storage.getShiftsByCompanyAndDateRange(
        user.companyId,
        sourceWeekStart,
        sourceEnd.toISOString().split('T')[0]
      );

      if (sourceShifts.length === 0) {
        return res.status(400).json({ message: "No shifts found in source week to copy" });
      }

      // Calculate days offset between source and target
      const targetStart = new Date(targetWeekStart);
      const daysDiff = Math.round((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

      // Create new shifts for target week
      const newShifts = sourceShifts.map((shift: any) => {
        const shiftDate = new Date(shift.date);
        shiftDate.setDate(shiftDate.getDate() + daysDiff);

        return {
          userId: shift.userId,
          companyId: user.companyId,
          date: shiftDate.toISOString().split('T')[0],
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType,
          location: shift.location,
          notes: shift.notes,
          createdBy: req.userId,
          status: 'scheduled'
        };
      });

      // Bulk insert the new shifts
      const createdShifts = await storage.createBulkShifts(newShifts);

      res.status(201).json({
        message: `Successfully copied ${createdShifts.length} shifts from source week`,
        shifts: createdShifts
      });
    } catch (error) {
      console.error("Error copying roster week:", error);
      res.status(500).json({ message: "Failed to copy roster week" });
    }
  });

  // GET /api/my-shifts - Get own assigned shifts for employees
  app.get("/api/my-shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate, status } = req.query;
      
      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByUser(req.userId);
      }
      
      // Filter by status if provided (e.g., only 'scheduled' shifts)
      if (status) {
        shifts = shifts.filter(shift => shift.status === status);
      }
      
      res.json(shifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get assigned shifts" });
    }
  });

  // Analytics routes - support both JWT and session auth
  app.get("/api/analytics/weekly-hours", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const hours = await storage.getWeeklyHours(req.userId, startDate, endDate);
      res.json({ hours });
    } catch (error) {
      res.status(500).json({ message: "Failed to get weekly hours" });
    }
  });

  app.get("/api/analytics/daily-average", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const average = await storage.getDailyAverage(req.userId, startDate, endDate);
      res.json({ average });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily average" });
    }
  });

  app.get("/api/analytics/missing-entries", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const missingDates = await storage.getMissingEntries(req.userId, startDate, endDate);
      res.json({ missingDates });
    } catch (error) {
      res.status(500).json({ message: "Failed to get missing entries" });
    }
  });

  // ============================================
  // My Rates & Earnings - Individual User Routes
  // ============================================

  // GET /api/my-rates - Get current user's rates
  app.get("/api/my-rates", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const rates = await storage.getEmployeeRates(req.userId);
      if (!rates) {
        // Return default rates if none set
        return res.json({
          userId: req.userId,
          weekdayRate: 0,
          weeknightRate: 0,
          saturdayRate: 0,
          sundayRate: 0,
          publicHolidayRate: 0,
          currency: "USD"
        });
      }
      res.json(rates);
    } catch (error) {
      console.error("Error fetching my rates:", error);
      res.status(500).json({ message: "Failed to fetch rates" });
    }
  });

  // Note: Rate editing is admin-only via /api/employee-rates/:userId endpoints

  // GET /api/my-earnings - Get current user's earnings summary
  app.get("/api/my-earnings", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      // Get user's shifts for date range
      const allShifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate as string, endDate as string);

      // Filter to only include user-uploaded shifts (not roster shifts)
      const shifts = allShifts.filter(shift =>
        shift.createdBy === null || shift.createdBy === req.userId
      );

      if (shifts.length === 0) {
        return res.json({
          totalHours: 0,
          totalEarnings: 0,
          shiftsCount: 0,
          breakdown: {
            weekday: { hours: 0, amount: 0 },
            weeknight: { hours: 0, amount: 0 },
            saturday: { hours: 0, amount: 0 },
            sunday: { hours: 0, amount: 0 },
            publicHoliday: { hours: 0, amount: 0 }
          },
          shifts: []
        });
      }

      // Get user's rates
      const rates = await storage.getEmployeeRates(req.userId);
      const defaultRates = {
        weekdayRate: 0,
        weeknightRate: 0,
        saturdayRate: 0,
        sundayRate: 0,
        publicHolidayRate: 0
      };
      const userRates = rates || defaultRates;

      // Calculate earnings for each shift
      let totalHours = 0;
      let totalEarnings = 0;
      const breakdown = {
        weekday: { hours: 0, amount: 0 },
        weeknight: { hours: 0, amount: 0 },
        saturday: { hours: 0, amount: 0 },
        sunday: { hours: 0, amount: 0 },
        publicHoliday: { hours: 0, amount: 0 }
      };

      const shiftDetails = [];

      // Get public holidays once before the loop
      const allHolidays = await storage.getAllPublicHolidays();
      const holidays = allHolidays.map((h: any) => h.date);

      for (const shift of shifts) {
        const duration = calculateShiftDuration(shift.startTime, shift.endTime);
        totalHours += duration;

        // Determine day type
        const shiftDate = new Date(shift.date);
        const dayOfWeek = shiftDate.getDay();
        const isPublicHoliday = holidays.includes(shift.date);

        let rateType: string;
        let rate: number;

        if (isPublicHoliday) {
          rateType = 'publicHoliday';
          rate = userRates.publicHolidayRate;
          breakdown.publicHoliday.hours += duration;
          breakdown.publicHoliday.amount += duration * rate;
        } else if (dayOfWeek === 0) {
          rateType = 'sunday';
          rate = userRates.sundayRate;
          breakdown.sunday.hours += duration;
          breakdown.sunday.amount += duration * rate;
        } else if (dayOfWeek === 6) {
          rateType = 'saturday';
          rate = userRates.saturdayRate;
          breakdown.saturday.hours += duration;
          breakdown.saturday.amount += duration * rate;
        } else {
          // Weekday - check for weeknight hours (after 7pm) using split billing
          const weeknightHours = calculateWeeknightHours(shift.startTime, shift.endTime);

          if (weeknightHours > 0 && weeknightHours < duration) {
            // Split billing: part weekday, part weeknight
            const weekdayHours = duration - weeknightHours;

            // Add weekday hours
            breakdown.weekday.hours += weekdayHours;
            breakdown.weekday.amount += weekdayHours * userRates.weekdayRate;

            // Add weeknight hours
            breakdown.weeknight.hours += weeknightHours;
            breakdown.weeknight.amount += weeknightHours * userRates.weeknightRate;

            // Calculate total earnings for this shift with split
            const shiftEarnings = (weekdayHours * userRates.weekdayRate) +
                                  (weeknightHours * userRates.weeknightRate);
            totalEarnings += shiftEarnings;

            shiftDetails.push({
              id: shift.id,
              date: shift.date,
              startTime: shift.startTime,
              endTime: shift.endTime,
              shiftType: shift.shiftType,
              hours: duration,
              rateType: 'weekday/weeknight',
              rate: userRates.weekdayRate,
              earnings: shiftEarnings,
              weekdayHours,
              weeknightHours
            });

            continue; // Skip the normal earnings calculation below

          } else if (weeknightHours >= duration) {
            // Entire shift is weeknight (starts after 7pm)
            rateType = 'weeknight';
            rate = userRates.weeknightRate;
            breakdown.weeknight.hours += duration;
            breakdown.weeknight.amount += duration * rate;
          } else {
            // Entire shift is weekday (ends before 7pm)
            rateType = 'weekday';
            rate = userRates.weekdayRate;
            breakdown.weekday.hours += duration;
            breakdown.weekday.amount += duration * rate;
          }
        }

        const earnings = duration * rate;
        totalEarnings += earnings;

        shiftDetails.push({
          id: shift.id,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType,
          hours: duration,
          rateType,
          rate,
          earnings
        });
      }

      // Convert breakdown object to array format expected by frontend
      const breakdownArray = Object.entries(breakdown)
        .filter(([_, data]) => (data as any).hours > 0)
        .map(([type, data]) => {
          const typedData = data as { hours: number; amount: number };
          let rate: number;
          switch (type) {
            case 'weekday': rate = userRates.weekdayRate; break;
            case 'weeknight': rate = userRates.weeknightRate; break;
            case 'saturday': rate = userRates.saturdayRate; break;
            case 'sunday': rate = userRates.sundayRate; break;
            case 'publicHoliday': rate = userRates.publicHolidayRate; break;
            default: rate = 0;
          }
          return {
            type,
            hours: typedData.hours,
            rate,
            earnings: typedData.amount
          };
        });

      res.json({
        totalHours,
        totalEarnings,
        shiftsCount: shifts.length,
        breakdown: breakdownArray,
        shifts: shiftDetails,
        currency: (rates as any)?.currency || 'USD',
        periodStart: startDate,
        periodEnd: endDate
      });
    } catch (error) {
      console.error("Error calculating my earnings:", error);
      res.status(500).json({ message: "Failed to calculate earnings" });
    }
  });

  // Billing routes - support both JWT and session auth
  app.get("/api/billing/shift/:id", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const shift = await storage.getShift(shiftId);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // Verify user owns this shift or is a manager in the same company
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      if (shift.userId !== req.userId && shift.companyId !== user.companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const billing = await calculateShiftBilling(
        shift.id,
        shift.userId, // Use employee's ID for employee-specific rates
        shift.date,
        shift.startTime,
        shift.endTime,
        shift.shiftType
      );
      
      res.json(billing);
    } catch (error) {
      console.error("Error calculating shift billing:", error);
      res.status(500).json({ message: "Failed to calculate shift billing" });
    }
  });

  app.get("/api/billing/shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      const shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      
      if (shifts.length === 0) {
        return res.json([]);
      }
      
      const billingData = await calculateMultipleShiftsBilling(
        shifts.map(shift => ({
          id: shift.id,
          userId: shift.userId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType
        }))
      );
      
      res.json(billingData);
    } catch (error) {
      console.error("Error calculating shifts billing:", error);
      res.status(500).json({ message: "Failed to calculate shifts billing" });
    }
  });

  // Employee billing report endpoint for managers
  app.get("/api/billing/employee-report", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { employeeId, startDate, endDate } = req.query;
      
      if (!employeeId || !startDate || !endDate) {
        return res.status(400).json({ message: "employeeId, startDate and endDate are required" });
      }
      
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only business users, managers and business owners can generate employee reports
      if (user.userType !== 'business' && user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager access required" });
      }
      
      // Get employee details
      const employee = await storage.getUser(parseInt(employeeId));
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Verify employee belongs to same company
      if (employee.companyId !== user.companyId) {
        return res.status(403).json({ message: "Access denied to employee in different company" });
      }
      
      // Get employee shifts for date range (exclude roster shifts)
      const allShifts = await storage.getShiftsByUserAndDateRange(parseInt(employeeId), startDate, endDate);
      
      // Filter to only include uploaded shifts (exclude roster/scheduled shifts)
      // Include shifts where createdBy is null or equals the employee's ID
      const shifts = allShifts.filter(shift => 
        shift.createdBy === null || shift.createdBy === parseInt(employeeId)
      );
      
      if (shifts.length === 0) {
        return res.json({
          employee: {
            id: employee.id,
            name: employee.name,
            email: employee.email
          },
          period: { startDate, endDate },
          shifts: [],
          summary: {
            totalHours: 0,
            weekdayHours: 0,
            weeknightHours: 0,
            saturdayHours: 0,
            sundayHours: 0,
            publicHolidayHours: 0,
            totalAmount: 0,
            weekdayAmount: 0,
            weeknightAmount: 0,
            saturdayAmount: 0,
            sundayAmount: 0,
            publicHolidayAmount: 0
          }
        });
      }
      
      // Calculate detailed billing for each shift
      const billingData = await calculateMultipleShiftsBilling(
        shifts.map(shift => ({
          id: shift.id,
          userId: shift.userId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType
        }))
      );
      
      // Calculate summary by rate type
      let summary = {
        totalHours: 0,
        weekdayHours: 0,
        weeknightHours: 0,
        saturdayHours: 0,
        sundayHours: 0,
        publicHolidayHours: 0,
        totalAmount: 0,
        weekdayAmount: 0,
        weeknightAmount: 0,
        saturdayAmount: 0,
        sundayAmount: 0,
        publicHolidayAmount: 0
      };
      
      billingData.forEach(billing => {
        summary.totalHours += billing.total_hours;
        summary.totalAmount += billing.total_amount;
        
        // Handle split billing (weekday/weeknight) by processing billing array entries
        if (billing.day_type === 'weekday/weeknight') {
          billing.billing.forEach(entry => {
            // Determine rate type based on the rate used
            // In split billing, first entry is weekday, second is weeknight
            const isWeeknightRate = entry.rate > billing.billing[0].rate;
            if (isWeeknightRate) {
              summary.weeknightHours += entry.hours;
              summary.weeknightAmount += entry.subtotal;
            } else {
              summary.weekdayHours += entry.hours;
              summary.weekdayAmount += entry.subtotal;
            }
          });
        } else {
          // Add to specific rate type totals for non-split billing
          switch (billing.day_type) {
            case 'weekday':
              summary.weekdayHours += billing.total_hours;
              summary.weekdayAmount += billing.total_amount;
              break;
            case 'weeknight':
              summary.weeknightHours += billing.total_hours;
              summary.weeknightAmount += billing.total_amount;
              break;
            case 'saturday':
              summary.saturdayHours += billing.total_hours;
              summary.saturdayAmount += billing.total_amount;
              break;
            case 'sunday':
              summary.sundayHours += billing.total_hours;
              summary.sundayAmount += billing.total_amount;
              break;
            case 'publicHoliday':
              summary.publicHolidayHours += billing.total_hours;
              summary.publicHolidayAmount += billing.total_amount;
              break;
          }
        }
      });
      
      res.json({
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email
        },
        period: { startDate, endDate },
        shifts: billingData,
        summary
      });
    } catch (error) {
      console.error("Error generating employee billing report:", error);
      res.status(500).json({ message: "Failed to generate employee billing report" });
    }
  });

  app.get("/api/rate-tiers", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const companyId = user.companyId || 1; // fallback for individual users
      
      const rateTiers = await storage.getRateTiersByCompany(companyId);
      
      res.json(rateTiers);
    } catch (error) {
      console.error("Error fetching rate tiers:", error);
      res.status(500).json({ message: "Failed to fetch rate tiers" });
    }
  });

  app.post("/api/rate-tiers", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only managers and business owners can create rate tiers
      const isBusinessOwner = user.userType === 'business' || user.userType === 'business_owner';
      const isManagerOrOwner = user.role === 'manager' || user.role === 'owner';
      if (!isBusinessOwner && !isManagerOrOwner) {
        return res.status(403).json({ message: "Only managers can create rate tiers" });
      }
      
      const rateTierData = insertRateTierSchema.parse({
        ...req.body,
        companyId: user.companyId || 1
      });
      
      const result = await storage.createRateTier(rateTierData);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rate tier data", errors: error.errors });
      }
      console.error("Error creating rate tier:", error);
      res.status(500).json({ message: "Failed to create rate tier" });
    }
  });

  app.get("/api/public-holidays", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const holidays = await storage.getAllPublicHolidays();
      
      res.json(holidays);
    } catch (error) {
      console.error("Error fetching public holidays:", error);
      res.status(500).json({ message: "Failed to fetch public holidays" });
    }
  });

  app.post("/api/public-holidays", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only managers and business owners can add public holidays
      const isBusinessOwner = user.userType === 'business' || user.userType === 'business_owner';
      const isManagerOrOwner = user.role === 'manager' || user.role === 'owner';
      if (!isBusinessOwner && !isManagerOrOwner) {
        return res.status(403).json({ message: "Only managers can add public holidays" });
      }
      
      const holidayData = insertPublicHolidaySchema.parse(req.body);
      
      const result = await storage.createPublicHoliday(holidayData);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid holiday data", errors: error.errors });
      }
      console.error("Error creating public holiday:", error);
      res.status(500).json({ message: "Failed to create public holiday" });
    }
  });

  // Employee Rate Management Routes - Manager only
  
  // GET /api/employee-rates/:userId - Get rates for a specific employee
  app.get("/api/employee-rates/:userId", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only business users, managers and business owners can view employee rates
      if (user.userType !== 'business' && user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager access required" });
      }
      
      const employeeId = parseInt(req.params.userId);
      const employeeRates = await storage.getEmployeeRates(employeeId);
      
      if (!employeeRates) {
        return res.status(404).json({ message: "Employee rates not found" });
      }
      
      res.json(employeeRates);
    } catch (error) {
      console.error("Error fetching employee rates:", error);
      res.status(500).json({ message: "Failed to fetch employee rates" });
    }
  });

  // GET /api/companies/:companyId/employee-rates - Get rates for all employees in a company
  app.get("/api/companies/:companyId/employee-rates", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only business users, managers and business owners can view employee rates
      if (user.userType !== 'business' && user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager access required" });
      }
      
      const companyId = parseInt(req.params.companyId);
      
      // Verify user belongs to this company
      if (user.companyId !== companyId) {
        return res.status(403).json({ message: "Access denied to this company" });
      }
      
      const employeeRates = await storage.getEmployeeRatesByCompany(companyId);
      
      res.json(employeeRates);
    } catch (error) {
      console.error("Error fetching company employee rates:", error);
      res.status(500).json({ message: "Failed to fetch company employee rates" });
    }
  });

  // POST /api/employee-rates - Create employee rates
  app.post("/api/employee-rates", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only business users and managers can create employee rates
      if (user.userType !== 'business' && user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager access required" });
      }
      
      const rateData = insertEmployeeRateSchema.parse({
        ...req.body,
        companyId: user.companyId
      });
      
      const result = await storage.createEmployeeRates(rateData);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee rate data", errors: error.errors });
      }
      console.error("Error creating employee rates:", error);
      res.status(500).json({ message: "Failed to create employee rates" });
    }
  });

  // PUT /api/employee-rates/:userId - Update employee rates
  app.put("/api/employee-rates/:userId", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Only business users and managers can update employee rates
      if (user.userType !== 'business' && user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager access required" });
      }
      
      const employeeId = parseInt(req.params.userId);
      const updateData = insertEmployeeRateSchema.partial().parse(req.body);
      
      const result = await storage.updateEmployeeRates(employeeId, updateData);
      
      if (!result) {
        return res.status(404).json({ message: "Employee rates not found" });
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee rate data", errors: error.errors });
      }
      console.error("Error updating employee rates:", error);
      res.status(500).json({ message: "Failed to update employee rates" });
    }
  });

  app.post("/api/billing/preview", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Validate preview data
      const previewSchema = z.object({
        shiftType: z.string(),
        date: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        hoursWorked: z.number().positive(),
        employeeId: z.number().optional() // For manager preview of specific employee
      });
      
      const previewData = previewSchema.parse(req.body);
      
      // Determine which employee's rates to use for preview
      let employeeId = req.userId; // Default to current user
      if (previewData.employeeId) {
        // Only managers can preview other employees' rates
        const isBusinessOwner = user.userType === 'business' || user.userType === 'business_owner';
        const isManagerOrOwner = user.role === 'manager' || user.role === 'owner';
        if (!isBusinessOwner && !isManagerOrOwner) {
          return res.status(403).json({ message: "Manager access required to preview employee rates" });
        }
        employeeId = previewData.employeeId;
      }
      
      // Use the billing engine to calculate preview with employee rates
      const billing = await calculateShiftBilling(
        -1, // Mock ID for preview
        employeeId,
        previewData.date,
        previewData.startTime,
        previewData.endTime,
        previewData.shiftType
      );
      
      res.json(billing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid preview data", errors: error.errors });
      }
      console.error("Error calculating billing preview:", error);
      res.status(500).json({ message: "Failed to calculate billing preview" });
    }
  });

  // Notification routes - support both JWT and session auth
  app.get("/api/notifications", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const notificationData = insertNotificationSchema.parse({
        ...req.body,
        userId: req.userId
      });

      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid notification data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id/read", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(id);
      
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Admin routes for database management - support both JWT and session auth
  app.get("/api/admin/stats", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const userCount = await storage.getUserCount();
      const shiftCount = await storage.getShiftCount();
      const totalHours = await storage.getTotalHours();
      const notificationCount = await storage.getNotificationCount();
      
      res.json({
        userCount,
        shiftCount,
        totalHours,
        notificationCount
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  app.get("/api/admin/users", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const shifts = await storage.getAllShiftsWithUsers();
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching all shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.post("/api/admin/sql", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "SQL query is required" });
      }

      // Basic safety check - only allow SELECT queries for security
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        return res.status(400).json({ 
          message: "Only SELECT queries are allowed for security reasons" 
        });
      }

      const result = await storage.executeRawQuery(query);
      res.json(result);
    } catch (error) {
      console.error("Error executing SQL query:", error);
      res.status(500).json({ 
        message: "Query execution failed", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Business routes - support both JWT and session auth  
  app.post("/api/companies", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const companyData = req.body;
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get("/api/companies/:id/employees", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const employees = await storage.getCompanyEmployees(companyId);
      res.json(employees);
    } catch (error) {
      console.error("Error getting company employees:", error);
      res.status(500).json({ message: "Failed to get company employees" });
    }
  });

  // POST /api/companies/:id/invite-employee - Add employee to company by email
  app.post("/api/companies/:id/invite-employee", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { email, role } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Verify user is owner or manager of this company
      const user = await storage.getUser(req.userId);
      if (!user || (user.companyId !== companyId && user.userType !== 'business_owner')) {
        return res.status(403).json({ message: "Not authorized to add employees to this company" });
      }

      // Get company info for the invitation email
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Try to add existing user first
      const result = await storage.inviteEmployeeToCompany(companyId, email, role || 'employee');

      if (result) {
        // User exists and was added directly
        return res.json({ message: "Employee added successfully", employee: result, type: "direct" });
      }

      // User doesn't exist - check if there's already a pending invitation
      const existingInvitation = await storage.getInvitationByEmail(email, companyId);
      if (existingInvitation) {
        return res.status(400).json({ message: "An invitation has already been sent to this email" });
      }

      // Create invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Save invitation to database
      const invitation = await storage.createInvitation({
        email,
        companyId,
        role: role || 'employee',
        token,
        invitedBy: req.userId,
        expiresAt,
      });

      // Send invitation email
      const emailSent = await sendInvitationEmail(
        email,
        company.name,
        user.name,
        token
      );

      if (emailSent) {
        res.json({
          message: "Invitation sent successfully",
          invitation: { id: invitation.id, email, expiresAt },
          type: "invitation"
        });
      } else {
        // Email failed but invitation was created
        res.json({
          message: "Invitation created but email could not be sent. Please ensure SendGrid is configured.",
          invitation: { id: invitation.id, email, expiresAt },
          type: "invitation",
          emailSent: false
        });
      }
    } catch (error: any) {
      console.error("Error inviting employee:", error);
      if (error.message === 'User already belongs to another company') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to add employee" });
    }
  });

  // PUT /api/companies/:id/employees/:userId/toggle-active - Toggle employee active status
  app.put("/api/companies/:id/employees/:userId/toggle-active", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const employeeId = parseInt(req.params.userId);
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      // Verify user is owner or manager of this company
      const user = await storage.getUser(req.userId);
      if (!user || (user.companyId !== companyId && user.userType !== 'business_owner')) {
        return res.status(403).json({ message: "Not authorized to manage employees in this company" });
      }

      // Verify employee belongs to this company
      const employee = await storage.getUser(employeeId);
      if (!employee || employee.companyId !== companyId) {
        return res.status(404).json({ message: "Employee not found in this company" });
      }

      const result = await storage.toggleEmployeeActive(employeeId, isActive);

      if (!result) {
        return res.status(404).json({ message: "Failed to update employee status" });
      }

      res.json({ message: `Employee ${isActive ? 'activated' : 'deactivated'} successfully`, employee: result });
    } catch (error) {
      console.error("Error toggling employee status:", error);
      res.status(500).json({ message: "Failed to update employee status" });
    }
  });

  // DELETE /api/companies/:id/employees/:userId - Remove employee from company
  app.delete("/api/companies/:id/employees/:userId", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const employeeId = parseInt(req.params.userId);

      // Verify user is owner or manager of this company
      const user = await storage.getUser(req.userId);
      if (!user || (user.companyId !== companyId && user.userType !== 'business_owner')) {
        return res.status(403).json({ message: "Not authorized to remove employees from this company" });
      }

      // Verify employee belongs to this company
      const employee = await storage.getUser(employeeId);
      if (!employee || employee.companyId !== companyId) {
        return res.status(404).json({ message: "Employee not found in this company" });
      }

      const result = await storage.removeEmployeeFromCompany(employeeId);

      if (!result) {
        return res.status(404).json({ message: "Failed to remove employee" });
      }

      res.json({ message: "Employee removed successfully" });
    } catch (error) {
      console.error("Error removing employee:", error);
      res.status(500).json({ message: "Failed to remove employee" });
    }
  });

  // GET /api/companies/:id/invitations - List pending invitations
  app.get("/api/companies/:id/invitations", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);

      // Verify user is owner or manager of this company
      const user = await storage.getUser(req.userId);
      if (!user || (user.companyId !== companyId && user.userType !== 'business_owner')) {
        return res.status(403).json({ message: "Not authorized to view invitations" });
      }

      const invitations = await storage.getInvitationsByCompany(companyId);
      res.json(invitations);
    } catch (error) {
      console.error("Error getting invitations:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  // DELETE /api/companies/:id/invitations/:invitationId - Cancel invitation
  app.delete("/api/companies/:id/invitations/:invitationId", optionalJwtAuth, requireAuth, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const invitationId = parseInt(req.params.invitationId);

      // Verify user is owner or manager of this company
      const user = await storage.getUser(req.userId);
      if (!user || (user.companyId !== companyId && user.userType !== 'business_owner')) {
        return res.status(403).json({ message: "Not authorized to cancel invitations" });
      }

      await storage.deleteInvitation(invitationId);
      res.json({ message: "Invitation cancelled" });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });

  // GET /api/invitations/:token - Get invitation info by token (public)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const result = await storage.getInvitationWithCompany(token);

      if (!result) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      res.json({
        email: result.invitation.email,
        role: result.invitation.role,
        companyName: result.company.name,
        inviterName: result.inviter.name,
        expiresAt: result.invitation.expiresAt,
      });
    } catch (error) {
      console.error("Error getting invitation:", error);
      res.status(500).json({ message: "Failed to get invitation" });
    }
  });

  // POST /api/invitations/:token/accept - Accept invitation and create/link user
  app.post("/api/invitations/:token/accept", async (req, res) => {
    try {
      const { token } = req.params;
      const { name } = req.body;

      // Get invitation with company info
      const result = await storage.getInvitationWithCompany(token);

      if (!result) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      const { invitation, company } = result;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Check if user already exists with this email
      let existingUser = await storage.getUserByEmail(invitation.email);

      if (existingUser) {
        // User exists - link them to the company
        if (existingUser.companyId && existingUser.companyId !== invitation.companyId) {
          return res.status(400).json({ message: "This email is already associated with another company" });
        }

        await storage.inviteEmployeeToCompany(invitation.companyId, invitation.email, invitation.role);
        await storage.acceptInvitation(token, existingUser.id);

        // Generate tokens for the existing user
        const accessToken = await AuthUtils.generateAccessToken(existingUser.id, existingUser.email);
        const refreshToken = AuthUtils.generateRefreshToken();
        await AuthUtils.storeRefreshToken(refreshToken, existingUser.id, true);

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.json({
          message: "Welcome to the team!",
          user: existingUser,
          accessToken,
        });
      }

      // Create new user
      const newUser = await storage.createUser({
        email: invitation.email,
        name,
        userType: 'employee',
        companyId: invitation.companyId,
        role: invitation.role,
        isActive: true,
      });

      // Mark invitation as accepted
      await storage.acceptInvitation(token, newUser.id);

      // Generate tokens for the new user
      const accessToken = await AuthUtils.generateAccessToken(newUser.id, newUser.email);
      const refreshToken = AuthUtils.generateRefreshToken();
      await AuthUtils.storeRefreshToken(refreshToken, newUser.id, true);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.json({
        message: "Account created successfully! Welcome to the team!",
        user: newUser,
        accessToken,
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.get("/api/companies/:id/shifts", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;
      
      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByCompanyAndDateRange(companyId, startDate as string, endDate as string);
      } else {
        shifts = await storage.getShiftsByCompany(companyId);
      }
      
      res.json(shifts);
    } catch (error) {
      console.error("Error getting company shifts:", error);
      res.status(500).json({ message: "Failed to get company shifts" });
    }
  });

  app.get("/api/companies/:id/pending-shifts", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const pendingShifts = await storage.getPendingShifts(companyId);
      res.json(pendingShifts);
    } catch (error) {
      console.error("Error getting pending shifts:", error);
      res.status(500).json({ message: "Failed to get pending shifts" });
    }
  });

  app.post("/api/shifts/:id/approve", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const { approvedBy } = req.body;
      
      const shift = await storage.approveShift(shiftId, approvedBy);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.json(shift);
    } catch (error) {
      console.error("Error approving shift:", error);
      res.status(500).json({ message: "Failed to approve shift" });
    }
  });

  // Email roster endpoints
  app.post("/api/companies/:id/send-roster-email", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { employeeId, weekStart, weekEnd } = req.body;
      
      // Get employee details
      const employees = await storage.getCompanyEmployees(companyId);
      const employee = employees.find(emp => emp.id === employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Get shifts for the employee for the specified week
      const shifts = await storage.getShiftsByCompanyAndDateRange(companyId, weekStart, weekEnd);
      const employeeShifts = shifts.filter(shift => shift.userId === employeeId);
      
      // Transform shifts to match email interface
      const rosterShifts = employeeShifts.map(shift => ({
        id: shift.id,
        employeeId: shift.userId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        type: shift.shiftType,
        location: shift.location || undefined,
        employeeName: employee.name,
        employeeEmail: employee.email
      }));
      
      // Send email
      const success = await sendRosterEmail(
        employee.email,
        employee.name,
        rosterShifts,
        weekStart,
        weekEnd,
        "ShiftMate" // Could be made configurable per company
      );
      
      if (success) {
        res.json({ message: "Roster email sent successfully", employee: employee.name });
      } else {
        res.status(500).json({ message: "Failed to send roster email" });
      }
    } catch (error) {
      console.error("Error sending roster email:", error);
      res.status(500).json({ message: "Failed to send roster email" });
    }
  });

  app.post("/api/companies/:id/send-all-roster-emails", optionalJwtAuth, requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { weekStart, weekEnd } = req.body;
      
      // Get all employees
      const employees = await storage.getCompanyEmployees(companyId);
      
      // Get all shifts for the week
      const shifts = await storage.getShiftsByCompanyAndDateRange(companyId, weekStart, weekEnd);
      
      const results = [];
      
      // Send email to each employee with their shifts
      for (const employee of employees) {
        const employeeShifts = shifts.filter(shift => shift.userId === employee.id);
        
        // Transform shifts to match email interface
        const rosterShifts = employeeShifts.map(shift => ({
          id: shift.id,
          employeeId: shift.userId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          type: shift.shiftType,
          location: shift.location || undefined,
          employeeName: employee.name,
          employeeEmail: employee.email
        }));
        
        try {
          const success = await sendRosterEmail(
            employee.email,
            employee.name,
            rosterShifts,
            weekStart,
            weekEnd,
            "ShiftMate"
          );
          
          results.push({
            employee: employee.name,
            email: employee.email,
            success,
            shiftsCount: rosterShifts.length
          });
        } catch (error) {
          console.error(`Failed to send email to ${employee.name}:`, error);
          results.push({
            employee: employee.name,
            email: employee.email,
            success: false,
            shiftsCount: employeeShifts.length,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      res.json({
        message: `Roster emails sent: ${successCount}/${totalCount} successful`,
        results,
        summary: {
          total: totalCount,
          successful: successCount,
          failed: totalCount - successCount
        }
      });
    } catch (error) {
      console.error("Error sending roster emails:", error);
      res.status(500).json({ message: "Failed to send roster emails" });
    }
  });

  // ============================================================
  // Time-Off Request Routes (US-003: Marcar Indisponibilidad)
  // ============================================================

  // Get user's time-off requests
  app.get("/api/time-off", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requests = await storage.getTimeOffRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching time-off requests:", error);
      res.status(500).json({ message: "Failed to fetch time-off requests" });
    }
  });

  // Get time-off requests for date range (for calendar display)
  app.get("/api/time-off/range", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const requests = await storage.getTimeOffRequestsByUserAndDateRange(
        userId,
        startDate as string,
        endDate as string
      );
      res.json(requests);
    } catch (error) {
      console.error("Error fetching time-off requests:", error);
      res.status(500).json({ message: "Failed to fetch time-off requests" });
    }
  });

  // Create time-off request
  app.post("/api/time-off", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { startDate, endDate, startTime, endTime, isFullDay, reason } = req.body;

      // Validate required fields
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      // Validate reason length (max 500 chars)
      if (reason && reason.length > 500) {
        return res.status(400).json({ message: "Reason cannot exceed 500 characters" });
      }

      // Check for conflicting shifts (AC-003-7)
      const conflictingShifts = await storage.checkShiftConflict(userId, startDate, endDate);
      if (conflictingShifts.length > 0) {
        return res.status(400).json({
          message: "Cannot mark unavailability: you have shifts scheduled during this period",
          conflicts: conflictingShifts.map(s => ({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime
          }))
        });
      }

      // Get user's company
      const user = await storage.getUser(userId);
      const companyId = user?.companyId;

      const request = await storage.createTimeOffRequest({
        userId,
        companyId: companyId || null,
        startDate,
        endDate,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        isFullDay: isFullDay ?? true,
        reason: reason || null,
        status: 'pending'
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating time-off request:", error);
      res.status(500).json({ message: "Failed to create time-off request" });
    }
  });

  // Update time-off request
  app.put("/api/time-off/:id", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requestId = parseInt(req.params.id);
      const existing = await storage.getTimeOffRequest(requestId);

      if (!existing) {
        return res.status(404).json({ message: "Time-off request not found" });
      }

      // Only owner can update their request
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this request" });
      }

      // Can only update pending requests
      if (existing.status !== 'pending') {
        return res.status(400).json({ message: "Cannot update request that is already " + existing.status });
      }

      const { startDate, endDate, startTime, endTime, isFullDay, reason } = req.body;

      // Validate reason length
      if (reason && reason.length > 500) {
        return res.status(400).json({ message: "Reason cannot exceed 500 characters" });
      }

      // Check for conflicting shifts if dates changed
      if (startDate || endDate) {
        const conflictingShifts = await storage.checkShiftConflict(
          userId,
          startDate || existing.startDate,
          endDate || existing.endDate
        );
        if (conflictingShifts.length > 0) {
          return res.status(400).json({
            message: "Cannot update: you have shifts scheduled during this period",
            conflicts: conflictingShifts
          });
        }
      }

      const updated = await storage.updateTimeOffRequest(requestId, {
        startDate: startDate || existing.startDate,
        endDate: endDate || existing.endDate,
        startTime: isFullDay ? null : (startTime || existing.startTime),
        endTime: isFullDay ? null : (endTime || existing.endTime),
        isFullDay: isFullDay ?? existing.isFullDay,
        reason: reason !== undefined ? reason : existing.reason
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating time-off request:", error);
      res.status(500).json({ message: "Failed to update time-off request" });
    }
  });

  // Delete time-off request
  app.delete("/api/time-off/:id", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requestId = parseInt(req.params.id);
      const existing = await storage.getTimeOffRequest(requestId);

      if (!existing) {
        return res.status(404).json({ message: "Time-off request not found" });
      }

      // Only owner can delete their request
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this request" });
      }

      await storage.deleteTimeOffRequest(requestId);
      res.json({ message: "Time-off request deleted" });
    } catch (error) {
      console.error("Error deleting time-off request:", error);
      res.status(500).json({ message: "Failed to delete time-off request" });
    }
  });

  // Manager: Get all time-off requests for company
  app.get("/api/company/:companyId/time-off", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const companyId = parseInt(req.params.companyId);

      // Verify user is authorized (business owner or manager)
      const user = await storage.getUser(userId);
      if (!user || user.companyId !== companyId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager or business owner access required" });
      }

      const requests = await storage.getTimeOffRequestsByCompany(companyId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching company time-off requests:", error);
      res.status(500).json({ message: "Failed to fetch time-off requests" });
    }
  });

  // Manager: Get company time-off requests for date range (for roster planner availability)
  app.get("/api/company/:companyId/time-off/range", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const companyId = parseInt(req.params.companyId);
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      // Verify user is authorized (business owner or manager)
      const user = await storage.getUser(userId);
      if (!user || user.companyId !== companyId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager or business owner access required" });
      }

      const requests = await storage.getTimeOffRequestsByCompanyAndRange(companyId, startDate, endDate);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching company time-off requests by range:", error);
      res.status(500).json({ message: "Failed to fetch time-off requests" });
    }
  });

  // Manager: Approve time-off request
  app.post("/api/time-off/:id/approve", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requestId = parseInt(req.params.id);
      const existing = await storage.getTimeOffRequest(requestId);

      if (!existing) {
        return res.status(404).json({ message: "Time-off request not found" });
      }

      // Verify user is authorized
      const user = await storage.getUser(userId);
      if (!user || (existing.companyId && user.companyId !== existing.companyId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager or business owner access required" });
      }

      const approved = await storage.approveTimeOffRequest(requestId, userId);
      res.json(approved);
    } catch (error) {
      console.error("Error approving time-off request:", error);
      res.status(500).json({ message: "Failed to approve time-off request" });
    }
  });

  // Manager: Reject time-off request
  app.post("/api/time-off/:id/reject", optionalJwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.userId || (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requestId = parseInt(req.params.id);
      const { reason } = req.body;

      const existing = await storage.getTimeOffRequest(requestId);

      if (!existing) {
        return res.status(404).json({ message: "Time-off request not found" });
      }

      // Verify user is authorized
      const user = await storage.getUser(userId);
      if (!user || (existing.companyId && user.companyId !== existing.companyId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (user.userType !== 'business_owner' && user.role !== 'manager') {
        return res.status(403).json({ message: "Manager or business owner access required" });
      }

      const rejected = await storage.rejectTimeOffRequest(requestId, userId, reason || '');
      res.json(rejected);
    } catch (error) {
      console.error("Error rejecting time-off request:", error);
      res.status(500).json({ message: "Failed to reject time-off request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
