import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import { insertUserSchema, insertShiftSchema, insertNotificationSchema } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Extend the Request interface to include session
interface AuthenticatedRequest extends Request {
  session: any;
  userId?: number;
}

// Configure Google OAuth Strategy
function setupGoogleAuth() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
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
  // Configure session middleware for mobile app persistence
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
  
  // Setup Google OAuth
  setupGoogleAuth();

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    // Store the intent (login or signup) in session
    (req.session as any).authIntent = req.query.intent || 'login';
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get("/api/auth/google/callback", 
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
      // Successful authentication, redirect to dashboard
      res.redirect('/');
    }
  );

  // Email/Name Auth routes - Auto-creates user if doesn't exist
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, name } = req.body;
      
      console.log('Login attempt:', { email, name });
      
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (user) {
        // User exists, log them in
        (req.session as any).userId = user.id;
        console.log('Login successful for existing user:', user.id);
        res.json({ user });
      } else {
        // User doesn't exist, create them automatically
        console.log('Creating new user during login:', { email, name });
        user = await storage.createUser({ email, name });
        (req.session as any).userId = user.id;
        console.log('Auto-signup successful for new user:', user.id);
        res.json({ user });
      }
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

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        // Clear invalid session
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      // Refresh session expiry on successful authentication check
      (req.session as any).touch();
      
      res.json({ user });
    } catch (error) {
      console.error('Auth me error:', error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Middleware to check authentication
  const requireAuth = (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    req.userId = userId;
    next();
  };

  // Shift routes
  app.get("/api/shifts", requireAuth, async (req: any, res) => {
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

  app.post("/api/shifts", requireAuth, async (req: any, res) => {
    try {
      const shiftData = insertShiftSchema.parse({
        ...req.body,
        userId: req.userId
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

  app.put("/api/shifts/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const shiftData = insertShiftSchema.partial().parse(req.body);

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

  app.delete("/api/shifts/:id", requireAuth, async (req: any, res) => {
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

  // Analytics routes
  app.get("/api/analytics/weekly-hours", requireAuth, async (req: any, res) => {
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

  app.get("/api/analytics/daily-average", requireAuth, async (req: any, res) => {
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

  app.get("/api/analytics/missing-entries", requireAuth, async (req: any, res) => {
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

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications", requireAuth, async (req: any, res) => {
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

  app.put("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
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

  // Admin routes for database management
  app.get("/api/admin/stats", requireAuth, async (req: any, res) => {
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

  app.get("/api/admin/users", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/shifts", requireAuth, async (req: any, res) => {
    try {
      const shifts = await storage.getAllShiftsWithUsers();
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching all shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.post("/api/admin/sql", requireAuth, async (req: any, res) => {
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

  // Business routes
  app.post("/api/companies", async (req, res) => {
    try {
      const companyData = req.body;
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.get("/api/companies/:id/employees", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const employees = await storage.getCompanyEmployees(companyId);
      res.json(employees);
    } catch (error) {
      console.error("Error getting company employees:", error);
      res.status(500).json({ message: "Failed to get company employees" });
    }
  });

  app.get("/api/companies/:id/shifts", async (req, res) => {
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

  app.get("/api/companies/:id/pending-shifts", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const pendingShifts = await storage.getPendingShifts(companyId);
      res.json(pendingShifts);
    } catch (error) {
      console.error("Error getting pending shifts:", error);
      res.status(500).json({ message: "Failed to get pending shifts" });
    }
  });

  app.post("/api/shifts/:id/approve", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
