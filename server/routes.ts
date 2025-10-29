import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { insertUserSchema, insertShiftSchema, insertNotificationSchema } from "@shared/schema";
import { AuthUtils } from "./auth-utils";
import { jwtAuth, optionalJwtAuth } from "./jwt-middleware";
import { sendRosterEmail } from "./services/sendgrid";
import { z } from "zod";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { 
  calculateShiftBilling, 
  calculateMultipleShiftsBilling,
  formatCurrency 
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
      
      console.log('Login attempt:', { email, name, rememberMe });
      
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // User doesn't exist, create them automatically
        console.log('Creating new user during login:', { email, name });
        user = await storage.createUser({ email, name });
        console.log('Auto-signup successful for new user:', user.id);
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

      console.log('Login successful for user:', user.id, 'RememberMe:', rememberMe);
      console.log('Sending access token in response:', accessToken ? 'YES' : 'NO');
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
      
      console.log('Signup attempt:', { email, name });
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        res.status(409).json({ message: "User already exists. Please log in instead." });
      } else {
        // Create new user
        console.log('Creating new user:', { email, name });
        const newUser = await storage.createUser({ email, name });
        (req.session as any).userId = newUser.id;
        console.log('Signup successful for user:', newUser.id);
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
    console.log('RequireAuth - Checking authentication for:', req.url);
    console.log('RequireAuth - JWT user:', req.user?.id || 'none');
    console.log('RequireAuth - Session user:', req.session?.userId || 'none');
    
    // First check JWT auth (from middleware)
    if (req.user?.id) {
      req.userId = req.user.id;
      console.log('RequireAuth - Using JWT auth for user:', req.userId);
      return next();
    }
    
    // Fall back to session-based auth for backward compatibility
    const userId = req.session?.userId;
    if (!userId) {
      console.log('RequireAuth - No authentication found, returning 401');
      return res.status(401).json({ message: "Authentication required" });
    }
    req.userId = userId;
    console.log('RequireAuth - Using session auth for user:', req.userId);
    next();
  };

  // Shift routes - support both JWT and session auth
  app.get("/api/shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    console.log('GET /api/shifts - Starting request for user:', req.userId);
    try {
      const { startDate, endDate } = req.query;
      
      let shifts;
      if (startDate && endDate) {
        shifts = await storage.getShiftsByUserAndDateRange(req.userId, startDate, endDate);
      } else {
        shifts = await storage.getShiftsByUser(req.userId);
      }
      
      console.log('GET /api/shifts - Returning', shifts.length, 'shifts for user:', req.userId);
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
    console.log('GET /api/personal-shifts - Starting request for user:', req.userId);
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
      
      console.log('GET /api/personal-shifts - Returning', personalShifts.length, 'personal shifts for user:', req.userId);
      res.json(personalShifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get personal shifts" });
    }
  });

  // GET /api/roster-shifts - Get shifts assigned to the user by managers
  app.get("/api/roster-shifts", optionalJwtAuth, requireAuth, async (req: any, res) => {
    console.log('GET /api/roster-shifts - Starting request for user:', req.userId);
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
      
      console.log('GET /api/roster-shifts - Returning', rosterShifts.length, 'roster shifts for user:', req.userId);
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
  
  // GET /api/roster - Get full team shifts for managers
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
      
      res.json(shifts);
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
      
      const createdShifts = [];
      
      for (const shiftData of shiftsArray) {
        // Validate employee belongs to same company
        const employee = await storage.getUser(shiftData.userId);
        if (!employee || employee.companyId !== user.companyId) {
          return res.status(403).json({ 
            message: `Employee ${shiftData.userId} not found or not in your company` 
          });
        }

        // Check for overlapping shifts for this employee
        const existingShifts = await storage.getShiftsByUserAndDate(shiftData.userId, shiftData.date);
        const hasOverlap = existingShifts.some(existing => {
          const newStart = new Date(`2000-01-01T${shiftData.startTime}`);
          const newEnd = new Date(`2000-01-01T${shiftData.endTime}`);
          const existingStart = new Date(`2000-01-01T${existing.startTime}`);
          const existingEnd = new Date(`2000-01-01T${existing.endTime}`);
          
          return (newStart < existingEnd && newEnd > existingStart);
        });

        if (hasOverlap) {
          return res.status(409).json({ 
            message: `Shift overlaps with existing shift for employee ${employee.name} on ${shiftData.date}` 
          });
        }

        const processedShiftData = insertShiftSchema.parse({
          ...shiftData,
          companyId: user.companyId,
          createdBy: req.userId,
          status: 'scheduled'
        });

        const shift = await storage.createShift(processedShiftData);
        createdShifts.push(shift);
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
      if (user.userType !== 'business_owner' && user.role !== 'manager') {
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
      if (user.userType !== 'business_owner' && user.role !== 'manager') {
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
        if (user.userType !== 'business_owner' && user.role !== 'manager') {
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

  const httpServer = createServer(app);
  return httpServer;
}
